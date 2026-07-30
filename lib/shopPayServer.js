// Server-side half of the embedded Shop Pay Wallet integration — creating a
// payment session, verifying the order webhook, and looking an order up for
// the reconciliation fallback (lib/shopPayPendingOrders.js).
//
// VERIFICATION STATUS: developer docs on shopify.dev are blocked from this
// environment (bot-protection 403s on every fetch attempt), so this was
// built from Shopify's own indexed search snippets and a Shopify Partner's
// published reference connector for Salesforce Commerce Cloud
// (github.com/Shopify-Partners/shop-pay-sfcc-connector) rather than reading
// the primary API reference directly. Confidence is uneven across this
// file — see the note above each piece. Before this goes live: open the
// Custom App's GraphiQL explorer in Shopify admin (Apps → your app → API
// credentials → there's a "GraphiQL app" link) and confirm
// shopPayPaymentRequestSessionCreate's actual input/return shape matches
// what's built here. A field-name mismatch fails loudly (a GraphQL error
// in the response), not silently — but it will fail until checked.

import crypto from 'crypto';

const STOREFRONT_API_VERSION = '2025-01';
const ADMIN_API_VERSION = '2025-01';

function storeDomain() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set.');
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function storefrontRequest(query, variables) {
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!token) throw new Error('SHOPIFY_STOREFRONT_ACCESS_TOKEN is not set.');
  const res = await fetch(`https://${storeDomain()}/api/${STOREFRONT_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(`Shopify Storefront API error: ${JSON.stringify(data.errors || data)}`);
  }
  return data.data;
}

async function adminRequest(query, variables) {
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is not set.');
  const res = await fetch(`https://${storeDomain()}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(`Shopify Admin API error: ${JSON.stringify(data.errors || data)}`);
  }
  return data.data;
}

// MODERATE CONFIDENCE — mutation name and the rough input field list
// (lineItems, subtotalAmount, totalAmount, shippingLines, presentmentCurrency,
// locale, discountCodes) came from Shopify's own Storefront API schema pages
// as surfaced through search indexing; the exact nesting of each field
// (e.g. whether amounts are bare decimal strings or
// { amount, currencyCode } money objects, same shape Square uses elsewhere
// in this codebase) was not independently confirmed. Written as money
// objects here since that's the Storefront API's convention everywhere else
// (MoneyV2) — verify against GraphiQL before relying on this for real
// charges.
//
// sourceIdentifier: a value we generate and pass in, expected to come back
// on the resulting Order so the webhook (verifyShopifyWebhook below,
// consumed in pages/api/shop-pay/webhook.js) can correlate it to this
// session's pending record (lib/shopPayPendingOrders.js) — recovering the
// Meta eventId and attribution captured at handoff time. This field name is
// the least-verified part of this file; if it isn't actually present on
// completed orders, the webhook falls back to fulfilling the order without
// a Meta-deduped eventId rather than failing (see pages/api/shop-pay/
// webhook.js) — an order is never dropped over an attribution miss.
export async function createShopPaySession({ lineItems, subtotalAmount, totalAmount, shippingAmount, sourceIdentifier, discountCodes }) {
  const mutation = `
    mutation ShopPaySessionCreate($input: ShopPayPaymentRequestSessionCreateInput!) {
      shopPayPaymentRequestSessionCreate(input: $input) {
        shopPayPaymentRequestSession {
          token
          checkoutUrl
          sourceIdentifier
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = {
    sourceIdentifier,
    paymentRequest: {
      locale: 'en',
      presentmentCurrency: 'USD',
      subtotalAmount: { amount: subtotalAmount.toFixed(2), currencyCode: 'USD' },
      totalAmount: { amount: totalAmount.toFixed(2), currencyCode: 'USD' },
      lineItems: lineItems.map((li) => ({
        // MoneyV2 fields here are a best guess at the line-item shape —
        // same "verify against GraphiQL" caveat as the top-level amounts.
        variantId: li.variantId,
        quantity: li.quantity,
      })),
      shippingLines: shippingAmount == null ? [] : [{
        label: shippingAmount === 0 ? 'Free shipping' : 'Standard shipping',
        amount: { amount: shippingAmount.toFixed(2), currencyCode: 'USD' },
        // Same fixed, pre-computed-total approach the existing Apple Pay
        // button (components/CartDrawer.jsx) already uses rather than a
        // full dynamic rate-shopping handshake — code is 'FIXED' or similar
        // per Shopify's own ShippingRate-style enums elsewhere in their
        // APIs; unconfirmed for this specific input type.
        code: 'standard',
      }],
      ...(discountCodes?.length ? { discountCodes } : {}),
    },
  };

  const data = await storefrontRequest(mutation, { input });
  const result = data.shopPayPaymentRequestSessionCreate;
  const errors = result?.userErrors || [];
  if (errors.length) {
    throw new Error(`Shop Pay session rejected: ${errors.map((e) => e.message).join('; ')}`);
  }
  if (!result?.shopPayPaymentRequestSession) {
    throw new Error('Shop Pay session creation returned no session.');
  }
  return result.shopPayPaymentRequestSession;
}

// HIGH CONFIDENCE — HMAC verification is standard across every Shopify
// webhook (not Shop-Pay-specific), documented consistently everywhere:
// base64(HMAC-SHA256(rawBody, client secret)), compared against the
// X-Shopify-Hmac-Sha256 header. Must run against the raw, unparsed request
// body — Next.js's default JSON body parsing is disabled on the webhook
// route (see pages/api/shop-pay/webhook.js's config export) specifically
// so this sees the exact bytes Shopify signed, not a re-serialized copy
// that could differ in whitespace/key order and fail verification.
export function verifyShopifyWebhookHmac(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) throw new Error('SHOPIFY_WEBHOOK_SECRET is not set.');
  if (!hmacHeader) return false;

  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// LOW-MODERATE CONFIDENCE — a best-effort lookup for the reconciliation
// fallback (pages/api/shop-pay/reconcile.js), used only when a webhook
// never arrives for a pending session past its timeout. Orders search by
// arbitrary source_identifier isn't confirmed as a supported Admin API
// search filter; if it isn't, this comes back empty and the pending record
// just waits for the next reconciliation pass rather than erroring the
// whole job. A confirmed miss here never invents an order — reconciliation
// only ever fulfills something Shopify actually shows as created.
export async function findOrderBySourceIdentifier(sourceIdentifier) {
  const query = `
    query FindOrder($query: String!) {
      orders(first: 1, query: $query) {
        nodes {
          id
          name
          createdAt
          totalPriceSet { presentmentMoney { amount } }
          customer { email }
          shippingAddress { name address1 address2 city province zip phone }
          lineItems(first: 50) {
            nodes { quantity variant { id } }
          }
          sourceIdentifier
        }
      }
    }
  `;
  try {
    const data = await adminRequest(query, { query: `source_identifier:${sourceIdentifier}` });
    return data?.orders?.nodes?.[0] || null;
  } catch (err) {
    console.error('Shop Pay order reconciliation lookup failed:', err.message);
    return null;
  }
}

// MODERATE CONFIDENCE — refundCreate is a real, long-standing Admin API
// mutation (not Shop-Pay-specific), but the exact input shape here
// (orderId + a single full-order-amount transaction) is a reasonable
// default rather than a verified call. Matches this route's siblings in
// pages/api/admin/orders/refund.js, which all take (orderId, amount) and
// throw on failure rather than silently no-op.
export async function refundShopifyOrder(rawOrderId, amount) {
  // pages/api/shop-pay/webhook.js stores the plain numeric Shopify order id
  // (what the REST-shaped webhook payload's order.id field carries) in this
  // codebase's own order ledger, matching every other processor's bare id —
  // but the Admin GraphQL API expects a GID. Accept either so a refund
  // works regardless of which form ends up on the order record.
  const orderId = String(rawOrderId).startsWith('gid://') ? rawOrderId : `gid://shopify/Order/${rawOrderId}`;
  const mutation = `
    mutation RefundOrder($input: RefundInput!) {
      refundCreate(input: $input) {
        refund { id }
        userErrors { field message }
      }
    }
  `;
  const data = await adminRequest(mutation, {
    input: {
      orderId,
      notify: false,
      transactions: [{
        orderId,
        amount: Number(amount).toFixed(2),
        kind: 'REFUND',
        gateway: 'shopify_payments',
      }],
    },
  });
  const result = data.refundCreate;
  const errors = result?.userErrors || [];
  if (errors.length) {
    throw new Error(`Shopify refund rejected: ${errors.map((e) => e.message).join('; ')}`);
  }
  return result.refund;
}
