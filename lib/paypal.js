// PayPal is no longer used at checkout (Stripe's Express Checkout Element
// offers PayPal directly now) — this file only remains to refund orders
// placed back when the standalone PayPal integration was still live.
// Client credentials (client ID + secret) exchange for a short-lived OAuth
// token via the standard client_credentials grant; that token authorizes
// the refund call. No refresh-token persistence needed — a fresh token is
// requested per refund.

const API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
};

function base() {
  return API_BASE[process.env.PAYPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox'];
}

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) {
    throw new Error('NEXT_PUBLIC_PAYPAL_CLIENT_ID / PAYPAL_SECRET are not set.');
  }

  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Failed to authenticate with PayPal.');
  return data.access_token;
}

// Refunds a completed capture in full — refunds against the *capture* id,
// not the order id (they're different ids in PayPal's API). Omitting a
// request body issues a full refund of whatever's left on the capture.
export async function refundCapture(captureId) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${base()}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.details?.[0]?.description || 'Failed to refund PayPal capture.');
  return data;
}
