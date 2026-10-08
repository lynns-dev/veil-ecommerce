import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T, S } from '../../lib/theme';
import { BRAND } from '../../lib/email/brand';

// Comment moderation for the store's Meta ads — see lib/adComments.js.
const FILTERS = [
  { id: 'review', label: 'Needs review', test: (c) => c.status === 'new' },
  { id: 'flagged', label: 'Flagged', test: (c) => Boolean(c.flag) && c.status !== 'deleted' },
  { id: 'hidden', label: 'Hidden', test: (c) => c.status === 'hidden' },
  { id: 'approved', label: 'Approved', test: (c) => c.status === 'approved' },
  { id: 'all', label: 'All', test: (c) => c.status !== 'deleted' },
];

const STATUS_LABELS = { new: 'Needs review', hidden: 'Hidden', approved: 'Approved', deleted: 'Deleted' };

function timeAgo(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdCommentsAdmin() {
  const router = useRouter();
  const [comments, setComments] = React.useState([]);
  const [rules, setRules] = React.useState(null);
  const [wordsText, setWordsText] = React.useState('');
  const [rulesMessage, setRulesMessage] = React.useState('');
  const [lastSync, setLastSync] = React.useState(null);
  const [config, setConfig] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [filter, setFilter] = React.useState('review');
  const [platform, setPlatform] = React.useState('all');
  const [syncing, setSyncing] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState('');
  const [busy, setBusy] = React.useState({});
  const [replyOpen, setReplyOpen] = React.useState({});
  const [replyText, setReplyText] = React.useState({});
  const [rowError, setRowError] = React.useState({});
  const [showRules, setShowRules] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ad-comments');
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load.');
      setComments(data.comments);
      setRules(data.rules);
      setWordsText((data.rules.blockedWords || []).join('\n'));
      setLastSync(data.lastSync);
      setConfig(data.config);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  React.useEffect(() => { load(); }, [load]);

  const configured = config && config.adAccount && config.marketingToken && config.pageToken;

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/admin/ad-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed.');
      const r = data.result;
      setSyncMessage(`${r.added} new comment${r.added === 1 ? '' : 's'}, ${r.autoHidden} auto-hidden.`);
      await load();
    } catch (err) {
      setSyncMessage(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const act = async (comment, action) => {
    if (action === 'delete' && !confirm('Delete this comment from Meta? This can\'t be undone. (Hiding is usually better — the commenter won\'t notice.)')) return;
    const message = action === 'reply' ? (replyText[comment.id] || '').trim() : undefined;
    if (action === 'reply' && !message) return;
    setBusy((b) => ({ ...b, [comment.id]: action }));
    setRowError((e) => ({ ...e, [comment.id]: '' }));
    try {
      const res = await fetch('/api/admin/ad-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: comment.id, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed.');
      setComments((list) => list.map((c) => (c.id === comment.id ? data.comment : c)));
      if (action === 'reply') {
        setReplyText((t) => ({ ...t, [comment.id]: '' }));
        setReplyOpen((o) => ({ ...o, [comment.id]: false }));
      }
    } catch (err) {
      setRowError((e) => ({ ...e, [comment.id]: err.message }));
    } finally {
      setBusy((b) => ({ ...b, [comment.id]: null }));
    }
  };

  const saveRules = async () => {
    setRulesMessage('');
    const res = await fetch('/api/admin/ad-comments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rules, blockedWords: wordsText.split('\n') }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRulesMessage(data.error || 'Failed to save.');
      return;
    }
    setRules(data.rules);
    setWordsText(data.rules.blockedWords.join('\n'));
    setRulesMessage('Saved. Applies to new comments from the next sync.');
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const byPlatform = comments.filter((c) => platform === 'all' || c.platform === platform);
  const activeFilter = FILTERS.find((f) => f.id === filter);
  const visible = byPlatform.filter(activeFilter.test);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, byPlatform.filter(f.test).length]));

  return (
    <div style={{ minHeight: '100vh', background: T.paper, padding: '24px 16px 80px' }}>
      <Head>
        <title>{`Ad comments — ${BRAND.name} admin`}</title>
      </Head>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <Link href="/admin" style={{ fontSize: 11, color: T.soft, textDecoration: 'none' }}>&larr; Store admin</Link>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{BRAND.name} ad comments</div>
            <div style={{ fontSize: 12, color: T.soft, marginTop: 4 }}>
              Comments on your active Facebook &amp; Instagram ads.{' '}
              {lastSync ? `Last synced ${timeAgo(lastSync.at)} · ${lastSync.postsChecked} post${lastSync.postsChecked === 1 ? '' : 's'} checked.` : 'Not synced yet.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSync} disabled={syncing || !configured} style={{ ...S.btnFill, height: 36, padding: '0 16px', opacity: syncing || !configured ? 0.5 : 1 }}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button onClick={handleLogout} style={{ ...S.btnOutline, height: 36, padding: '0 14px' }}>Sign out</button>
          </div>
        </div>

        {syncMessage && <p style={{ fontSize: 13, margin: '0 0 12px' }}>{syncMessage}</p>}
        {loadError && <p style={{ fontSize: 13, color: '#b3261e', margin: '0 0 12px' }}>{loadError}</p>}
        {lastSync?.errors?.length > 0 && (
          <div style={{ ...card, borderColor: '#b3261e', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Last sync had problems</div>
            {lastSync.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: T.soft }}>{e}</div>)}
          </div>
        )}

        {config && !configured && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Connect your Meta account</div>
            <p style={{ fontSize: 13, color: T.soft, margin: '0 0 8px' }}>Set these in Vercel, then redeploy (DEPLOYMENT.md has the steps):</p>
            <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
              <li>{config.adAccount ? '✓' : '✗'} META_AD_ACCOUNT_ID</li>
              <li>{config.marketingToken ? '✓' : '✗'} META_MARKETING_ACCESS_TOKEN (ads_read)</li>
              <li>{config.pageToken ? '✓' : '✗'} META_PAGE_ACCESS_TOKEN (Page + Instagram comment permissions)</li>
            </ul>
          </div>
        )}

        {/* RULES */}
        {rules && (
          <div style={{ ...card, marginBottom: 16 }}>
            <button onClick={() => setShowRules((s) => !s)} style={{ ...plainBtn, width: '100%', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Auto-moderation rules</span>
              <span style={{ fontSize: 12, color: T.soft }}>
                {rules.autoHide ? 'Auto-hide on' : 'Auto-hide off'} · {showRules ? 'Close' : 'Edit'}
              </span>
            </button>
            {showRules && (
              <div style={{ marginTop: 14 }}>
                <label style={checkRow}>
                  <input type="checkbox" checked={rules.autoHide} onChange={(e) => setRules({ ...rules, autoHide: e.target.checked })} />
                  Automatically hide comments that match a rule (otherwise they're just flagged for review)
                </label>
                <label style={checkRow}>
                  <input type="checkbox" checked={rules.hideLinks} onChange={(e) => setRules({ ...rules, hideLinks: e.target.checked })} />
                  Comments with links
                </label>
                <label style={checkRow}>
                  <input type="checkbox" checked={rules.hideContactInfo} onChange={(e) => setRules({ ...rules, hideContactInfo: e.target.checked })} />
                  Comments with phone numbers or email addresses
                </label>
                <label style={{ ...formLabel, marginTop: 12 }}>Blocked words &amp; phrases — one per line</label>
                <textarea
                  value={wordsText}
                  onChange={(e) => setWordsText(e.target.value)}
                  rows={8}
                  style={{ ...formInput, height: 'auto', padding: 10, fontSize: 13, resize: 'vertical' }}
                />
                <p style={{ fontSize: 12, color: T.soft, margin: '6px 0 12px' }}>
                  Hidden comments stay visible to the person who wrote them and their friends, so they rarely notice. Meta&apos;s own
                  profanity filter (Page settings → Moderation) still applies on top of this.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={saveRules} style={{ ...S.btnFill, height: 36, padding: '0 16px' }}>Save rules</button>
                  {rulesMessage && <span style={{ fontSize: 12, color: T.soft }}>{rulesMessage}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ ...pill, ...(filter === f.id ? pillActive : {}) }}>
              {f.label} ({counts[f.id]})
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['all', 'facebook', 'instagram'].map((p) => (
            <button key={p} onClick={() => setPlatform(p)} style={{ ...pill, fontSize: 11, ...(platform === p ? pillActive : {}) }}>
              {p === 'all' ? 'Both' : p === 'facebook' ? 'Facebook' : 'Instagram'}
            </button>
          ))}
        </div>

        {/* LIST */}
        <div style={card}>
          {loading && <p style={{ fontSize: 13, color: T.soft, margin: 0 }}>Loading…</p>}
          {!loading && visible.length === 0 && (
            <p style={{ fontSize: 13, color: T.soft, margin: 0 }}>
              {filter === 'review' ? 'Nothing waiting for review.' : 'No comments here.'}
            </p>
          )}
          {visible.map((c) => (
            <div key={c.id} style={commentRow}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: T.soft }}>
                <span style={badge}>{c.platform === 'instagram' ? 'IG' : 'FB'}</span>
                <span style={{ color: T.ink, fontWeight: 600 }}>{c.authorName}</span>
                <span>{timeAgo(c.createdAt)}</span>
                {c.parentId && <span>· reply</span>}
                <span>· {STATUS_LABELS[c.status] || c.status}{c.autoHidden ? ' (auto)' : ''}</span>
              </div>
              <div style={{ fontSize: 14, margin: '6px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: c.hidden ? 0.6 : 1 }}>
                {c.text || <em style={{ color: T.soft }}>(no text — sticker, photo or GIF)</em>}
              </div>
              {c.flag && <div style={{ fontSize: 12, color: '#b3261e', marginBottom: 4 }}>⚑ {c.flag}</div>}
              <div style={{ fontSize: 11, color: T.soft, marginBottom: 8 }}>
                Ad: {(c.adNames || []).slice(0, 2).join(', ')}{(c.adNames || []).length > 2 ? ` +${c.adNames.length - 2} more` : ''}
                {c.permalink && <> · <a href={c.permalink} target="_blank" rel="noopener noreferrer" style={{ color: T.soft }}>View on Facebook</a></>}
              </div>
              {(c.replies || []).map((r, i) => (
                <div key={i} style={{ fontSize: 12, borderLeft: `2px solid ${T.line}`, paddingLeft: 8, margin: '0 0 6px' }}>
                  You replied: {r.text}
                </div>
              ))}

              {c.status !== 'deleted' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.status === 'new' && <button onClick={() => act(c, 'approve')} disabled={!!busy[c.id]} style={actionBtn}>Looks fine</button>}
                  {c.hidden
                    ? <button onClick={() => act(c, 'unhide')} disabled={!!busy[c.id]} style={actionBtn}>Unhide</button>
                    : <button onClick={() => act(c, 'hide')} disabled={!!busy[c.id]} style={actionBtn}>Hide</button>}
                  <button onClick={() => setReplyOpen((o) => ({ ...o, [c.id]: !o[c.id] }))} disabled={!!busy[c.id]} style={actionBtn}>Reply</button>
                  <button onClick={() => act(c, 'delete')} disabled={!!busy[c.id]} style={{ ...actionBtn, color: '#b3261e' }}>Delete</button>
                  {busy[c.id] && <span style={{ fontSize: 12, color: T.soft, alignSelf: 'center' }}>Working…</span>}
                </div>
              )}
              {replyOpen[c.id] && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input
                    value={replyText[c.id] || ''}
                    onChange={(e) => setReplyText((t) => ({ ...t, [c.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') act(c, 'reply'); }}
                    placeholder={`Reply as ${BRAND.name}…`}
                    style={formInput}
                  />
                  <button onClick={() => act(c, 'reply')} disabled={!!busy[c.id]} style={{ ...S.btnFill, height: 40, padding: '0 16px' }}>Send</button>
                </div>
              )}
              {rowError[c.id] && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 6 }}>{rowError[c.id]}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const card = { background: T.white, border: `1px solid ${T.line}`, padding: 16 };
const plainBtn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: T.sans, fontSize: 14, color: T.ink, textAlign: 'left' };
const checkRow = { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 8, cursor: 'pointer' };
const formInput = {
  width: '100%', height: 40, padding: '0 12px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box',
};
const formLabel = { display: 'block', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.soft, marginBottom: 6 };
const pill = {
  padding: '8px 12px', background: 'none', border: `1px solid ${T.line}`, borderRadius: 999, cursor: 'pointer',
  fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: T.soft,
};
const pillActive = { background: T.ink, color: T.white, borderColor: T.ink };
const commentRow = { padding: '14px 0', borderBottom: `1px solid ${T.line}` };
const badge = { fontSize: 10, fontWeight: 700, border: `1px solid ${T.line}`, padding: '1px 5px', color: T.ink };
const actionBtn = {
  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${T.line}`,
  background: 'none', padding: '8px 12px', cursor: 'pointer', fontFamily: T.sans, color: T.ink,
};
