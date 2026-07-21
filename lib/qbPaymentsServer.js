// Server-side QuickBooks Payments Charges API client — charge (used by
// /api/qb-checkout) and refund (used by /api/admin/orders/refund) share the
// same base URL/auth/error-parsing here instead of duplicating it.
//
// Endpoint version: /v5/payments/..., matching lib/qbPayments.js's tokenize
// call — see the version note there about this being sourced from an
// unverified (possibly AI-generated, not scraped-from-docs) summary. If
// charges start failing here specifically with a 404/routing error, try
// reverting both this file and lib/qbPayments.js back to /v4 first.
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
  const response = await fetch(`${base()}/quickbooks/v5/payments/charges`, {
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
      capture: true,
      context: { mobile: false, isEcommerce: true },
    }),
  });
  return parseResponse(response, 'charge');
}

// chargeId: the id returned by chargeCard() (stored as the order's id).
export async function refundCharge(chargeId, amount) {
  const accessToken = await getValidAccessToken();
  const response = await fetch(`${base()}/quickbooks/v5/payments/charges/${chargeId}/refunds`, {
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
