// Bankful Hosted Payment Page — server-side signing, payload building, and
// refunds. Card details are never collected on our own page: checkout
// redirects the shopper to a Bankful-hosted page to pay, so this file never
// touches raw card data at all, unlike a direct-API card integration would.
//
// Two different base URLs are documented (live vs. sandbox), but Bankful's
// own curl examples for both the direct transaction API *and* the hosted
// page consistently target api.paybybankful.com even when using
// "sandbox_username" credentials — it's not clear from their docs alone
// whether api-dev1.bankfulportal.com is actually a separate functioning
// sandbox host or just what's listed. Confirm with Bankful support which
// host your sandbox credentials actually work against before assuming
// BANKFUL_BASE_URL's default here is correct.
//
// Signing: HMAC-SHA256, key = the merchant's Bankful password
// (BANKFUL_PASSWORD), message = every non-empty field being sent (or, for
// verifying a response, every field Bankful sent back except SIGNATURE
// itself), sorted alphabetically by key and concatenated as key-then-value
// pairs with no separators at all — not "key=value&", literally
// "keyvaluekeyvalue...". Result is hex-encoded and sent/compared as the
// signature field. This exact algorithm is documented for both the hosted
// page's outbound signature and verifying TRANS_STATUS_NAME callbacks.

import crypto from 'crypto';

const API_BASE = {
  live: 'https://api.paybybankful.com',
  sandbox: 'https://api-dev1.bankfulportal.com',
};

function base() {
  return process.env.BANKFUL_BASE_URL || API_BASE[process.env.BANKFUL_ENVIRONMENT === 'live' ? 'live' : 'sandbox'];
}

function credentials() {
  const username = process.env.BANKFUL_USERNAME;
  const password = process.env.BANKFUL_PASSWORD;
  if (!username || !password) {
    throw new Error('BANKFUL_USERNAME / BANKFUL_PASSWORD are not set.');
  }
  return { username, password };
}

// Sorts non-empty fields alphabetically by key and concatenates as
// key+value with no separators — the exact string Bankful signs/expects,
// per their documented examples.
function signingString(fields) {
  return Object.keys(fields)
    .filter((key) => key !== 'signature' && fields[key] !== undefined && fields[key] !== null && fields[key] !== '')
    .sort()
    .map((key) => `${key}${fields[key]}`)
    .join('');
}

function sign(fields, password) {
  return crypto.createHmac('sha256', password).update(signingString(fields)).digest('hex');
}

// Builds the full field set (including signature) for the hosted-page
// initiation POST. url_cancel/url_complete/url_failed/url_pending are
// distinct pages on our own site so the browser-facing outcome doesn't
// depend on parsing/verifying Bankful's signed redirect params client-side
// — the only place that's actually trusted for fulfillment is the
// signature-verified url_callback webhook (see bankful-webhook.js).
export function buildHostedPagePayload({ amount, orderId, email, firstName, lastName, phone, address, city, state, zip, country, baseUrl }) {
  const { username, password } = credentials();

  const fields = {
    req_username: username,
    transaction_type: 'CAPTURE',
    cart_name: 'Hosted-Page',
    return_redirect_url: 'Y',
    amount: Number(amount).toFixed(2),
    request_currency: 'USD',
    xtl_order_id: orderId,
    cust_email: email || undefined,
    cust_fname: firstName || undefined,
    cust_lname: lastName || undefined,
    cust_phone: phone || undefined,
    bill_addr: address || undefined,
    bill_addr_city: city || undefined,
    bill_addr_state: state || undefined,
    bill_addr_zip: zip || undefined,
    bill_addr_country: country || 'US',
    url_cancel: `${baseUrl}/checkout`,
    url_complete: `${baseUrl}/success`,
    url_failed: `${baseUrl}/success?status=failed`,
    url_pending: `${baseUrl}/success?status=pending`,
    url_callback: `${baseUrl}/api/bankful-webhook`,
  };

  fields.signature = sign(fields, password);
  return fields;
}

// Posts the built payload server-side (rather than having the browser POST
// directly to Bankful) so we can request return_redirect_url=Y and get back
// a JSON { redirect_url } to send the shopper to, instead of relying on
// Bankful's raw POST response being renderable as a page — safer to control
// from our own redirect than to guess what a direct-form-post response
// looks like.
export async function initiateHostedPagePayment(payload) {
  const res = await fetch(`${base()}/front-calls/go-in/hosted-page-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Bankful returned an unexpected response (${res.status}): ${raw.slice(0, 200) || 'empty body'}`);
  }
  if (!res.ok || data.status === 'error' || !data.redirect_url) {
    throw new Error(data.errorMessage || `Could not start Bankful checkout (${res.status})`);
  }
  return data.redirect_url;
}

// Verifies a signed payload Bankful sent us (the url_callback webhook body,
// or in principle the url_complete query string) actually came from
// Bankful — removes SIGNATURE, re-signs the rest, and compares. Never trust
// TRANS_STATUS_NAME/amount from an unverified payload.
export function verifyCallbackSignature(fields) {
  const { password } = credentials();
  const { SIGNATURE, signature, ...rest } = fields;
  const provided = SIGNATURE || signature;
  if (!provided) return false;
  const expected = sign(rest, password);
  // Lengths are always equal here (both hex SHA-256 digests) but
  // timingSafeEqual throws on mismatched lengths, so guard first rather
  // than letting a malformed payload turn into an unhandled exception.
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided.toLowerCase()));
}

// orderId: Bankful's TRANS_ORDER_ID from the original CAPTURE (stored as
// the order's id). Documented under "Refund Hosted" as a *different*
// mechanism (request_action=CCCREDIT against the plain transaction API)
// than the direct-card-API refund docs elsewhere (transaction_type=REFUND)
// — using CCCREDIT here since that's the one explicitly paired with
// hosted-page transactions, but this hasn't been verified against a real
// sandbox transaction. Confirm with Bankful support if refunds fail.
export async function refundHostedTransaction(orderId, amount) {
  const { username, password } = credentials();
  const fields = {
    req_username: username,
    req_password: password,
    request_action: 'CCCREDIT',
    amount: Number(amount).toFixed(2),
    request_ref_po_id: orderId,
  };
  fields.signature = sign(fields, password);

  const res = await fetch(`${base()}/api/transaction/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Bankful returned an unexpected response (${res.status}): ${raw.slice(0, 200) || 'empty body'}`);
  }
  if (!res.ok || data.TRANS_STATUS_NAME === 'DECLINED') {
    const message = data.ERROR_MESSAGE || data.API_ADVICE || data.PROCESSOR_ADVICE || `Refund ${data.TRANS_STATUS_NAME || 'failed'}`;
    throw new Error(message);
  }
  return data;
}
