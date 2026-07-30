// Creates a Shop Pay Wallet session for the current cart — called right
// before the modal opens (lib/shopPayClient.js). Trusts the client-supplied
// amount/shipping breakdown the same way every other checkout path here
// does (pages/api/square-checkout.js takes `amount` as given, no
// server-side price recomputation) — the one thing genuinely new to
// validate for this processor is that every cart line actually maps to a
// real Shopify variant, since an unmapped item can't be charged through
// Shopify at all.

import { createShopPaySession } from '../../../lib/shopPayServer';
import { mapCartToShopifyLineItems } from '../../../lib/shopifyProductMap';
import { recordPendingShopPaySession } from '../../../lib/shopPayPendingOrders';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cart, amount, shippingCost, eventId, email, sessionId, attribution, url, discountCode } = req.body || {};
    if (!cart || cart.length === 0) return res.status(400).json({ error: 'No items in cart' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const lineItems = mapCartToShopifyLineItems(cart);
    if (!lineItems) {
      // Not every item in this cart has a Shopify variant configured
      // (lib/shopifyProductMap.js) — Shop Pay simply isn't offered for it,
      // same "unavailable" signal every other wallet integration here uses
      // rather than a hard error reaching the shopper.
      return res.status(422).json({ error: 'Shop Pay is not available for this cart.' });
    }

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const shipping = Number(shippingCost) || 0;

    // Generated here (not trusted from the client) — this is what
    // correlates the resulting Shopify order, once its webhook arrives,
    // back to this specific session (lib/shopPayPendingOrders.js), so it
    // has to be something only the server hands out.
    const sourceIdentifier = crypto.randomUUID();

    const session = await createShopPaySession({
      lineItems,
      subtotalAmount: subtotal,
      totalAmount: Number(amount),
      shippingAmount: shipping,
      sourceIdentifier,
      discountCodes: discountCode ? [discountCode] : undefined,
    });

    await recordPendingShopPaySession({
      sourceIdentifier,
      eventId,
      cart,
      amount: Number(amount),
      email,
      sessionId,
      attribution,
      url,
    });

    return res.status(200).json({ session, sourceIdentifier });
  } catch (error) {
    console.error('Shop Pay session creation failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
