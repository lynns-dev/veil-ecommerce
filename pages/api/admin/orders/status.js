// Bookkeeping-only status changes (cancel/archive/restore) — no payment API
// call, unlike refund.js. "Restore" always sets status back to 'paid'; if an
// order needs money back too, that's a separate explicit Refund action.

import { updateOrderStatus } from '../../../../lib/analyticsStore';

const ALLOWED_STATUSES = ['paid', 'cancelled', 'archived'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, status } = req.body || {};
    if (!orderId || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid order id or status' });
    }

    const updated = await updateOrderStatus(orderId, { status });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    return res.status(200).json({ order: updated });
  } catch (err) {
    console.error('Order status update error:', err);
    return res.status(500).json({ error: err.message });
  }
}
