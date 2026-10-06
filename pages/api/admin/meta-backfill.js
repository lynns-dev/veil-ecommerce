// One-time backfill of orders placed before every order carried its own
// Meta Purchase record (order.meta, lib/metaPurchase.js). GET lists the
// last 7 days' paid orders that were never reported through that pipeline;
// POST { orderIds } sends a Purchase for the ones the admin ticked.
//
// Admin-only via middleware.js. The admin picks the orders rather than this
// sending everything, because some of these may already have reached Meta
// at checkout under an event_id that wasn't saved — resending those would
// count them twice. Each sent order gets order.meta, so the hourly
// /api/meta/resend-purchases cron retries any Meta didn't accept and never
// offers it here again.

import { getOrders, dateKeysForRange, updateOrderStatus } from '../../../lib/analyticsStore';
import { isBackfillCandidate, backfillMetaRecord, sendOrderPurchase } from '../../../lib/metaPurchase';

async function candidates() {
  const orders = (await Promise.all(dateKeysForRange('7d').map((key) => getOrders(key)))).flat();
  return orders
    .filter((o) => isBackfillCandidate(o))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const list = await candidates();
      return res.status(200).json({
        orders: list.map((o) => ({
          id: o.id,
          createdAt: o.createdAt,
          amount: o.amount,
          email: o.email || '',
          fromAd: Boolean(o.attribution?.fbclid),
        })),
      });
    }

    if (req.method === 'POST') {
      const ids = new Set(Array.isArray(req.body?.orderIds) ? req.body.orderIds.map(String) : []);
      const selected = (await candidates()).filter((o) => ids.has(String(o.id)));
      const results = [];
      for (const order of selected) {
        const meta = await sendOrderPurchase(order, backfillMetaRecord(order));
        await updateOrderStatus(order.id, { meta });
        results.push({ id: order.id, sent: meta.sent, error: meta.sent ? null : meta.lastError });
      }
      return res.status(200).json({ results });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Meta backfill error:', err);
    return res.status(500).json({ error: err.message });
  }
}
