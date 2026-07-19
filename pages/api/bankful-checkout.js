// Starts a Bankful hosted-page payment. No card data ever reaches this
// route — the shopper enters it on Bankful's own page after being
// redirected there, so this only ever handles order metadata (items,
// amount, address) plus building the signed payload Bankful requires.
//
// Fulfillment does NOT happen here — Bankful's hosted flow always
// navigates the shopper's browser off-site, so a client-triggered "it
// worked" call back to us can't be relied on to ever fire. This route's
// only job is: save the order details we'll need later (see
// lib/bankfulPendingOrders.js) keyed by our own order id, then hand back
// the URL to redirect to. The actual order gets recorded by
// /api/bankful-webhook, once Bankful's signed async callback confirms the
// payment really went through.

import { buildHostedPagePayload, initiateHostedPagePayment } from '../../lib/bankfulServer';
import { savePendingOrder } from '../../lib/bankfulPendingOrders';

// Same flat shape used by the retired Stripe/PayPal/QuickBooks checkout
// paths and rendered in the admin Orders tab
// ({ name, address, apt, city, state, zip, phone }).
function normalizeFormShipping(shipping) {
  if (!shipping?.address || !shipping?.city) return null;
  return {
    name: `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim(),
    address: shipping.address,
    apt: shipping.apt || '',
    city: shipping.city,
    state: shipping.state || '',
    zip: shipping.zip || '',
    phone: shipping.phone || '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return res.status(500).json({ error: 'NEXT_PUBLIC_BASE_URL is not set.' });
  }

  try {
    const { amount, items, email, shipping, eventId, url, attribution } = req.body || {};

    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in cart' });
    if (!eventId) return res.status(400).json({ error: 'Missing order reference' });

    await savePendingOrder(eventId, {
      amount: Number(amount),
      items,
      eventId,
      url,
      email: email || '',
      shipping: normalizeFormShipping(shipping),
      attribution: attribution || null,
    });

    const payload = buildHostedPagePayload({
      amount,
      orderId: eventId,
      email,
      firstName: shipping?.firstName,
      lastName: shipping?.lastName,
      phone: shipping?.phone,
      address: shipping?.address,
      city: shipping?.city,
      state: shipping?.state,
      zip: shipping?.zip,
      country: 'US',
      baseUrl,
    });

    const redirectUrl = await initiateHostedPagePayment(payload);
    return res.status(200).json({ redirectUrl });
  } catch (err) {
    console.error('Bankful checkout error:', err);
    return res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
}
