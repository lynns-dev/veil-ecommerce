// One-time move from the separate email app into this store (admin's
// Email → Import tab). Signs in to the email app with its admin password,
// reads everything through its own admin API, and writes it into this
// store's KV under the same keys lib/email/*Store.js use.
//
// Subscribers are split by store: one counts as this store's if their email
// appears in this store's orders or checkout/popup leads. The rest
// ("unmatched") are only imported when asked — the email app kept a single
// list for every store, with no record of which one someone came from.
// Subscribers already in this store's list are left as they are, so the
// import is safe to run more than once.

import { getOrders, dateKeysForRange } from '../analyticsStore';
import { getLeads } from '../checkoutLeadsStore';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Failed to save ${key}.`);
}

function normalizeBase(url) {
  const raw = String(url || '').trim();
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withProto);
  if (parsed.protocol !== 'https:') throw new Error('The email app address must be https.');
  return parsed.origin;
}

async function readEmailApp(emailAppUrl, password) {
  const base = normalizeBase(emailAppUrl);
  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (login.status === 401) throw new Error('The email app rejected that password.');
  if (!login.ok) throw new Error(`Could not sign in to the email app (${login.status}).`);
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('The email app did not return a session.');

  const get = async (path) => {
    const res = await fetch(`${base}${path}`, { headers: { Cookie: cookie } });
    if (!res.ok) throw new Error(`Email app ${path} returned ${res.status}.`);
    return res.json();
  };
  try {
    const [subs, templates, automations, campaigns, settings] = await Promise.all([
      get('/api/admin/email/subscribers'),
      get('/api/admin/email/templates'),
      get('/api/admin/email/automations'),
      get('/api/admin/email/campaigns'),
      get('/api/admin/settings'),
    ]);
    return {
      // Drop the per-row tier/grade the email app's admin adds for display.
      subscribers: (subs.subscribers || []).map(({ tier, grade, ...s }) => s),
      templates: templates.templates || [],
      automations: automations.automations || [],
      campaigns: campaigns.campaigns || [],
      settings: settings.settings || null,
    };
  } finally {
    await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { Cookie: cookie } }).catch(() => {});
  }
}

async function thisStoresEmails() {
  const [orders, leads] = await Promise.all([
    Promise.all(dateKeysForRange('45d').map((key) => getOrders(key))).then((d) => d.flat()),
    getLeads(),
  ]);
  return new Set([...orders.map((o) => o.email), ...leads.map((l) => l.email)].filter(Boolean).map((e) => e.trim().toLowerCase()));
}

export async function previewImport({ emailAppUrl, password }) {
  const data = await readEmailApp(emailAppUrl, password);
  const ours = await thisStoresEmails();
  const matched = data.subscribers.filter((s) => ours.has(s.email));
  return {
    subscribers: data.subscribers.length,
    matched: matched.length,
    unmatched: data.subscribers.length - matched.length,
    activeMatched: matched.filter((s) => s.status === 'subscribed').length,
    templates: data.templates.length,
    automations: data.automations.length,
    campaigns: data.campaigns.length,
    senderEmail: data.settings?.senderEmail || '',
  };
}

export async function runImport({ emailAppUrl, password, includeUnmatched, includeContent, includeSettings }) {
  const data = await readEmailApp(emailAppUrl, password);
  const ours = await thisStoresEmails();
  const result = {};

  const existing = (await kvGet('email_subscribers')) || [];
  const have = new Set(existing.map((s) => s.email));
  const incoming = data.subscribers.filter((s) => !have.has(s.email) && (includeUnmatched || ours.has(s.email)));
  await kvSet('email_subscribers', [...existing, ...incoming]);
  result.subscribersAdded = incoming.length;
  result.subscribersSkipped = data.subscribers.length - incoming.length;

  if (includeContent) {
    const templates = (await kvGet('email_templates')) || [];
    const templateIds = new Set(templates.map((t) => t.id));
    const newTemplates = data.templates.filter((t) => !templateIds.has(t.id));
    await kvSet('email_templates', [...templates, ...newTemplates]);
    result.templatesAdded = newTemplates.length;

    // The email app's flows replace this store's starter flows outright —
    // including each flow's on/off switch, send stats and link targets.
    if (data.automations.length) await kvSet('email_automations', data.automations);
    result.automationsImported = data.automations.length;

    const campaigns = (await kvGet('email_campaigns')) || [];
    const campaignIds = new Set(campaigns.map((c) => c.id));
    const newCampaigns = data.campaigns.filter((c) => !campaignIds.has(c.id));
    await kvSet('email_campaigns', [...campaigns, ...newCampaigns]);
    result.campaignsAdded = newCampaigns.length;
  }

  if (includeSettings && data.settings) {
    await kvSet('email_settings', data.settings);
    result.settingsImported = true;
  }
  return result;
}
