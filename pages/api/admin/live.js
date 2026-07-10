// Live visitor count + funnel-stage breakdown, plus a Shopify-Live-View-style
// last-5-minutes activity summary: per-minute bucketed counts and a recent
// event feed. Visitor presence reads whatever visitor:* keys currently exist
// in KV — each one naturally expires ~25s after a browser stops sending
// heartbeats (see pages/api/track/heartbeat.js), so no cleanup job is needed.
// Activity data comes from the timestamped event log in lib/analyticsStore.js.

import { getRecentEvents } from '../../../lib/analyticsStore';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const WINDOW_MS = 5 * 60 * 1000;
const BUCKET_MS = 60 * 1000;
const BUCKET_COUNT = WINDOW_MS / BUCKET_MS;

async function getLiveVisitors() {
  const keysRes = await fetch(`${KV_URL}/keys/visitor:*`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const keysData = await keysRes.json();
  const keys = keysData.result || [];

  if (keys.length === 0) return { count: 0, byStage: {} };

  const mgetRes = await fetch(`${KV_URL}/mget/${keys.join('/')}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const mgetData = await mgetRes.json();
  const stages = mgetData.result || [];

  const byStage = {};
  for (const stage of stages) {
    if (!stage) continue;
    byStage[stage] = (byStage[stage] || 0) + 1;
  }
  return { count: keys.length, byStage };
}

function buildActivity(events) {
  const now = Date.now();
  const buckets = Array.from({ length: BUCKET_COUNT }, () => ({ addtocart: 0, checkout_start: 0, purchase: 0 }));

  const counts = { addtocart: 0, checkout_start: 0, purchase: 0, revenue: 0 };
  for (const ev of events) {
    const age = now - ev.ts;
    const bucketIndex = BUCKET_COUNT - 1 - Math.min(BUCKET_COUNT - 1, Math.floor(age / BUCKET_MS));
    if (buckets[bucketIndex] && ev.type in buckets[bucketIndex]) buckets[bucketIndex][ev.type] += 1;
    if (ev.type in counts) counts[ev.type] += 1;
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
    const [liveVisitors, recentEvents] = await Promise.all([getLiveVisitors(), getRecentEvents(WINDOW_MS)]);
    return res.status(200).json({ ...liveVisitors, activity: buildActivity(recentEvents) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
