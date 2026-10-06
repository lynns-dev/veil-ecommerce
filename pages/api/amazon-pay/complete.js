// Amazon sends the shopper back to /amazon-pay/return, which calls this
// with the checkout session id. Captures the charge (completeCheckoutSession)
// and records the order through the same fulfillOrder() pipeline as card
// orders — this request comes from the shopper's own browser, so the Meta
// Purchase carries their real IP/user agent/cookies.
//
// Safe to call twice (a refresh of the return page): the pending record is
// marked resolved once, and a resolved ref just returns the same order.
import { amazonPayConfig, loadPending, savePending, completeCheckout } from '../../../lib/amazonPay';
import { fulfillOrder } from '../../../lib/orderFulfillment';

function normalizeShipping(s) {
  if (!s) return null;
  return {
    name: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
    address: s.address || '', apt: s.apt || '', city: s.city || '',
    state: s.state || '', zip: s.zip || '', phone: s.phone || '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!amazonPayConfig().enabled) return res.status(404).json({ error: 'Amazon Pay is not available.' });

  const { ref, checkoutSessionId } = req.body || {};
  if (!checkoutSessionId) return res.status(400).json({ error: 'Missing Amazon checkout session.' });

  try {
    const pending = await loadPending(ref);
    if (!pending) return res.status(404).json({ error: 'This checkout has expired. Please start again.' });
    const summary = (orderId) => ({ orderId, eventId: pending.eventId, amount: pending.amount, items: pending.items });
    if (pending.resolved) return res.status(200).json(summary(pending.orderId));

    const session = await completeCheckout(checkoutSessionId, pending.amount);
    if (session?.statusDetails?.state !== 'Completed' || !session.chargeId) {
      const reason = session?.statusDetails?.reasonDescription || session?.statusDetails?.reasonCode;
      return res.status(402).json({ error: reason || 'Amazon Pay did not approve this payment.' });
    }

    const buyer = session.buyer || {};
    await fulfillOrder({
      id: session.chargeId,
      amount: pending.amount,
      items: pending.items,
      eventId: pending.eventId,
      url: pending.url,
      req,
      paymentMethod: 'Amazon Pay',
      attribution: pending.attribution,
      email: pending.email || buyer.email || '',
      shipping: normalizeShipping(pending.shipping),
      processor: 'amazon_pay',
      captureId: session.chargePermissionId || null,
      shippingProtection: pending.shippingProtection,
      sessionId: pending.sessionId,
    });
    await savePending(ref, { ...pending, resolved: true, orderId: session.chargeId });
    return res.status(200).json(summary(session.chargeId));
  } catch (err) {
    console.error('Amazon Pay complete error:', err);
    return res.status(500).json({ error: err.message || 'Amazon Pay could not complete this payment.' });
  }
}
