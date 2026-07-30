// One-time setup step. Visit this route in a browser once, log into the
// Shopify store's admin (SHOPIFY_STORE_DOMAIN), and approve the
// authorization screen. From then
// on lib/shopPayServer.js's adminRequest/storefrontRequest read the stored
// token automatically (see lib/shopifyTokenStore.js) — this route never
// needs to be visited again unless the connection is revoked from Shopify
// admin (Settings → Apps → the app → Uninstall).
//
// state is stored in a short-lived cookie rather than trusted blindly from
// the callback's query string — the callback (callback.js) checks the
// value it receives against this cookie, which is what actually prevents a
// forged callback request from completing as if it were a real
// authorization (state alone in the URL proves nothing; the pair — a value
// only this server handed out, echoed back on the one browser that
// received it — does).

import crypto from 'crypto';
import { buildShopifyAuthorizeUrl } from '../../../lib/shopPayServer';

export default function handler(req, res) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) return res.status(500).send('NEXT_PUBLIC_BASE_URL must be set before connecting Shopify.');

  const state = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `shopify_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`);

  try {
    const redirectUri = `${baseUrl}/api/shopify-auth/callback`;
    const authorizeUrl = buildShopifyAuthorizeUrl(redirectUri, state);
    res.redirect(authorizeUrl);
  } catch (err) {
    res.status(500).send(err.message);
  }
}
