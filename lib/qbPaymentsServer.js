// Server-side QuickBooks Payments Charges API client — charge (used by
// /api/qb-checkout) and refund (used by /api/admin/orders/refund) share the
// same base URL/auth/error-parsing here instead of duplicating it.
//
// The charge response carries AvsZip/AvsStreet/CardSecurityCodeMatch
// (each "Pass"/"Fail"/"NotAvailable") directly on the same object as the
// charge itself — confirmed against Intuit's real Charges entity reference.
// These were never being read: chargeCard only checked the HTTP status, so
// a charge could come back "200 CAPTURED" with every verification field
// blank and still be reported to the shopper as a success, even though
// that's exactly the pattern QuickBooks' own risk engine was about to
// auto-void a moment later (see git history for the "Auto Void due to Risk
// Decline" investigation).
//
// chargeCard now authorizes first (capture: false — money isn't moved yet)
// and only calls the separate Capture endpoint once verification looks
// acceptable. This matters: if we instead captured immediately and only
// checked the verification fields afterward, an explicit "Fail" would mean
// showing the shopper a decline message *after* their card had already
// been charged — worse than the original bug, not better. Authorizing
// first means a verification failure just leaves the authorization
// uncaptured (no money taken, nothing to reverse) instead of requiring a
// void. "NotAvailable" is left non-fatal since Intuit's own docs list it
// as a normal, non-error outcome ("AVS is supported by most US banks and
// some international banks" — implying not all).
//
// The charge path is a restoration of an earlier integration on this site
// that hit an unresolved 403 from Intuit despite a correctly-scoped OAuth
// connection (see git history) — treat both charge and refund as unverified
// until exercised against a real QuickBooks sandbox account.

import { getValidAccessToken } from './qbServerAuth';

const API_BASE = {
  sandbox: 'https://sandbox.api.intuit.com',
  production: 'https://api.intuit.com',
};

function base() {
  return API_BASE[process.env.QB_ENVIRONMENT === 'production' ? 'production' : 'sandbox'];
}

function requestId() {
  return `veil-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractErrorMessage(data, status) {
  return (
    data?.errors?.[0]?.detail ||
    data?.error?.message ||
    data?.fault?.error?.[0]?.message ||
    data?.message ||
    `Request failed (${status})`
  );
}

async function parseResponse(response, action) {
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    console.error(`QuickBooks ${action} — non-JSON response:`, response.status, raw.slice(0, 500));
    throw new Error(`QuickBooks returned an unexpected response (${response.status}): ${raw.slice(0, 200) || 'empty body'}`);
  }
  if (!response.ok) {
    console.error(`QuickBooks ${action} failed:`, response.status, JSON.stringify(data));
    throw new Error(extractErrorMessage(data, response.status));
  }
  return data;
}

// token: one-time card token from lib/qbPayments.js's tokenizeCard().
// Resolves to the charge object ({ id, status, ... }) — id is used as the
// order's id (same convention as Stripe's payment_intent id).
export async function chargeCard(token, amount) {
  const accessToken = await getValidAccessToken();

  // Step 1: authorize only (capture: false) — this is where AVS/CVV
  // verification happens and gets reported back; no money moves yet.
  const authResponse = await fetch(`${base()}/quickbooks/v4/payments/charges`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Request-Id': requestId(),
    },
    body: JSON.stringify({
      amount: Number(amount).toFixed(2),
      currency: 'USD',
      token,
      capture: false,
      context: { mobile: false, isEcommerce: true },
    }),
  });
  const auth = await parseResponse(authResponse, 'charge');

  console.log('QuickBooks charge authorization:', {
    id: auth.id,
    status: auth.status,
    avsZip: auth.avsZip,
    avsStreet: auth.avsStreet,
    cardSecurityCodeMatch: auth.cardSecurityCodeMatch,
  });

  if (auth.status !== 'AUTHORIZED') {
    throw new Error(`Payment ${(auth.status || 'failed').toLowerCase()}`);
  }
  if (auth.cardSecurityCodeMatch === 'Fail') {
    throw new Error('The security code on your card did not match. Please check your card details and try again.');
  }
  if (auth.avsZip === 'Fail' && auth.avsStreet === 'Fail') {
    throw new Error('The billing address did not match your card. Please check your billing details and try again.');
  }

  // Step 2: verification looked acceptable — actually capture the funds.
  const captureResponse = await fetch(`${base()}/quickbooks/v4/payments/charges/${auth.id}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Request-Id': requestId(),
    },
    body: JSON.stringify({
      amount: Number(amount).toFixed(2),
      context: { mobile: false, isEcommerce: true },
    }),
  });
  return parseResponse(captureResponse, 'capture');
}

// chargeId: the id returned by chargeCard() (stored as the order's id).
export async function refundCharge(chargeId, amount) {
  const accessToken = await getValidAccessToken();
  const response = await fetch(`${base()}/quickbooks/v4/payments/charges/${chargeId}/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Request-Id': requestId(),
    },
    body: JSON.stringify({ amount: Number(amount).toFixed(2) }),
  });
  return parseResponse(response, 'refund');
}
