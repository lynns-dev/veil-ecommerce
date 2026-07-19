// The authoritative source of truth for "did this Bankful order actually
// get paid." The hosted payment page always redirects the shopper's
// browser off-site to pay, so their browser might never make it back
// (closed tab, crashed connection) — this async server-to-server callback
// is the only reliable way to know a payment succeeded regardless of what
// happened to the browser afterward. Register this URL as url_callback on
// every hosted-page request (already wired in lib/bankfulServer.js).
//
// Bankful's docs explicitly warn callbacks may be delivered more than once
// for the same transaction and that we're responsible for ignoring
// duplicates — handled here the same way the old Stripe webhook did it:
// delete the pending-order record right after fulfilling, so a redelivered
// callback finds nothing and no-ops instead of fulfilling twice.

import { verifyCallbackSignature } from '../../lib/bankfulServer';
import { getPendingOrder, deletePendingOrder } from '../../lib/bankfulPendingOrders';
import { fulfillOrder } from '../../lib/orderFulfillment';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const fields = req.body || {};

  if (!verifyCallbackSignature(fields)) {
    console.error('Bankful webhook signature verification failed:', fields.XTL_ORDER_ID);
    return res.status(400).end('Invalid signature');
  }

  if (fields.TRANS_STATUS_NAME !== 'APPROVED') {
    // DECLINED/PENDING — nothing to fulfill. Return 200 either way so
    // Bankful doesn't keep retrying a callback we've already looked at.
    return res.status(200).json({ received: true });
  }

  try {
    const orderId = fields.XTL_ORDER_ID;
    const pending = await getPendingOrder(orderId);
    if (pending) {
      await fulfillOrder({
        id: String(fields.TRANS_ORDER_ID),
        amount: pending.amount,
        items: pending.items,
        eventId: pending.eventId,
        url: pending.url,
        req,
        paymentMethod: 'Card',
        attribution: pending.attribution,
        email: pending.email,
        shipping: pending.shipping,
        processor: 'bankful',
      });
      await deletePendingOrder(orderId);
    }
    // No pending record means this was already fulfilled (a redelivered
    // callback) or the order never went through /api/bankful-checkout —
    // either way, nothing left to do.
  } catch (err) {
    console.error('Bankful webhook fulfillment failed:', err);
    return res.status(500).end();
  }

  return res.status(200).json({ received: true });
}
