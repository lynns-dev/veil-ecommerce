// Public, fire-and-forget presence ping. Each active visitor's browser
// calls this every ~10s with its session id and current funnel stage; the
// KV entry expires quickly (25s) so a visitor who closes the tab drops out
// of the live count on its own, no cleanup job needed.
//
// A visitor who stops doing anything drops out too, even though their
// browser keeps pinging — see lib/presence.js. That is decided here, on the
// server, so it also covers tabs still running a copy of the site loaded
// before the browser side learned to go quiet, and bots that never will.
//
// City/country come from Vercel's edge network, which sets these headers
// on every request automatically — no third-party geolocation API needed.

import { isExcludedTraffic } from '../../../lib/ipFilter';
import { PRESENCE_TTL_SECONDS, IDLE_LIMIT_MS, SESSION_ID_RE, activitySignature } from '../../../lib/presence';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
// Separate, much longer-lived record of the last page/field a visitor
// touched — the 25s presence key above only exists while they're actively
// on the site, but the admin's Visitors tab (past traffic, already
// captured for the day by lib/analyticsStore.js's logVisitor) wants this
// to still be there once they've left. 24h matches that tab's own
// per-day dedup window.
const LAST_TOUCH_TTL_SECONDS = 60 * 60 * 24;
const ALLOWED_STAGES = [
  'browsing', 'cart_open', 'checkout',
  'checkout_shipping', 'checkout_payment',
  'purchased',
];

// Trims a client-supplied string to a sane length so a malformed/hostile
// payload can't bloat the KV entry — none of these fields are ever used for
// anything but display in the admin live view.
function clip(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

// Commands go to KV as JSON arrays rather than being spelled into the URL,
// so nothing in a client-supplied value can change the command — the old
// URL form (`/set/visitor:<id>?EX=25`) lost its expiry, leaving a permanent
// "live" visitor, if an id ever contained a `?` or `#`.
async function pipeline(commands) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`KV pipeline failed: ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

function parseJson(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function clampScrollPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { sessionId, stage, path, source, campaign, scrollPct, activeField, lastActiveAt } = req.body || {};
  if (
    typeof sessionId === 'string' &&
    SESSION_ID_RE.test(sessionId) &&
    ALLOWED_STAGES.includes(stage) &&
    KV_URL &&
    KV_TOKEN &&
    !isExcludedTraffic(req)
  ) {
    try {
      // Vercel sets these headers at the edge for every request — no external
      // geo-IP lookup needed. Country falls back to 'XX' locally / off Vercel.
      const city = req.headers['x-vercel-ip-city'];
      const country = req.headers['x-vercel-ip-country'] || 'XX';
      const now = Date.now();
      const seen = {
        stage,
        path: clip(path, 200),
        scrollPct: clampScrollPct(scrollPct),
        activeField: clip(activeField, 60),
      };

      // Has anything happened since the last ping? The previous ping's
      // signature rides on the last-touch record that is written below
      // anyway. Unchanged for IDLE_LIMIT_MS means the page is merely open,
      // not in use, and the presence entry is left to expire.
      const [previousRaw] = await pipeline([['GET', `visitor_last:${sessionId}`]]);
      const previous = parseJson(previousRaw);
      const sig = activitySignature({ ...seen, lastActiveAt: Number.isFinite(lastActiveAt) ? lastActiveAt : null });
      const changedAt = previous && previous.sig === sig && Number.isFinite(previous.changedAt) ? previous.changedAt : now;
      const idle = now - changedAt > IDLE_LIMIT_MS;

      const value = JSON.stringify({
        ...seen,
        city: city ? decodeURIComponent(city) : null,
        country,
        source: clip(source, 80),
        campaign: clip(campaign, 80),
        // When this ping arrived — pages/api/admin/live.js only counts an
        // entry whose own timestamp is recent.
        ts: now,
      });
      const lastTouch = JSON.stringify({
        path: seen.path,
        activeField: seen.activeField,
        ts: now,
        sig,
        changedAt,
      });
      await pipeline([
        ...(!idle ? [['SET', `visitor:${sessionId}`, value, 'EX', String(PRESENCE_TTL_SECONDS)]] : []),
        ['SET', `visitor_last:${sessionId}`, lastTouch, 'EX', String(LAST_TOUCH_TTL_SECONDS)],
      ]);
    } catch (err) {
      console.error('Heartbeat failed:', err);
    }
  }

  return res.status(204).end();
}
