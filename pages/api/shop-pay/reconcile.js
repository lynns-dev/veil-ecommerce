// Fallback for a Shop Pay webhook that never arrives — Shopify's own docs
// warn about this explicitly: the client-side completion event can be lost
// (closed tab, dropped network) and webhook delivery itself isn't
// instantaneous, so a real paid order can otherwise sit unrecorded. Run on
// a schedule (see vercel.json) rather than triggered by anything on-site.
//
// Guarded by CRON_SECRET rather than left open — this route fulfills real
// orders, so it can't be a public URL anyone can hit. Vercel Cron sends
// `Authorization: Bearer <CRON_SECRET>` automatically once CRON_SECRET is
// set as an env var (documented, standard Vercel Cron behavior); anything
// else calling this route without that header is rejected.

import { listStalePendingShopPaySessions, resolvePendingShopPaySession, pruneAbandonedShopPaySessions } from '../../../lib/shopPayPendingOrders';
import { findOrderBySourceIdentifier } from '../../../lib/shopPayServer';
import { productIdForVariantGid } from '../../../lib/shopifyProductMap';
import { getProductById, TASSEL_GIFT } from '../../../lib/products';
import { fulfillOrder } from '../../../lib/orderFulfillment';

function mapOrderLineItems(shopifyLineItems, fallbackCart) {
  const nodes = shopifyLineItems?.nodes;
  if (!nodes?.length) return fallbackCart || [];
  return nodes.map((li) => {
    const productId = productIdForVariantGid(li.variant?.id);
    const catalogProduct = productId === TASSEL_GIFT.id ? TASSEL_GIFT : (productId ? getProductById(productId) : null);
    return {
      id: productId || li.variant?.id || 'unknown',
      name: catalogProduct?.name || 'Unknown item',
      price: catalogProduct?.id === TASSEL_GIFT.id ? 0 : Number(catalogProduct?.price ?? 0),
      quantity: li.quantity,
    };
  });
}

function mapOrderShipping(address) {
  if (!address?.address1) return null;
  return {
    name: address.name || '',
    address: address.address1,
    apt: address.address2 || '',
    city: address.city || '',
    state: address.province || '',
    zip: address.zip || '',
    phone: address.phone || '',
  };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('Shop Pay reconciliation: CRON_SECRET is not set — refusing to run.');
    return res.status(500).json({ error: 'Not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Each step below can throw independently (KV unreachable, a malformed
  // Shopify response) — caught individually rather than left to one
  // top-level try, so a KV outage produces a clean diagnostic instead of an
  // unhandled exception. This route runs unattended on a schedule; nobody's
  // watching a stack trace scroll by in real time, so the response body is
  // the only place a genuine misconfiguration (KV never set up) gets
  // reported at all.
  let stale;
  try {
    stale = await listStalePendingShopPaySessions();
  } catch (err) {
    console.error('Shop Pay reconciliation: could not list pending sessions:', err.message);
    return res.status(500).json({ error: err.message });
  }

  let resolved = 0;
  const errors = [];

  for (const pending of stale) {
    try {
      const order = await findOrderBySourceIdentifier(pending.sourceIdentifier);
      if (!order) continue; // not paid (yet, or ever) — leave it for the next pass, or eventual pruning

      await fulfillOrder({
        id: String(order.id),
        amount: Number(order.totalPriceSet?.presentmentMoney?.amount ?? pending.amount ?? 0),
        items: mapOrderLineItems(order.lineItems, pending.cart),
        eventId: pending.eventId,
        url: pending.url,
        req,
        paymentMethod: 'Shop Pay',
        attribution: pending.attribution,
        email: order.customer?.email || pending.email || '',
        shipping: mapOrderShipping(order.shippingAddress),
        processor: 'shopify',
        sessionId: pending.sessionId,
      });
      await resolvePendingShopPaySession(pending.sourceIdentifier, String(order.id));
      resolved += 1;
    } catch (err) {
      console.error('Shop Pay reconciliation failed for', pending.sourceIdentifier, err);
      errors.push(pending.sourceIdentifier);
    }
  }

  let pruned = 0;
  try {
    pruned = await pruneAbandonedShopPaySessions();
  } catch (err) {
    console.error('Shop Pay reconciliation: pruning failed:', err.message);
    errors.push('prune-failed');
  }

  return res.status(200).json({ checked: stale.length, resolved, pruned, errors });
}
