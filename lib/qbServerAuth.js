// Keeps a QuickBooks Payments access token valid with zero manual steps.
//
// Access tokens last ~1hr; refresh tokens last ~100 days and rotate on every
// use. getValidAccessToken() refreshes automatically whenever the stored
// token is close to expiring and saves the newly-rotated pair back to the
// KV store — so as long as checkout runs at least once every 100 days, the
// connection never needs re-authorizing by hand after the initial one-time
// /api/qb-auth/connect flow.

import { getTokens, setTokens } from './qbTokenStore';

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function basicAuthHeader() {
  const id = process.env.QB_CLIENT_ID;
  const secret = process.env.QB_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('QB_CLIENT_ID / QB_CLIENT_SECRET are not set.');
  }
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

async function refresh(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh QuickBooks access token');
  }
  const record = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  await setTokens(record);
  return record;
}

// Returns a currently-valid access token, transparently refreshing first if needed.
export async function getValidAccessToken() {
  const stored = await getTokens();
  if (!stored) {
    throw new Error('QuickBooks Payments is not connected yet — visit /api/qb-auth/connect once to authorize.');
  }
  if (Date.now() < stored.expires_at - REFRESH_MARGIN_MS) {
    return stored.access_token;
  }
  try {
    const refreshed = await refresh(stored.refresh_token);
    return refreshed.access_token;
  } catch (err) {
    // Refresh tokens are single-use and rotate on every use (see the
    // comment at the top of this file). Each serverless invocation reads
    // the stored token independently — if two checkouts happen close
    // together and both find the access token near expiry, both will try
    // to refresh using the *same* stored refresh_token. Whichever request
    // reaches Intuit first succeeds and rotates it; the other's refresh
    // call then fails against the now-invalidated old refresh_token, even
    // though the connection itself is completely fine. Before treating
    // that as a real failure, re-read the store once: if the winning
    // request's newly-rotated token is already there and still valid, use
    // it instead of failing this request outright.
    const latest = await getTokens();
    if (latest && latest.access_token !== stored.access_token && Date.now() < latest.expires_at - REFRESH_MARGIN_MS) {
      return latest.access_token;
    }
    throw err;
  }
}
