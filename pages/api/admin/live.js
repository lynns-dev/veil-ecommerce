// Live visitor count + funnel-stage breakdown. Reads whatever visitor:*
// keys currently exist in KV — each one naturally expires ~25s after a
// browser stops sending heartbeats (see pages/api/track/heartbeat.js), so
// no separate cleanup is needed.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'KV_REST_API_URL / KV_REST_API_TOKEN are not set.' });
  }

  try {
    const keysRes = await fetch(`${KV_URL}/keys/visitor:*`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const keysData = await keysRes.json();
    const keys = keysData.result || [];

    if (keys.length === 0) {
      return res.status(200).json({ count: 0, byStage: {} });
    }

    const mgetRes = await fetch(`${KV_URL}/mget/${keys.join('/')}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const mgetData = await mgetRes.json();
    const stages = mgetData.result || [];

    const byStage = {};
    for (const stage of stages) {
      if (!stage) continue;
      byStage[stage] = (byStage[stage] || 0) + 1;
    }

    return res.status(200).json({ count: keys.length, byStage });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
