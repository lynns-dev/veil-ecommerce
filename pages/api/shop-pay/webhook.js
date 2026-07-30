// Receives Shopify's order-created webhook once a Shop Pay checkout
// completes, and is the *authoritative* confirmation that an order was
// actually paid — mirroring how this codebase already treats Stripe's
// webhook as authoritative rather than a client-side "it worked" event
// (lib/shopPayClient.js's own completion callback is optimistic UI only:
// it navigates to /success, but never itself records the order). Shopify's
// own guidance is explicit about this too: the browser can lose the
// paymentcomplete event entirely (closed tab, dropped connection) while the
// order still goes through — this webhook is the only path that's
// guaranteed to see every completed order, which is also why
// pages/api/shop-pay/reconcile.js exists as a fallback for a webhook that
// never arrives at all.
//
// bodyParser is disabled below so this sees the exact raw bytes Shopify
// signed — re-serializing a parsed-then-stringified body can differ in
// whitespace/key order and fail HMAC verification even for a genuine
// request.

import { verifyShopifyWebhookHmac } from '../../../lib/shopPayServer';
import { findPendingShopPaySession, resolvePendingShopPaySession } from '../../../lib/shopPayPendingOrders';
import { productIdForVariantGid } from '../../../lib/shopifyProductMap';
import { getProductById, TASSEL_GIFT } from '../../../lib/products';
import { fulfillOrder } from '../../../lib/orderFulfillment';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Shopify's line item -> our own catalog shape (id, name, price, quantity)
// so fulfillOrder()/the admin Orders tab render this exactly like an order
// from any other processor. A line item whose variant isn't in
// lib/shopifyProductMap.js (shouldn't happen — the session was only
// created because every item mapped, see pages/api/shop-pay/session.js —
// but Shopify checkouts can in principle be modified after the session
// opens) falls back to a generic label rather than dropping the line
// silently, so a mismatch is visible in admin instead of invisible.
function mapOrderLineItems(shopifyLineItems) {
  return (shopifyLineItems || []).map((li) => {
    const productId = productIdForVariantGid(li.variant?.id);
    const catalogProduct = productId === TASSEL_GIFT.id ? TASSEL_GIFT : (productId ? getProductById(productId) : null);
    return {
      id: productId || li.variant?.id || 'unknown',
      name: catalogProduct?.name || li.title || 'Unknown item',
      price: catalogProduct?.id === TASSEL_GIFT.id ? 0 : Number(li.price ?? catalogProduct?.price ?? 0),
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
    state: address.provinceCode || address.province || '',
    zip: address.zip || '',
    phone: address.phone || '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const rawBody = await readRawBody(req);

  let verified;
  try {
    verified = verifyShopifyWebhookHmac(rawBody, req.headers['x-shopify-hmac-sha256']);
  } catch (err) {
    console.error('Shop Pay webhook verification error:', err.message);
    return res.status(500).end();
  }
  if (!verified) {
    console.error('Shop Pay webhook: HMAC verification failed — rejecting.');
    return res.status(401).end();
  }

  let order;
  try {
    order = JSON.parse(rawBody);
  } catch (err) {
    console.error('Shop Pay webhook: malformed JSON body.');
    return res.status(400).end();
  }

  // Defense in depth: this topic is meant to fire only for completed Shop
  // Pay charges, but nothing stops Shopify's dashboard also being wired to
  // send other order-creation events (manual orders, draft orders marked
  // paid later, etc.) at this same URL by mistake — only actually fulfill
  // something that's genuinely paid.
  if (order.financial_status && order.financial_status !== 'paid') {
    return res.status(200).end();
  }

  // sourceIdentifier's field name on the webhook payload is the least
  // verified part of this integration (see lib/shopPayServer.js's top
  // comment) — checked at a couple of plausible locations rather than one
  // assumed path. A miss here doesn't drop the order: it's still recorded
  // below, just without the Meta eventId a hit would carry.
  const sourceIdentifier = order.source_identifier || order.sourceIdentifier || null;
  const pending = sourceIdentifier ? await findPendingShopPaySession(sourceIdentifier) : null;
  if (sourceIdentifier && !pending) {
    console.warn('Shop Pay webhook: no pending record found for source_identifier', sourceIdentifier, '— fulfilling without attribution.');
  }
  // Shopify's webhook delivery is at-least-once (it retries on a non-200
  // response, and can occasionally redeliver even after a 200) — this
  // codebase's order ledger appends unconditionally rather than upserting
  // by id, so without this check a redelivered webhook would record the
  // same order twice. A resolved flag on the pending record (set below,
  // once) is what distinguishes "already handled" from "first time seeing
  // this order."
  if (pending?.resolved) {
    return res.status(200).end();
  }

  try {
    const items = order.line_items?.length ? mapOrderLineItems(order.line_items) : (pending?.cart || []);
    await fulfillOrder({
      id: String(order.id || order.order_number || order.name),
      amount: Number(order.total_price ?? pending?.amount ?? 0),
      items,
      eventId: pending?.eventId,
      url: pending?.url,
      req,
      paymentMethod: 'Shop Pay',
      attribution: pending?.attribution,
      email: order.email || order.contact_email || pending?.email || '',
      shipping: mapOrderShipping(order.shipping_address),
      processor: 'shopify',
      sessionId: pending?.sessionId,
    });

    if (sourceIdentifier) await resolvePendingShopPaySession(sourceIdentifier, String(order.id || ''));
    return res.status(200).end();
  } catch (err) {
    console.error('Shop Pay webhook: fulfillOrder failed:', err);
    // Non-200 so Shopify retries this delivery — the resolved-flag check
    // above only guards a retry that's addressed to the same
    // sourceIdentifier we already succeeded on; a failed attempt never sets
    // that flag, so the retry after this failure runs fulfillOrder for real
    // rather than being skipped as a duplicate.
    return res.status(500).end();
  }
}
