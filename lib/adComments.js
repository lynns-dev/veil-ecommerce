// Comment moderation for the store's Meta ads (Facebook + Instagram).
// Shared, unmodified, between the veil-ecommerce and anese repos.
//
// How it works: every sync lists the ad account's active ads, takes each
// ad's underlying Facebook post (creative.effective_object_story_id) and
// Instagram post (creative.effective_instagram_media_id), and pulls the
// newest comments on each. New comments are checked against the rules
// below; a match is hidden on Meta straight away when auto-hide is on, and
// everything else lands in admin → Ad comments for a person to look at.
// Runs from the cron (pages/api/cron/ad-comments.js) and the admin's
// "Sync now" button.
//
// Hiding vs deleting: a hidden Facebook comment stays visible to the
// person who wrote it and their friends, so they usually don't notice and
// re-post — that's why auto-moderation only ever hides. Deleting is a
// manual admin action.
//
// Env:
// - META_AD_ACCOUNT_ID — the ad account to watch (with or without "act_").
// - META_MARKETING_ACCESS_TOKEN — ads_read on that ad account (the same
//   token lib/metaAdsResolver.js uses).
// - META_PAGE_ACCESS_TOKEN — a Page token for the Page the ads run as, with
//   pages_read_engagement, pages_read_user_content, pages_manage_engagement,
//   and (for Instagram) instagram_basic + instagram_manage_comments. A
//   system user token that has all of the above can be used for both.
//
// KV keys (same Upstash store as everything else):
//   ad_comments       -> JSON array of comment records, newest first
//   ad_comment_rules  -> JSON object, see DEFAULT_RULES
//   ad_comment_sync   -> JSON object describing the last sync

import { GRAPH_VERSION } from './metaCapi';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const COMMENTS_KEY = 'ad_comments';
const RULES_KEY = 'ad_comment_rules';
const SYNC_KEY = 'ad_comment_sync';
const MAX_STORED = 3000;
// Caps per sync so one run stays well inside a serverless time limit.
const MAX_POSTS_PER_SYNC = 80;
const FETCH_CONCURRENCY = 6;

export const DEFAULT_RULES = {
  autoHide: true,
  hideLinks: true,
  hideContactInfo: true,
  blockedWords: [
    'whatsapp', 'telegram', 'dm me', 'message me', 'check my profile', 'check my page',
    'crypto', 'bitcoin', 'forex', 'investment', 'onlyfans', 'promo code', 'free followers',
  ],
};

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

async function kvGet(key) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Failed to save ${key}.`);
}

export async function getAdComments() {
  return (await kvGet(COMMENTS_KEY)) || [];
}

async function saveAdComments(comments) {
  const sorted = [...comments].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  await kvSet(COMMENTS_KEY, sorted.slice(0, MAX_STORED));
}

export async function getRules() {
  return { ...DEFAULT_RULES, ...((await kvGet(RULES_KEY)) || {}) };
}

export async function updateRules(patch) {
  const existing = await getRules();
  const next = { ...existing };
  if (typeof patch.autoHide === 'boolean') next.autoHide = patch.autoHide;
  if (typeof patch.hideLinks === 'boolean') next.hideLinks = patch.hideLinks;
  if (typeof patch.hideContactInfo === 'boolean') next.hideContactInfo = patch.hideContactInfo;
  if (Array.isArray(patch.blockedWords)) {
    next.blockedWords = [...new Set(patch.blockedWords.map((w) => String(w).trim().toLowerCase()).filter(Boolean))];
  }
  await kvSet(RULES_KEY, next);
  return next;
}

export async function getSyncStatus() {
  return kvGet(SYNC_KEY);
}

export function moderationConfig() {
  return {
    adAccount: Boolean(process.env.META_AD_ACCOUNT_ID),
    marketingToken: Boolean(process.env.META_MARKETING_ACCESS_TOKEN),
    pageToken: Boolean(process.env.META_PAGE_ACCESS_TOKEN),
  };
}

function isConfigured() {
  const c = moderationConfig();
  return c.adAccount && c.marketingToken && c.pageToken;
}

// ---- Rules ---------------------------------------------------------------

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|shop|store|xyz|link|info|co|io|ly|me|biz|site|online|top|click)\b|bit\.ly|t\.me\/|wa\.me\/)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns a short human reason when the text breaks a rule, else null.
export function matchRules(text, rules) {
  const body = String(text || '');
  if (!body) return null;
  if (rules.hideLinks && LINK_RE.test(body)) return 'Contains a link';
  if (rules.hideContactInfo && (EMAIL_RE.test(body) || PHONE_RE.test(body))) return 'Contains contact info';
  const lower = body.toLowerCase();
  for (const word of rules.blockedWords || []) {
    // Whole-word/phrase match, so "scam" doesn't catch "scampi".
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word.toLowerCase())}([^a-z0-9]|$)`, 'i');
    if (re.test(lower)) return `Blocked word: "${word}"`;
  }
  return null;
}

// ---- Graph API -----------------------------------------------------------

async function graphGet(path, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Graph API request failed (${res.status}).`);
  return data;
}

async function graphWrite(method, path, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, { method, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Graph API request failed (${res.status}).`);
  return data;
}

function adAccountPath() {
  const id = String(process.env.META_AD_ACCOUNT_ID || '').trim();
  return id.startsWith('act_') ? id : `act_${id}`;
}

// Active ads -> one entry per distinct FB/IG post, with the ad names using it
// (the same post is often reused across several ads).
async function listAdPosts() {
  const token = process.env.META_MARKETING_ACCESS_TOKEN;
  const posts = new Map();
  let after;
  for (let page = 0; page < 5; page += 1) {
    const data = await graphGet(`${adAccountPath()}/ads`, {
      fields: 'id,name,creative{effective_object_story_id,effective_instagram_media_id}',
      effective_status: JSON.stringify(['ACTIVE']),
      limit: '200',
      ...(after ? { after } : {}),
    }, token);
    for (const ad of data.data || []) {
      const targets = [
        ['facebook', ad.creative?.effective_object_story_id],
        ['instagram', ad.creative?.effective_instagram_media_id],
      ];
      for (const [platform, postId] of targets) {
        if (!postId) continue;
        const key = `${platform}:${postId}`;
        if (!posts.has(key)) posts.set(key, { platform, postId, adIds: [], adNames: [] });
        const entry = posts.get(key);
        entry.adIds.push(ad.id);
        entry.adNames.push(ad.name);
      }
    }
    after = data.paging?.next ? data.paging?.cursors?.after : null;
    if (!after) break;
  }
  return [...posts.values()];
}

async function fetchFacebookComments(post, token) {
  const data = await graphGet(`${post.postId}/comments`, {
    fields: 'id,message,from{id,name},created_time,is_hidden,permalink_url,parent{id}',
    filter: 'stream',
    order: 'reverse_chronological',
    limit: '100',
  }, token);
  return (data.data || []).map((c) => ({
    id: c.id,
    platform: 'facebook',
    postId: post.postId,
    parentId: c.parent?.id || null,
    text: c.message || '',
    authorId: c.from?.id || null,
    authorName: c.from?.name || 'Facebook user',
    createdAt: Date.parse(c.created_time) || Date.now(),
    hidden: Boolean(c.is_hidden),
    permalink: c.permalink_url || null,
  }));
}

async function fetchInstagramComments(post, token) {
  const data = await graphGet(`${post.postId}/comments`, {
    fields: 'id,text,username,timestamp,hidden,replies{id,text,username,timestamp,hidden}',
    limit: '50',
  }, token);
  const out = [];
  const toRecord = (c, parentId) => ({
    id: c.id,
    platform: 'instagram',
    postId: post.postId,
    parentId,
    text: c.text || '',
    authorId: null,
    authorName: c.username ? `@${c.username}` : 'Instagram user',
    username: c.username || null,
    createdAt: Date.parse(c.timestamp) || Date.now(),
    hidden: Boolean(c.hidden),
    permalink: null,
  });
  for (const c of data.data || []) {
    out.push(toRecord(c, null));
    for (const r of c.replies?.data || []) out.push(toRecord(r, c.id));
  }
  return out;
}

// The Page (and its linked Instagram account) the page token belongs to —
// so the store's own replies are never moderated.
async function getOwnIdentity(token) {
  try {
    const me = await graphGet('me', { fields: 'id,name,instagram_business_account{id,username}' }, token);
    return { pageId: me.id, igUsername: me.instagram_business_account?.username || null };
  } catch {
    return { pageId: null, igUsername: null };
  }
}

async function inBatches(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return results;
}

// ---- Actions on a single comment ----------------------------------------

export async function setCommentHidden(comment, hidden) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (comment.platform === 'instagram') {
    await graphWrite('POST', comment.id, { hide: String(hidden) }, token);
  } else {
    await graphWrite('POST', comment.id, { is_hidden: String(hidden) }, token);
  }
}

export async function deleteCommentOnMeta(comment) {
  await graphWrite('DELETE', comment.id, {}, process.env.META_PAGE_ACCESS_TOKEN);
}

export async function replyOnMeta(comment, message) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  // Both platforms only nest one level deep, so a reply to a reply goes on
  // the top-level comment it belongs to.
  const targetId = comment.parentId || comment.id;
  if (comment.platform === 'instagram') {
    const text = comment.parentId && comment.username ? `@${comment.username} ${message}` : message;
    await graphWrite('POST', `${targetId}/replies`, { message: text }, token);
  } else {
    await graphWrite('POST', `${targetId}/comments`, { message }, token);
  }
}

// Applies an admin action and records the outcome. Re-reads the list right
// before saving so a sync running at the same time loses as little as
// possible.
export async function moderateComment(id, action, { message } = {}) {
  const comments = await getAdComments();
  const comment = comments.find((c) => c.id === id);
  if (!comment) throw new Error('Comment not found.');

  let patch;
  if (action === 'hide') {
    await setCommentHidden(comment, true);
    patch = { hidden: true, status: 'hidden' };
  } else if (action === 'unhide') {
    await setCommentHidden(comment, false);
    // Unhiding is a person's call that the comment is fine — keep auto-hide
    // from hiding it again on the next sync.
    patch = { hidden: false, status: 'approved', autoHidden: false };
  } else if (action === 'approve') {
    patch = { status: 'approved' };
  } else if (action === 'delete') {
    await deleteCommentOnMeta(comment);
    patch = { status: 'deleted' };
  } else if (action === 'reply') {
    const text = String(message || '').trim();
    if (!text) throw new Error('Reply is empty.');
    await replyOnMeta(comment, text);
    patch = {
      status: comment.status === 'new' ? 'approved' : comment.status,
      replies: [...(comment.replies || []), { text, at: Date.now() }],
    };
  } else {
    throw new Error('Unknown action.');
  }

  const fresh = await getAdComments();
  const updated = { ...comment, ...patch, moderatedAt: Date.now() };
  const idx = fresh.findIndex((c) => c.id === id);
  if (idx === -1) fresh.push(updated);
  else fresh[idx] = { ...fresh[idx], ...patch, moderatedAt: Date.now() };
  await saveAdComments(fresh);
  return idx === -1 ? updated : fresh[idx];
}

// ---- Sync ----------------------------------------------------------------

export async function syncAdComments() {
  if (!isConfigured()) {
    throw new Error('Ad comment moderation is not set up — see DEPLOYMENT.md (META_AD_ACCOUNT_ID, META_MARKETING_ACCESS_TOKEN, META_PAGE_ACCESS_TOKEN).');
  }
  const startedAt = Date.now();
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  const [rules, own, allPosts] = await Promise.all([getRules(), getOwnIdentity(pageToken), listAdPosts()]);
  const posts = allPosts.slice(0, MAX_POSTS_PER_SYNC);

  const errors = [];
  const fetched = await inBatches(posts, FETCH_CONCURRENCY, async (post) => {
    try {
      const list = post.platform === 'instagram'
        ? await fetchInstagramComments(post, pageToken)
        : await fetchFacebookComments(post, pageToken);
      return list.map((c) => ({ ...c, adIds: post.adIds, adNames: post.adNames }));
    } catch (err) {
      errors.push(`${post.platform} post ${post.postId}: ${err.message}`);
      return [];
    }
  });

  const incoming = fetched.flat().filter((c) => {
    if (c.platform === 'facebook' && own.pageId && c.authorId === own.pageId) return false;
    if (c.platform === 'instagram' && own.igUsername && c.username === own.igUsername) return false;
    return true;
  });

  const existing = await getAdComments();
  const byId = new Map(existing.map((c) => [c.id, c]));
  let added = 0;
  let autoHidden = 0;

  for (const c of incoming) {
    const prev = byId.get(c.id);
    if (prev) {
      // Keep moderation history; just reflect anything changed on Meta's side
      // (including someone hiding/unhiding it from Meta's own apps).
      let { status } = prev;
      if (c.hidden && status !== 'hidden') status = 'hidden';
      else if (!c.hidden && status === 'hidden') status = 'approved';
      byId.set(c.id, { ...prev, text: c.text, hidden: c.hidden, status, adNames: c.adNames, adIds: c.adIds });
      continue;
    }
    const flag = matchRules(c.text, rules);
    const record = { ...c, status: c.hidden ? 'hidden' : 'new', flag, autoHidden: false, firstSeenAt: Date.now() };
    if (flag && rules.autoHide && !c.hidden) {
      try {
        await setCommentHidden(c, true);
        record.hidden = true;
        record.status = 'hidden';
        record.autoHidden = true;
        autoHidden += 1;
      } catch (err) {
        errors.push(`Couldn't hide comment ${c.id}: ${err.message}`);
      }
    }
    byId.set(c.id, record);
    added += 1;
  }

  // Merge into whatever is stored *now*, so an admin action taken while this
  // sync was fetching isn't overwritten with the older copy.
  const latest = await getAdComments();
  const merged = new Map(latest.map((c) => [c.id, c]));
  for (const [id, c] of byId) {
    const current = merged.get(id);
    merged.set(id, current && (current.moderatedAt || 0) > startedAt ? current : c);
  }
  await saveAdComments([...merged.values()]);

  const status = {
    at: Date.now(),
    posts: allPosts.length,
    postsChecked: posts.length,
    postsSkipped: Math.max(0, allPosts.length - posts.length),
    added,
    autoHidden,
    errors: errors.slice(0, 10),
  };
  await kvSet(SYNC_KEY, status);
  return status;
}
