// Issues a full refund through whichever processor actually took the
// payment, then marks the order refunded. The client already has the full
// order object on screen (from GET /api/admin/orders), so it just passes
// back the ids needed to refund — no extra KV lookup required before
// calling the payment API. This route is admin-only (protected by
// middleware.js's session check on /api/admin/*).

import { getStripe } from '../../../../lib/stripeServer';
import { refundCapture } from '../../../../lib/paypal';
import { updateOrderStatus } from '../../../../lib/analyticsStore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, processor, captureId } = req.body || {};
    if (!orderId || !processor) return res.status(400).json({ error: 'Missing order id or processor' });

    if (processor === 'stripe') {
      const stripe = getStripe();
      await stripe.refunds.create({ payment_intent: orderId });
    } else if (processor === 'paypal') {
      if (!captureId) return res.status(400).json({ error: 'Missing PayPal capture id — this order predates refund support.' });
      await refundCapture(captureId);
    } else {
      return res.status(400).json({ error: `Don't know how to refund a "${processor}" order.` });
    }

    const updated = await updateOrderStatus(orderId, { status: 'refunded' });
    if (!updated) return res.status(404).json({ error: 'Refunded, but could not find the order to update its status.' });
    return res.status(200).json({ order: updated });
  } catch (err) {
    console.error('Order refund error:', err);
    return res.status(500).json({ error: err.message });
  }
}
