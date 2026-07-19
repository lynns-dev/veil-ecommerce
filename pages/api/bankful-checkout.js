// Charges a card directly via Bankful's Payment Service (CAPTURE) API.
//
// Unlike a hosted-page/redirect integration, the card fields collected on
// /checkout are sent straight through to Bankful from this route — see the
// PCI-scope note at the top of lib/bankfulServer.js. Nothing here is
// logged or persisted; the card fields exist only for the duration of this
// request.
//
// A Bankful charge always completes in this same request/response — there's
// no off-site hop — so fulfillment happens directly here rather than via a
// webhook.

import { chargeCard } from '../../lib/bankfulServer';
import { fulfillOrder } from '../../lib/orderFulfillment';

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

  try {
    const { card, amount, items, email, shipping, billing, eventId, url, attribution } = req.body || {};

    if (!card?.number || !card?.expMonth || !card?.expYear || !card?.cvc) {
      return res.status(400).json({ error: 'Missing card details' });
    }
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in cart' });
    if (!eventId) return res.status(400).json({ error: 'Missing order reference' });

    // Billing address (for the card's AVS check) defaults to the shipping
    // address, but can differ if the shopper unchecked "same as shipping".
    const billingAddress = billing || shipping;

    const charge = await chargeCard({
      amount,
      orderId: eventId,
      cardNumber: card.number,
      expMonth: card.expMonth,
      expYear: card.expYear,
      cvc: card.cvc,
      email,
      firstName: billingAddress?.firstName,
      lastName: billingAddress?.lastName,
      phone: billingAddress?.phone,
      address: billingAddress?.address,
      city: billingAddress?.city,
      state: billingAddress?.state,
      zip: billingAddress?.zip,
      country: 'US',
    });

    await fulfillOrder({
      id: String(charge.TRANS_ORDER_ID),
      amount: Number(amount),
      items,
      eventId,
      url,
      req,
      paymentMethod: 'Card',
      attribution,
      email: email || '',
      shipping: normalizeFormShipping(shipping),
      processor: 'bankful',
    });

    return res.status(200).json({ id: charge.TRANS_ORDER_ID, status: charge.TRANS_STATUS_NAME });
  } catch (err) {
    console.error('Bankful checkout error:', err);
    return res.status(500).json({ error: err.message || 'Payment failed' });
  }
}
