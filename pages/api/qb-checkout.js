// Charges a card directly via the QuickBooks Payments Charges API.
//
// The card is sent straight to the charge request rather than tokenized
// client-side first — see the comment on chargeCard in lib/qbPaymentsServer.js
// for why: a separate tokenize-then-charge-via-token flow returned every
// verification field (AVS, CVV) as N/A on real transactions and got
// auto-voided by Intuit's risk engine. Charging directly means raw card
// data does pass through this server for the duration of the request
// (never logged or stored).
//
// The access token is fetched from lib/qbServerAuth.js, which transparently
// refreshes it (using a refresh token persisted in the KV store) whenever
// it's close to expiring. Connect the QuickBooks account once via
// /api/qb-auth/connect — after that this route needs no manual token
// rotation.
//
// Unlike Stripe's redirect-capable methods, a QuickBooks card charge always
// completes in this same request/response — there's no off-site hop — so
// fulfillment happens directly here rather than via a webhook.

import { chargeCard } from '../../lib/qbPaymentsServer';
import { fulfillOrder } from '../../lib/orderFulfillment';

// Same flat shape used by the Stripe/PayPal checkout paths and rendered in
// the admin Orders tab ({ name, address, apt, city, state, zip, phone }) —
// the raw checkout form uses firstName/lastName instead of a single name
// field, so that needs collapsing here rather than storing the form's own shape.
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { card, amount, items, email, shipping, billing, eventId, url, paymentMethod, attribution } = req.body || {};

    if (!card?.number || !card?.expMonth || !card?.expYear || !card?.cvc) {
      return res.status(400).json({ error: 'Missing card details' });
    }
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in cart' });

    // Billing address (for AVS) defaults to the shipping address, but can
    // differ if the shopper unchecked "same as shipping".
    const billingAddress = billing || shipping;

    const charge = await chargeCard({
      card: {
        number: card.number,
        expMonth: card.expMonth,
        expYear: card.expYear,
        cvc: card.cvc,
        name: card.name,
        street: billingAddress?.address,
        city: billingAddress?.city,
        region: billingAddress?.state,
        postalCode: billingAddress?.zip,
        country: 'US',
      },
      amount,
    });

    await fulfillOrder({
      id: charge.id,
      amount: Number(amount),
      items,
      eventId,
      url,
      req,
      paymentMethod: paymentMethod || 'QuickBooks',
      attribution,
      email: email || '',
      shipping: normalizeFormShipping(shipping),
      processor: 'quickbooks',
    });

    return res.status(200).json({ id: charge.id, status: charge.status });
  } catch (error) {
    console.error('QuickBooks Payments error:', error);
    return res.status(500).json({ error: error.message });
  }
}
