// Admin → Visitors: the most recent visitors (one per person per day, newest
// first) with where they came from, their URL parameters, and what they did
// — pages viewed (lib/journeys.js), scroll depth and the last field typed in
// (pages/api/track/heartbeat.js), and their cart trail (lib/cartFunnel.js).
// Shaped the same as the Smells Iconic admin's Visitors tab.
// Behind the admin session check in middleware.js like every /api/admin route.
import { getRecentVisitors } from '../../../lib/analyticsStore';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function pipeline(commands) {
  if (commands.length === 0) return [];
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`KV pipeline failed: ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

function parseList(list) {
  return (list || []).map((raw) => { try { return JSON.parse(raw); } catch { return null; } }).filter(Boolean);
}

function parseOne(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// Pieces the browser-side status line needs, from the person's path and
// cart trail.
function buildJourney(steps, trail, last) {
  const times = [...steps.map((s) => s.t), ...trail.map((s) => s.t), last?.ts].filter(Number.isFinite);
  if (times.length === 0) return null;
  const pages = [...new Set(steps.map((s) => s.l).filter((l) => !['Add to cart', 'Checkout', 'Payment step', 'Purchase'].includes(l)))].slice(-12);
  const cart = [...new Set(trail.filter((s) => s.k === 'added').map((s) => s.l.replace(/^Added /, '')))];
  const addedInPath = steps.some((s) => s.l === 'Add to cart');
  const checkout = steps.find((s) => s.l === 'Checkout' || s.l === 'Payment step') || trail.find((s) => s.k === 'checkout_view');
  const purchase = [...steps].reverse().find((s) => s.l === 'Purchase') || trail.find((s) => s.k === 'purchased');
  return {
    lastSeen: Math.max(...times),
    pages,
    scroll: last?.scroll || null,
    lastField: last?.activeField ? { label: last.activeField, path: last.path || null } : null,
    cart: cart.length ? cart : (addedInPath ? ['an item'] : []),
    checkoutAt: checkout ? checkout.t : null,
    purchased: purchase ? { amount: purchase.v || null } : null,
    cartSteps: trail.map((s) => s.l),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const visits = await getRecentVisitors(Math.min(Number(req.query.limit) || 300, 300));
    const results = await pipeline(visits.flatMap((v) => {
      const id = v.vid || v.sessionId;
      return [
        v.vid ? ['LRANGE', `journey:${v.vid}`, '0', '-1'] : ['LRANGE', 'journey:__none__', '0', '-1'],
        ['LRANGE', `cartfunnel:trail:${id}`, '0', '-1'],
        ['GET', `visitor_last:${v.sessionId}`],
      ];
    }));
    const visitors = visits.map((v, i) => {
      const steps = parseList(results[i * 3]);
      const trail = parseList(results[i * 3 + 1]);
      const last = parseOne(results[i * 3 + 2]);
      return {
        visitorId: v.vid || null,
        sessionId: v.sessionId,
        source: v.source || 'Direct',
        campaign: v.campaign || null,
        landing: v.path || '/',
        referrer: v.referrer || null,
        params: v.params || {},
        city: v.city || null,
        country: v.country && v.country !== 'XX' ? v.country : null,
        device: v.device || null,
        outsideServiceArea: Boolean(v.outsideServiceArea),
        visitNumber: v.visitNumber || null,
        ts: v.ts,
        journey: buildJourney(steps, trail, last),
      };
    });
    return res.status(200).json({ visitors });
  } catch (err) {
    console.error('Visitors fetch failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
