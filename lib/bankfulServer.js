// Bankful's direct "Payment Service" API — card details are collected on
// our own /checkout page and sent straight to Bankful from this server;
// unlike a hosted-page/redirect integration, raw card data does pass
// through our server here. That's a deliberate choice (see pages/checkout.jsx)
// to keep card entry on-page instead of redirecting the shopper off-site —
// it does mean this app is in PCI DSS SAQ D scope rather than the lighter
// SAQ A, since raw card data touches server-side code, however briefly and
// however never-persisted. Card details are never logged or stored; every
// charge is a single one-shot CAPTURE call, nothing is written to our own
// database or KV store.
//
// Two different base URLs are documented (live vs. sandbox), but Bankful's
// own curl examples consistently target api.paybybankful.com even when
// using "sandbox_username" credentials — it's not clear from their docs
// alone whether api-dev1.bankfulportal.com is actually a separate
// functioning sandbox host or just what's listed. Confirm with Bankful
// support which host your sandbox credentials actually work against before
// assuming BANKFUL_BASE_URL's default here is correct.
//
// Unlike Bankful's Hosted Payment Page product, this direct transaction API
// is not documented as using any request signing (no HMAC/signature field
// appears anywhere in the Payment Service docs) — just req_username/
// req_password in the POST body itself.

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

async function postTransaction(fields) {
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
  return { res, data };
}

// Only documented on the Cancel-Transaction-Failed response, but the
// underlying gateway response shape is shared across transaction types, so
// this is used as the decline-message fallback everywhere.
function declineMessage(data) {
  return data.ERROR_MESSAGE || data.API_ADVICE || data.SERVICE_ADVICE || data.PROCESSOR_ADVICE
    || `Payment ${data.TRANS_STATUS_NAME || 'failed'}`;
}

// One-shot Sale transaction (transaction_type=CAPTURE): authorizes and
// captures in a single call, no separate settlement step. Throws on any
// non-APPROVED response so callers can treat this as "either it worked or
// it threw" rather than having to re-check TRANS_STATUS_NAME themselves.
export async function chargeCard({
  amount, orderId, cardNumber, expMonth, expYear, cvc,
  email, firstName, lastName, phone, address, city, state, zip, country,
}) {
  const { username, password } = credentials();

  const fields = {
    req_username: username,
    req_password: password,
    transaction_type: 'CAPTURE',
    pmt_numb: cardNumber,
    pmt_key: cvc,
    // Bankful's documented format is MM/YYYY.
    pmt_expiry: `${expMonth}/${expYear}`,
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
  };

  const { res, data } = await postTransaction(fields);
  if (!res.ok || data.TRANS_STATUS_NAME !== 'APPROVED') {
    throw new Error(declineMessage(data));
  }
  return data;
}

// orderId: Bankful's TRANS_ORDER_ID from the original CAPTURE (stored as
// the order's id) — explicitly documented as "This ID should be used in
// the refund transaction call."
export async function refundCharge(orderId, amount) {
  const { username, password } = credentials();
  const fields = {
    req_username: username,
    req_password: password,
    transaction_type: 'REFUND',
    request_ref_po_id: orderId,
    amount: Number(amount).toFixed(2),
  };

  const { res, data } = await postTransaction(fields);
  if (!res.ok || data.TRANS_STATUS_NAME !== 'APPROVED') {
    throw new Error(declineMessage(data));
  }
  return data;
}
