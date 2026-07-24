// Server-side QuickBooks Payments Charges API client — charge (used by
// /api/qb-checkout, pages/checkout-qb.jsx's backup processor) and refund
// (used by /api/admin/orders/refund for any processor, including legacy
// Square/Stripe orders) share the same base URL/auth/error-parsing here.
//
// chargeCard authorizes first (capture: false — money isn't moved yet),
// checks the AVS/CVV verification fields Intuit returns on the
// authorization, and only then calls the separate Capture endpoint —
// synchronously, in the same request, immediately after a clean
// authorization. This is NOT a deferred/delayed capture: funds are captured
// at the time of the transaction, within this same function call, before
// chargeCard() ever returns — there's no later step, no webhook, no manual
// capture queue. The two-step shape exists only so a failed verification
// (bad CVV/AVS) never needs a void — it just leaves the authorization
// uncaptured, no money taken, instead of charging first and having to
// reverse it. A capture response can come back HTTP-200 with a non-CAPTURED
// status in the body (confirmed via a real transaction that authorized
// cleanly but failed on capture) — chargeCard() checks capture.status
// explicitly rather than trusting the HTTP status alone, since
// fulfillOrder() must never run against a charge that wasn't actually
// captured.
//
// Separately, Intuit's own risk engine can auto-void a transaction
// *asynchronously*, after a clean capture, entirely on their side — that's
// an account-level pattern (see git history: "Auto Void due to Risk
// Decline"), not something this synchronous authorize+capture flow can
// detect or prevent; nothing server-side here runs after this function
// returns.

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
// Resolves to the capture object ({ id, status, ... }) — id is used as the
// order's id (same convention as Square's payment id).
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

  // Step 2: verification looked acceptable — capture the funds now, in this
  // same request, immediately following authorization. Nothing about this
  // charge is left pending or deferred to a later step.
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

  // A capture call can return a well-formed 200 response whose own status
  // still isn't CAPTURED — parseResponse only catches a non-2xx HTTP
  // status, not this. fulfillOrder() must never run against a charge that
  // wasn't actually captured, since that's the difference between "shipped
  // and paid for" and "shipped for free."
  if (capture.status !== 'CAPTURED') {
    throw new Error(`Payment ${(capture.status || 'failed').toLowerCase()}`);
  }

  return capture;
}

// chargeId: the id of a QuickBooks-processed order (from chargeCard above,
// or a legacy order predating a processor switch away from QuickBooks).
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
