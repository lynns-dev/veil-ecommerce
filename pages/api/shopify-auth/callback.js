// Receives the authorization code from /api/shopify-auth/connect, verifies
// it's genuinely from Shopify, exchanges it for an Admin API access token,
// and — since Dev Dashboard apps have no separate screen for either of
// these — also provisions a Storefront API access token and registers the
// order webhook, all in this one visit. This is the only place the Admin
// token is ever created; after this, lib/shopPayServer.js just reads it
// back from lib/shopifyTokenStore.js (no refresh needed — Shopify OAuth
// tokens from this flow don't expire).

import {
  verifyOAuthCallbackHmac,
  exchangeShopifyAuthorizationCode,
  provisionStorefrontAccessToken,
  registerOrderWebhook,
} from '../../../lib/shopPayServer';
import { setShopifyTokens } from '../../../lib/shopifyTokenStore';

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) return res.status(400).send(`Shopify authorization failed: ${error}`);
  if (!code) return res.status(400).send('Missing authorization code.');

  // Compares against the cookie /api/shopify-auth/connect set, not just
  // "is state present" — a state value present in the URL but not matching
  // what this server actually handed out for this browser is exactly the
  // forged-callback case this check exists to catch.
  const expectedState = req.cookies?.shopify_oauth_state;
  if (!expectedState || state !== expectedState) {
    return res.status(400).send('State mismatch — this authorization request did not originate from /api/shopify-auth/connect, or has expired. Start over.');
  }
  res.setHeader('Set-Cookie', 'shopify_oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');

  if (!verifyOAuthCallbackHmac(req.query)) {
    return res.status(400).send('HMAC verification failed — this callback was not genuinely signed by Shopify.');
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) return res.status(500).send('NEXT_PUBLIC_BASE_URL must be set.');

  try {
    const redirectUri = `${baseUrl}/api/shopify-auth/callback`;
    const { access_token: accessToken, scope } = await exchangeShopifyAuthorizationCode(code, redirectUri);
    await setShopifyTokens({ accessToken, scope, connectedAt: new Date().toISOString() });

    // Both of these need the Admin token that was just stored above, so
    // they run after it's saved, not before.
    const storefrontAccessToken = await provisionStorefrontAccessToken();
    await setShopifyTokens({ accessToken, scope, storefrontAccessToken, connectedAt: new Date().toISOString() });

    await registerOrderWebhook(`${baseUrl}/api/shop-pay/webhook`);

    res.status(200).send(
      'Shopify connected. Admin API access token stored, Storefront API access token provisioned, and the order webhook is registered. You can close this tab. ' +
      'Next step: fill in lib/shopifyProductMap.js with real Shopify variant IDs for every product (including the free gift) before the Shop Pay button will actually offer itself on a cart.'
    );
  } catch (err) {
    console.error('Shopify OAuth callback failed:', err);
    res.status(500).send(`Connection failed: ${err.message}`);
  }
}
