// Persists the Shopify Admin + Storefront API access tokens obtained via
// the one-time OAuth install (pages/api/shopify-auth/connect.js +
// callback.js) in the same KV store every other token/session store here
// uses. Unlike QuickBooks (lib/qbTokenStore.js), a Shopify Admin API OAuth
// token doesn't expire on its own — it's valid until the app is
// uninstalled or the token is explicitly revoked — so there's no refresh
// logic to build here, just storage and retrieval.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'shopify:tokens';

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error(
      'KV_REST_API_URL / KV_REST_API_TOKEN are not set — connect a KV store (Vercel KV or Upstash Redis) so the Shopify connection can persist between requests.'
    );
  }
}

export async function getShopifyTokens() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

export async function setShopifyTokens(tokens) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(tokens),
  });
  if (!res.ok) throw new Error('Failed to persist Shopify tokens to the KV store.');
}
