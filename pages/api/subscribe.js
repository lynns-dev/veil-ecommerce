// Creates a "Subscribe & Save" subscription — a single-jar fragrance,
// billed every 60 days at 15% off (lib/products.js's SUBSCRIPTION_*
// constants). Separate from the cart/checkout flow entirely: a
// subscription is one recurring product, not a multi-item cart, so this
// takes a single productId rather than a cart array (same reasoning
// pages/offer3.jsx already uses for its own self-contained single-product
// order form).
//
// Square charges the card immediately on subscription creation and again
// automatically every cadence after — this route only ever runs once per
// subscriber. Revenue for every charge (this first one and every renewal)
// is recorded from the invoice.payment_made webhook instead
// (pages/api/square-subscription-webhook.js), not here, so there's exactly
// one code path recording subscription revenue regardless of which cycle
// it is.

import { PRODUCTS, SUBSCRIPTION_PRODUCT_IDS, subscriptionPrice } from '../../lib/products';
import { ensureSubscriptionPlan, createCustomerAndCard, createSquareSubscription } from '../../lib/squareSubscriptionsServer';
import { addSubscription } from '../../lib/subscriptionsStore';
import { sendPushToAdmins } from '../../lib/webPush';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId, cardToken, email, name, shipping } = req.body || {};

  if (!productId || !SUBSCRIPTION_PRODUCT_IDS.includes(productId)) {
    return res.status(400).json({ error: 'This product is not available as a subscription.' });
  }
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return res.status(400).json({ error: 'Unknown product.' });
  if (!cardToken) return res.status(400).json({ error: 'Payment details are required.' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required.' });
  if (!shipping?.address || !shipping?.city || !shipping?.state || !shipping?.zip) {
    return res.status(400).json({ error: 'A complete shipping address is required.' });
  }

  try {
    const plan = await ensureSubscriptionPlan();
    const planVariationId = plan.variations[productId];
    if (!planVariationId) throw new Error(`No subscription plan variation configured for ${productId}.`);

    const { customerId, cardId } = await createCustomerAndCard({ email, name: name || shipping.name, shipping, cardToken });
    const subscription = await createSquareSubscription({ customerId, cardId, planVariationId });

    await addSubscription({
      id: subscription.id,
      customerId,
      cardId,
      email,
      name: name || shipping.name || '',
      productId,
      productName: product.name,
      planVariationId,
      price: subscriptionPrice(product.price),
      cadenceDays: 60,
      status: subscription.status || 'ACTIVE',
      shipping,
      createdAt: new Date().toISOString(),
      processedInvoiceIds: [],
    });

    sendPushToAdmins({
      title: 'New subscriber',
      body: `${product.name} · every 60 days · $${subscriptionPrice(product.price).toFixed(2)}`,
      url: '/admin',
    }).catch(() => {});

    return res.status(200).json({ ok: true, subscriptionId: subscription.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
