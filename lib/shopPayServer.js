// Server-side half of the embedded Shop Pay Wallet integration — OAuth
// install, creating a payment session, verifying the order webhook, and
// looking an order up for the reconciliation fallback
// (lib/shopPayPendingOrders.js).
//
// Shopify retired the old "legacy custom app" flow (a screen that handed
// you a static Admin API access token and a static Storefront API access
// token directly, no OAuth) in favor of Dev Dashboard apps, which only ever
// hand out a client id + client secret — confirmed live against the real
// Shopify admin while building this, not assumed. That means there's no
// token to copy from a page at all: the Admin API access token only comes
// into existence after a real OAuth authorization
// (pages/api/shopify-auth/connect.js + callback.js), the same one-time
// "visit this URL, approve, done" shape lib/qbServerAuth.js already uses
// for QuickBooks. Unlike QuickBooks, a Shopify OAuth access token doesn't
// expire on its own (valid until the app is uninstalled or the token is
// revoked), so there's no refresh logic to maintain afterward.
//
// VERIFICATION STATUS: developer docs on shopify.dev are blocked from this
// environment (bot-protection 403s on every fetch attempt), so this was
// built from Shopify's own indexed search snippets and a Shopify Partner's
// published reference connector for Salesforce Commerce Cloud
// (github.com/Shopify-Partners/shop-pay-sfcc-connector) rather than reading
// the primary API reference directly. Confidence is uneven across this
// file — see the note above each piece. The OAuth authorize/token-exchange
// flow itself (buildShopifyAuthorizeUrl, verifyOAuthCallbackHmac,
// exchangeShopifyAuthorizationCode below) is Shopify's classic, long-stable
// OAuth mechanism and not something this environment's blocked docs put in
// doubt — high confidence there. Before this goes live: open the app's
// GraphiQL explorer (Dev Dashboard → the app → there's usually a way to
// query the Admin/Storefront API directly from there) and confirm
// shopPayPaymentRequestSessionCreate's actual input/return shape matches
// what's built here. A field-name mismatch fails loudly (a GraphQL error
// in the response), not silently — but it will fail until checked.

import crypto from 'crypto';
import { getShopifyTokens } from './shopifyTokenStore';

const STOREFRONT_API_VERSION = '2025-01';
const ADMIN_API_VERSION = '2025-01';

function storeDomain() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set.');
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function clientCredentials() {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET are not set.');
  return { clientId, clientSecret };
}

async function storefrontRequest(query, variables) {
  const stored = await getShopifyTokens();
  if (!stored?.storefrontAccessToken) {
    throw new Error('Shopify is not connected yet — visit /api/shopify-auth/connect once to authorize.');
  }
  const res = await fetch(`https://${storeDomain()}/api/${STOREFRONT_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': stored.storefrontAccessToken,
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
  const stored = await getShopifyTokens();
  if (!stored?.accessToken) {
    throw new Error('Shopify is not connected yet — visit /api/shopify-auth/connect once to authorize.');
  }
  const res = await fetch(`https://${storeDomain()}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': stored.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(`Shopify Admin API error: ${JSON.stringify(data.errors || data)}`);
  }
  return data.data;
}

// HIGH CONFIDENCE — Shopify's standard OAuth authorize URL. scope requested
// here must be a subset of whatever's declared for this app in Dev
// Dashboard (its Configuration/API access section) — if this app has no
// scopes configured there, the approval screen won't grant these.
export function buildShopifyAuthorizeUrl(redirectUri, state) {
  const { clientId } = clientCredentials();
  const url = new URL(`https://${storeDomain()}/admin/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'read_orders,write_orders');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

// HIGH CONFIDENCE — Shopify's documented OAuth callback verification:
// every query param except hmac/signature, sorted by key, joined as
// key=value pairs with '&', HMAC-SHA256'd with the client secret, hex
// digest (not base64 — that's the webhook HMAC's encoding, this is a
// different check with a different encoding, easy to mix up).
export function verifyOAuthCallbackHmac(query) {
  const { clientSecret } = clientCredentials();
  const { hmac, signature, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest).sort().map((k) => `${k}=${Array.isArray(rest[k]) ? rest[k].join(',') : rest[k]}`).join('&');
  const digest = crypto.createHmac('sha256', clientSecret).update(message, 'utf8').digest('hex');
  const a = Buffer.from(digest);
  const b = Buffer.from(String(hmac));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// HIGH CONFIDENCE — Shopify's standard authorization-code exchange.
// Returns { access_token, scope } — no expiry field, because Admin API
// OAuth tokens from this endpoint don't expire.
export async function exchangeShopifyAuthorizationCode(code, redirectUri) {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(`https://${storeDomain()}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Shopify token exchange failed: ${JSON.stringify(data)}`);
  }
  return data;
}

// MODERATE CONFIDENCE — storefrontAccessTokenCreate is a real, long-standing
// Admin API mutation for exactly this purpose (minting a Storefront API
// token programmatically once you already have Admin API access), which is
// what turns the one-time OAuth connect into the only setup step needed —
// otherwise there'd be a second manual "go copy a Storefront token from
// somewhere" step Dev Dashboard doesn't actually expose. The token this
// returns carries whatever default Storefront scopes Shopify grants tokens
// created this way; if a Shop Pay session call ever fails specifically on a
// missing Storefront permission, that default set is the first thing to
// check in GraphiQL.
export async function provisionStorefrontAccessToken() {
  const mutation = `
    mutation CreateStorefrontToken($input: StorefrontAccessTokenInput!) {
      storefrontAccessTokenCreate(input: $input) {
        storefrontAccessToken { accessToken }
        userErrors { field message }
      }
    }
  `;
  const data = await adminRequest(mutation, { input: { title: 'Shop Pay integration' } });
  const result = data.storefrontAccessTokenCreate;
  const errors = result?.userErrors || [];
  if (errors.length) throw new Error(`Storefront token creation rejected: ${errors.map((e) => e.message).join('; ')}`);
  const token = result?.storefrontAccessToken?.accessToken;
  if (!token) throw new Error('Storefront token creation returned no token.');
  return token;
}

// MODERATE CONFIDENCE — webhookSubscriptionCreate, called once right after
// OAuth connect (pages/api/shopify-auth/callback.js) so there's no separate
// manual "create a webhook in some UI, copy its secret" step — Dev
// Dashboard apps don't have that legacy screen at all, and even if they
// did, webhook HMACs for an OAuth app are signed with the app's own client
// secret (verifyShopifyWebhookHmac below), not a webhook-specific secret.
// Safe to call more than once — Shopify treats a duplicate subscription to
// the same topic+address as a no-op update rather than erroring, so
// reconnecting doesn't end up with several duplicate webhook deliveries.
export async function registerOrderWebhook(callbackUrl) {
  const mutation = `
    mutation RegisterOrderWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }
  `;
  const data = await adminRequest(mutation, {
    topic: 'ORDERS_CREATE',
    webhookSubscription: { callbackUrl, format: 'JSON' },
  });
  const result = data.webhookSubscriptionCreate;
  const errors = result?.userErrors || [];
  if (errors.length) throw new Error(`Webhook registration rejected: ${errors.map((e) => e.message).join('; ')}`);
  return result?.webhookSubscription;
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
// base64(HMAC-SHA256(rawBody, secret)), compared against the
// X-Shopify-Hmac-Sha256 header. Must run against the raw, unparsed request
// body — Next.js's default JSON body parsing is disabled on the webhook
// route (see pages/api/shop-pay/webhook.js's config export) specifically
// so this sees the exact bytes Shopify signed, not a re-serialized copy
// that could differ in whitespace/key order and fail verification.
//
// The secret is the app's own client secret, not a separately-issued
// "webhook secret" — that separate secret only existed on the legacy
// custom-app screen Shopify has retired. Webhooks registered
// programmatically (registerOrderWebhook above, via a Dev Dashboard app)
// sign with the same client secret used for OAuth.
export function verifyShopifyWebhookHmac(rawBody, hmacHeader) {
  const { clientSecret: secret } = clientCredentials();
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
