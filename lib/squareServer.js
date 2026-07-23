// Server-side Square Payments API client — charge (used by
// /api/square-checkout) and refund (used by /api/admin/orders/refund).
//
// UNVERIFIED THIS SESSION: unlike lib/squareClient.js's tokenize flow
// (confirmed against Square's real "Take a Card Payment" docs, pasted
// directly), the request/response shape below — endpoint, headers,
// field names, and the exact set of `status` values a payment can come
// back with — is built from general knowledge of a long-stable, widely
// documented API, not from primary docs read this session. Square's
// Payments API reference (developer.squareup.com/reference/square/
// payments-api) was asked for but not available.
//
// Directly applying today's lesson from the QuickBooks capture bug (an
// HTTP 200 response whose own status field indicated a failed payment,
// treated as success because only the HTTP status was checked): chargeCard
// below explicitly checks payment.status and throws on anything but
// COMPLETED, rather than trusting a 2xx response alone. If the real status
// value on success turns out to be something else (APPROVED is another
// plausible value for a non-autocompleted payment), this will fail loudly
// with a clear error instead of silently marking an unpaid order as paid —
// safer to be too strict here and have a real charge get wrongly rejected
// (annoying, visible, and reported immediately) than too loose and have a
// failed one get wrongly accepted (invisible until a customer or the bank
// tells you).
//
// Treat this whole file as unverified until a real charge and a real
// refund have each gone through end-to-end and been checked against what
// actually comes back.

const API_BASE = {
  sandbox: 'https://connect.squareupsandbox.com',
  production: 'https://connect.squareup.com',
};

// Square's REST API requires a date-versioned header on every call. This
// value was not confirmed against current docs — if Square rejects it as
// too old/invalid, that error will surface directly in the thrown message
// below, which is the signal to look up and update the real current
// version string.
const SQUARE_VERSION = '2025-01-23';

function base() {
  return API_BASE[process.env.SQUARE_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production'];
}

function accessToken() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set.');
  return token;
}

function headers() {
  return {
    'Square-Version': SQUARE_VERSION,
    Authorization: `Bearer ${accessToken()}`,
    'Content-Type': 'application/json',
  };
}

async function parseResponse(response, action) {
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    console.error(`Square ${action} — non-JSON response:`, response.status, raw.slice(0, 500));
    throw new Error(`Square returned an unexpected response (${response.status}): ${raw.slice(0, 200) || 'empty body'}`);
  }
  if (!response.ok) {
    console.error(`Square ${action} failed:`, response.status, JSON.stringify(data));
    const detail = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return data;
}

// token: single-use payment token from lib/squareClient.js's
// tokenizeSquareCard(). amount: dollars (converted to integer cents here,
// same convention as the QuickBooks/Stripe integrations this replaces).
// Resolves to the payment object ({ id, status, ... }) — id is used as the
// order's id, same convention as every other processor on this site.
export async function chargeCard(token, amount, { idempotencyKey, buyerEmail } = {}) {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error('SQUARE_LOCATION_ID is not set.');

  const response = await fetch(`${base()}/v2/payments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      source_id: token,
      idempotency_key: idempotencyKey || `veil-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      amount_money: { amount: Math.round(Number(amount) * 100), currency: 'USD' },
      location_id: locationId,
      ...(buyerEmail ? { buyer_email_address: buyerEmail } : {}),
    }),
  });
  const data = await parseResponse(response, 'charge');
  const payment = data.payment;

  console.log('Square charge:', { id: payment?.id, status: payment?.status });

  if (!payment || payment.status !== 'COMPLETED') {
    throw new Error(`Payment ${(payment?.status || 'failed').toLowerCase()}`);
  }
  return payment;
}

// paymentId: the id returned by chargeCard() (stored as the order's id).
export async function refundCharge(paymentId, amount, { idempotencyKey } = {}) {
  const response = await fetch(`${base()}/v2/refunds`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      idempotency_key: idempotencyKey || `veil-refund-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      payment_id: paymentId,
      amount_money: { amount: Math.round(Number(amount) * 100), currency: 'USD' },
    }),
  });
  const data = await parseResponse(response, 'refund');
  console.log('Square refund:', { id: data.refund?.id, status: data.refund?.status });
  return data.refund;
}
