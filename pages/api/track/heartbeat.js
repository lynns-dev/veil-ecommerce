// Public, fire-and-forget presence ping. Each active visitor's browser
// calls this every ~10s with its session id and current funnel stage; the
// KV entry expires quickly (25s) so a visitor who closes the tab drops out
// of the live count on its own, no cleanup job needed.
//
// City/country come from Vercel's edge network, which sets these headers
// on every request automatically — no third-party geolocation API needed.

import { isExcludedIp } from '../../../lib/ipFilter';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const TTL_SECONDS = 25;
const ALLOWED_STAGES = ['browsing', 'cart_open', 'checkout', 'purchased'];

// Trims a client-supplied string to a sane length so a malformed/hostile
// payload can't bloat the KV entry — none of these fields are ever used for
// anything but display in the admin live view.
function clip(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
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

  const { sessionId, stage, path, source, campaign, scrollPct } = req.body || {};
  if (
    typeof sessionId === 'string' &&
    sessionId.length > 0 &&
    sessionId.length < 100 &&
    ALLOWED_STAGES.includes(stage) &&
    KV_URL &&
    KV_TOKEN &&
    !isExcludedIp(req)
  ) {
    try {
      // Vercel sets these headers at the edge for every request — no external
      // geo-IP lookup needed. Country falls back to 'XX' locally / off Vercel.
      const city = req.headers['x-vercel-ip-city'];
      const country = req.headers['x-vercel-ip-country'] || 'XX';
      const value = JSON.stringify({
        stage,
        city: city ? decodeURIComponent(city) : null,
        country,
        path: clip(path, 200),
        source: clip(source, 80),
        campaign: clip(campaign, 80),
        scrollPct: clampScrollPct(scrollPct),
      });
      await fetch(`${KV_URL}/set/visitor:${sessionId}?EX=${TTL_SECONDS}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        body: value,
      });
    } catch (err) {
      console.error('Heartbeat failed:', err);
    }
  }

  return res.status(204).end();
}
