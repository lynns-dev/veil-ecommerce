// Called right before the shopper submits, once every field is filled in.
// Two jobs: (1) sync the PaymentIntent's amount in case it drifted from
// creation time (a discount code applied after the payment form first
// rendered), and (2) save the pending-order record the webhook needs to
// fulfill this order — items/eventId/url/paymentMethod/attribution are all
// only known this late, not when the intent was first created.

import { getStripe } from '../../../lib/stripeServer';
import { savePendingOrder } from '../../../lib/stripePendingOrders';

function shippingParam(shipping) {
  if (!shipping?.address || !shipping?.city) return undefined;
  return {
    name: `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || undefined,
    phone: shipping.phone || undefined,
    address: {
      line1: shipping.address,
      line2: shipping.apt || undefined,
      city: shipping.city,
      state: shipping.state || undefined,
      postal_code: shipping.zip || undefined,
      country: 'US',
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    const { paymentIntentId, amount, items, email, shipping, eventId, url, paymentMethod, attribution } = req.body || {};

    if (!paymentIntentId) return res.status(400).json({ error: 'Missing payment intent' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in cart' });

    await stripe.paymentIntents.update(paymentIntentId, {
      amount: Math.round(Number(amount) * 100),
      receipt_email: email || undefined,
      shipping: shippingParam(shipping),
    });

    await savePendingOrder(paymentIntentId, {
      amount: Number(amount), items, eventId, url,
      paymentMethod: paymentMethod || 'Card',
      attribution: attribution || null,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Stripe update-intent error:', err);
    return res.status(500).json({ error: err.message || 'Could not prepare checkout.' });
  }
}
