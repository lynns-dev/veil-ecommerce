// Server-side QuickBooks Payments Charges API client — refund only.
//
// Checkout no longer charges through QuickBooks (replaced by Square, see
// lib/squareServer.js); this file is kept solely so /api/admin/orders/refund
// can still refund orders placed before the switch. The charge-side of this
// client (authorize-then-capture, AVS/CVV verification, and a real bug where
// a synchronously-failed capture was returned as a success because only
// auth.status was checked and never capture.status) is preserved in git
// history if it's ever needed again.

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

// chargeId: the id of a legacy QuickBooks-processed order.
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
