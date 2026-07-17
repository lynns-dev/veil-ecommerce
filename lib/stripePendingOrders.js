// Holds the order details (items, attribution, etc.) a PaymentIntent needs
// for fulfillment, keyed by the PaymentIntent's own id. Payment Element
// supports redirect-based methods (Afterpay, Amazon Pay) where the browser
// leaves the page entirely, so fulfillment can't rely on a client-side call
// completing — it happens from the Stripe webhook instead, which only has
// the PaymentIntent id to work from. This is where it looks up the rest.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const TTL_SECONDS = 60 * 60 * 24; // redirect flows should finish in minutes, not days

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export async function savePendingOrder(paymentIntentId, order) {
  assertConfigured();
  await fetch(`${KV_URL}/set/stripe:pending:${paymentIntentId}?EX=${TTL_SECONDS}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(order),
  });
}

export async function getPendingOrder(paymentIntentId) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/stripe:pending:${paymentIntentId}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

// Deleted right after fulfillment so a redelivered webhook event (Stripe
// retries on anything but a 200) finds nothing and skips instead of
// fulfilling the same order twice.
export async function deletePendingOrder(paymentIntentId) {
  assertConfigured();
  await fetch(`${KV_URL}/del/stripe:pending:${paymentIntentId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}
