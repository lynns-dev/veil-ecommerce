// Server-side QuickBooks Payments Charges API client — charge (used by
// /api/qb-checkout, pages/checkout.jsx — the live checkout) and refund
// (used by /api/admin/orders/refund for any processor, including legacy
// Square/Stripe orders) share the same base URL/auth/error-parsing here.
//
// chargeCard authorizes first (capture: false — money isn't moved yet),
// checks the CVV verification field Intuit returns on the authorization
// (AVS/address is logged but no longer blocks capture — see the comment
// at that check below), and only then calls the separate Capture endpoint
// — synchronously, in the same request, immediately after a clean
// authorization. This is NOT a deferred/delayed capture: funds are captured
// at the time of the transaction, within this same function call, before
// chargeCard() ever returns — there's no later step, no webhook, no manual
// capture queue. The two-step shape exists only so a failed CVV check
// never needs a void — it just leaves the authorization uncaptured, no
// money taken, instead of charging first and having to reverse it. A
// capture response can come back HTTP-200 with a non-CAPTURED status in
// the body (confirmed via a real transaction that authorized cleanly but
// failed on capture) — chargeCard() checks capture.status explicitly
// rather than trusting the HTTP status alone, since fulfillOrder() must
// never run against a charge that wasn't actually captured.
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
    // capture/context.mobile/context.isEcommerce sent as strings ("false"/
    // "true"), not native JSON booleans — Intuit's own documented example
    // request for this endpoint shows these as string-typed
    // ("capture": "true", "mobile": "true", "isEcommerce": "false"), and
    // this codebase was sending real booleans instead. A type mismatch on
    // the context fields specifically — the signal Intuit's backend uses
    // to classify the transaction — lines up with the "industry code is
    // wrong to accept this type of card" decline (Result Code 5008) seen
    // live on real transactions: the auth step still returned Approved
    // (lenient enough to not reject outright), but something downstream
    // treated the mis-typed context as an unrecognized/default
    // classification that this card type isn't eligible under.
    body: JSON.stringify({
      amount: Number(amount).toFixed(2),
      currency: 'USD',
      token,
      capture: 'false',
      context: { mobile: 'false', isEcommerce: 'true' },
    }),
  });
  const auth = await parseResponse(authResponse, 'charge');

  // Full response, not a curated subset — a prior version of this log
  // only printed id/status/avsZip/avsStreet/cardSecurityCodeMatch, which
  // silently dropped whatever result-code/detail field Intuit actually
  // sends explaining a decline (the "Result Code: 5008" seen only by
  // cross-referencing the QuickBooks merchant dashboard by hand, not
  // visible anywhere in our own logs). This is still a 200-level response
  // even when Intuit declines the charge, so parseResponse's own
  // error-body logging (which only fires on a non-2xx HTTP status) never
  // sees it either.
  console.log('QuickBooks charge authorization:', JSON.stringify(auth));

  if (auth.status !== 'AUTHORIZED') {
    throw new Error(`Payment ${(auth.status || 'failed').toLowerCase()}`);
  }
  if (auth.cardSecurityCodeMatch === 'Fail') {
    throw new Error('The security code on your card did not match. Please check your card details and try again.');
  }
  // AVS (address) mismatch is deliberately NOT a hard decline — confirmed
  // live via a real transaction: Intuit's own processor approved the
  // authorization (Response: Approved, auth.status AUTHORIZED) while both
  // avsZip and avsStreet came back "Fail", and the hard-block that used to
  // sit here refused to capture it anyway, showing the shopper a decline
  // for an order the bank had already approved. The billing address this
  // form sends is always the shipping address (no separate billing-address
  // field) — plenty of real shoppers ship to an address that legitimately
  // differs from their card's billing address (gifts, work addresses,
  // etc.), which is not fraud and shouldn't be treated as an automatic
  // decline. CVV mismatch above stays a hard block — a wrong security code
  // is a much stronger card-not-present fraud signal than an address
  // mismatch. AVS results are still logged (below and via the log line
  // above) for manual review if a chargeback pattern shows up later.

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
    // Same string-typed context fields as the authorize call above, for
    // the same reason.
    body: JSON.stringify({
      amount: Number(amount).toFixed(2),
      context: { mobile: 'false', isEcommerce: 'true' },
    }),
  });
  const capture = await parseResponse(captureResponse, 'capture');

  // Full response for the same reason as the authorization log above —
  // this is where a decline's actual result code/detail would show up.
  console.log('QuickBooks charge capture:', JSON.stringify(capture));

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
