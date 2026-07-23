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
//
// A second, distinct gap turned up after the above fix was already live: a
// real transaction authorized cleanly (full AVS/CVV match, a real
// authorization code, result code 0) and was then captured — but the
// capture response itself came back with a blank authorization code and
// an error result code, while chargeCard() returned it as a normal
// success anyway. It only ever checked the auth response's status, never
// the capture response's — an HTTP-200 capture with a failing status in
// the body sailed straight through to fulfillOrder(). This was not the
// account-level "Auto Void due to Risk Decline" pattern described above
// (that happens asynchronously, after a clean capture, on Intuit's side);
// this was a capture that failed synchronously and got treated as if it
// hadn't. Fixed by checking capture.status the same way auth.status
// already was.

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
  const capture = await parseResponse(captureResponse, 'capture');

  console.log('QuickBooks charge capture:', {
    id: capture.id,
    status: capture.status,
    avsZip: capture.avsZip,
    avsStreet: capture.avsStreet,
    cardSecurityCodeMatch: capture.cardSecurityCodeMatch,
  });

  // The capture call can return a well-formed 200 response whose own
  // status still isn't CAPTURED — found via a real transaction where
  // authorization showed a full AVS/CVV match and a real auth code, but
  // the capture record came back with a blank auth code and an error
  // result code, and this function returned it as if it had succeeded
  // anyway. parseResponse only catches a non-2xx HTTP status, not this —
  // fulfillOrder() must never run against a charge that wasn't actually
  // captured, since that's the difference between "shipped and paid for"
  // and "shipped for free."
  if (capture.status !== 'CAPTURED') {
    throw new Error(`Payment ${(capture.status || 'failed').toLowerCase()}`);
  }

  return capture;
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
