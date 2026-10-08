// Live visitor count + funnel-stage breakdown, plus a Shopify-Live-View-style
// last-5-minutes activity summary: per-minute bucketed counts and a recent
// event feed. Visitor presence reads the visitor:* keys in KV — each one
// expires ~25s after a browser stops sending heartbeats, and the heartbeat
// endpoint stops refreshing it once a visitor has gone idle (see
// pages/api/track/heartbeat.js, lib/presence.js) — and counts only the ones
// whose own timestamp is recent, so an entry that never expires for any
// reason can't sit here as a live visitor.
// Activity data comes from the timestamped event log in lib/analyticsStore.js.

import { getRecentEvents, getRecentVisitors, getLastTouched } from '../../../lib/analyticsStore';
import { isFreshPresence } from '../../../lib/presence';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const WINDOW_MS = 5 * 60 * 1000;
const BUCKET_MS = 60 * 1000;
const BUCKET_COUNT = WINDOW_MS / BUCKET_MS;

function parseVisitorValue(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Sent as a JSON array rather than spelled into the URL: session ids are
// part of these key names, and one containing a `/` or `?` would have been
// read as part of the request path.
async function kv(command) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'KV command failed.');
  return data.result;
}

async function getLiveVisitors() {
  const keys = (await kv(['KEYS', 'visitor:*'])) || [];
  const empty = { count: 0, byStage: {}, byCountry: {}, visitors: [] };
  if (keys.length === 0) return empty;

  const values = (await kv(['MGET', ...keys])) || [];
  const now = Date.now();
  // Each value stays paired with its own key: a key that expired between the
  // two reads comes back empty, and dropping it from a separate list used to
  // shift every later visitor onto the wrong session id.
  const live = keys
    .map((key, i) => ({ sessionId: key.slice('visitor:'.length), v: parseVisitorValue(values[i]) }))
    .filter(({ v }) => isFreshPresence(v, now));
  if (live.length === 0) return empty;
  const visitors = live.map(({ v }) => v);

  const byStage = {};
  // Keyed by country code; each entry tracks its own count plus a per-city
  // breakdown so the admin view can show "New York, US" not just "US".
  const byCountry = {};
  for (const v of visitors) {
    if (v.stage) byStage[v.stage] = (byStage[v.stage] || 0) + 1;
    const country = v.country || 'XX';
    if (!byCountry[country]) byCountry[country] = { count: 0, cities: {} };
    byCountry[country].count += 1;
    if (v.city) byCountry[country].cities[v.city] = (byCountry[country].cities[v.city] || 0) + 1;
  }
  for (const country of Object.keys(byCountry)) {
    byCountry[country].cities = Object.entries(byCountry[country].cities)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Per-visitor detail (source/page/scroll depth) for the admin "who's here
  // right now" list — keys.map so each row still has a stable id (the
  // session id) even though it's stripped out of the stored JSON blob itself.
  const detailed = live.map(({ sessionId, v }) => ({
    sessionId,
    stage: v.stage || 'browsing',
    path: v.path || null,
    source: v.source || null,
    campaign: v.campaign || null,
    scrollPct: typeof v.scrollPct === 'number' ? v.scrollPct : null,
    city: v.city || null,
    country: v.country || 'XX',
    activeField: v.activeField || null,
  }));

  return { count: live.length, byStage, byCountry, visitors: detailed };
}

function buildActivity(events) {
  const now = Date.now();
  const buckets = Array.from({ length: BUCKET_COUNT }, () => ({ addtocart: 0, checkout_start: 0, purchase: 0 }));

  const counts = { addtocart: 0, checkout_start: 0, purchase: 0, revenue: 0 };
  // Headline counts are per visitor, not per action — someone adding 3
  // items or reloading checkout twice still only counts once. The bucket
  // sparkline and recent feed below stay un-deduped since those represent
  // a raw activity pulse, not a visitor total.
  const seenSessions = { addtocart: new Set(), checkout_start: new Set() };
  for (const ev of events) {
    const age = now - ev.ts;
    const bucketIndex = BUCKET_COUNT - 1 - Math.min(BUCKET_COUNT - 1, Math.floor(age / BUCKET_MS));
    if (buckets[bucketIndex] && ev.type in buckets[bucketIndex]) buckets[bucketIndex][ev.type] += 1;

    if (ev.type === 'addtocart' || ev.type === 'checkout_start') {
      if (ev.sessionId && seenSessions[ev.type].has(ev.sessionId)) continue;
      if (ev.sessionId) seenSessions[ev.type].add(ev.sessionId);
      counts[ev.type] += 1;
    } else if (ev.type in counts) {
      counts[ev.type] += 1;
    }
    if (ev.type === 'purchase') counts.revenue += Number(ev.amount) || 0;
  }

  const recent = events
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 15)
    .map((ev) => ({ type: ev.type, ts: ev.ts, productName: ev.productName, amount: ev.amount }));

  return { counts, buckets, recent };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'KV_REST_API_URL / KV_REST_API_TOKEN are not set.' });
  }

  try {
    const [liveVisitors, recentEvents, pastVisitors] = await Promise.all([
      getLiveVisitors(), getRecentEvents(WINDOW_MS), getRecentVisitors(10),
    ]);
    const lastTouched = await getLastTouched(pastVisitors.map((v) => v.sessionId));
    const pastVisitorsWithLastTouch = pastVisitors.map((v) => ({
      ...v,
      lastPath: lastTouched[v.sessionId]?.path || null,
      lastActiveField: lastTouched[v.sessionId]?.activeField || null,
    }));
    return res.status(200).json({ ...liveVisitors, activity: buildActivity(recentEvents), pastVisitors: pastVisitorsWithLastTouch });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
