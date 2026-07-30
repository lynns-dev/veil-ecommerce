// Maps this site's own product ids (lib/products.js) to the matching
// variant in the Shopify store that backs Shop Pay. Shop Pay only exists
// inside a Shopify checkout — even the embedded modal (lib/shopPayClient.js)
// is really Shopify pricing and fulfilling a Shopify order behind the
// scenes — so every line item handed to it has to resolve to a real
// Shopify product/variant, not just our own catalog id.
//
// Filled in by hand rather than matched by SKU/name: a typo'd auto-match
// would silently charge for the wrong item, where a missing entry here just
// means Shop Pay doesn't offer itself for that cart (see
// lib/shopPayServer.js's buildShopPayLineItems) — safe by default.
//
// Variant GIDs look like "gid://shopify/ProductVariant/1234567890" — the
// numeric id alone also works if that's easier to copy from the URL when
// viewing a variant in Shopify admin (Products → the product → the
// variant); toVariantGid() below normalizes either form.
export const SHOPIFY_VARIANT_MAP = {
  // original: 'gid://shopify/ProductVariant/0000000000',
};

export function toVariantGid(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return trimmed.startsWith('gid://') ? trimmed : `gid://shopify/ProductVariant/${trimmed}`;
}

// The reverse direction — a Shopify order's line items back to our own
// product ids — for the webhook (pages/api/shop-pay/webhook.js) to
// reconstruct the cart it records in our own order ledger. Built lazily
// rather than once at module load so an edit to SHOPIFY_VARIANT_MAP during
// local dev is picked up without a restart.
export function productIdForVariantGid(variantGid) {
  const normalized = toVariantGid(variantGid);
  for (const [productId, raw] of Object.entries(SHOPIFY_VARIANT_MAP)) {
    if (toVariantGid(raw) === normalized) return productId;
  }
  return null;
}

// Every line item must map, or none of them do — a cart that's half
// mappable would either silently drop an item from the Shopify order (the
// shopper paid for something that never shipped) or silently charge for
// only part of what's in their cart. Neither is acceptable, so Shop Pay
// simply doesn't offer itself unless the whole cart resolves.
export function mapCartToShopifyLineItems(cart) {
  const lineItems = [];
  for (const item of cart) {
    const raw = SHOPIFY_VARIANT_MAP[item.id];
    if (!raw) return null;
    lineItems.push({ variantId: toVariantGid(raw), quantity: item.quantity });
  }
  return lineItems;
}
