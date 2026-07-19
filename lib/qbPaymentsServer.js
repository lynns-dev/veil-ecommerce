// Server-side QuickBooks Payments Charges API client — charge (used by
// /api/qb-checkout) and refund (used by /api/admin/orders/refund) share the
// same base URL/auth/error-parsing here instead of duplicating it.
//
// chargeCard sends the card directly in the charge request (rather than a
// separately-created token) so AVS/CVV verification actually runs against
// the card networks at authorization time. An earlier version of this
// integration tokenized the card client-side first and charged with just
// the resulting token — real transactions came back with every
// verification field (AVS address, AVS zip, CVV) as N/A and got
// auto-voided by Intuit's risk engine, which lines up with how tokens are
// meant for saving a card for later/repeat use (card networks generally
// disallow re-verifying CVV through a stored token) rather than a single
// immediate charge. Sending the card straight to the charge endpoint keeps
// AVS/CVV in the same request that actually authorizes against the network.

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

// card: { number, expMonth, expYear, cvc, name, street, city, region, postalCode, country }
// Resolves to the charge object ({ id, status, ... }) — id is used as the
// order's id (same convention as Stripe's payment_intent id).
export async function chargeCard({ card, amount }) {
  const accessToken = await getValidAccessToken();
  const response = await fetch(`${base()}/quickbooks/v4/payments/charges`, {
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
      card: {
        number: card.number.replace(/\s+/g, ''),
        expMonth: card.expMonth,
        expYear: card.expYear,
        cvc: card.cvc,
        name: card.name,
        address: {
          streetAddress: card.street,
          city: card.city,
          region: card.region,
          postalCode: card.postalCode,
          country: card.country || 'US',
        },
      },
      capture: true,
      context: { mobile: false, isEcommerce: true },
    }),
  });
  return parseResponse(response, 'charge');
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
