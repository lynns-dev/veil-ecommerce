// Charges a QuickBooks Payments card token via the Payments API.
//
// chargeCard (lib/qbPaymentsServer.js) authorizes and captures funds
// synchronously within that one call — no redirect, no webhook, nothing
// deferred — so fulfillment happens directly here, in this same
// request/response, exactly like the Square checkout path it backs up.

import { chargeCard } from '../../lib/qbPaymentsServer';
import { fulfillOrder } from '../../lib/orderFulfillment';

// Same flat shape used by every other checkout path on this site and
// rendered in the admin Orders tab ({ name, address, apt, city, state,
// zip, phone }) — the raw checkout form uses firstName/lastName instead of
// a single name field, so that needs collapsing here rather than storing
// the form's own shape.
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
    const { token, amount, items, email, shipping, eventId, url, paymentMethod, attribution, shippingProtection } = req.body;

    if (!token) return res.status(400).json({ error: 'Missing card token' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in cart' });

    const charge = await chargeCard(token, amount);

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
      shippingProtection: Number(shippingProtection) > 0 ? Number(shippingProtection) : 0,
    });

    return res.status(200).json({ id: charge.id, status: charge.status });
  } catch (error) {
    console.error('QuickBooks Payments error:', error);
    return res.status(500).json({ error: error.message });
  }
}
