// Holds the order details (items, email, shipping, attribution) a Bankful
// hosted-page payment needs for fulfillment, keyed by our own xtl_order_id.
// The hosted page always redirects the browser off-site, and the
// url_callback webhook that actually triggers fulfillment only carries
// Bankful's own transaction fields (TRANS_ORDER_ID, XTL_ORDER_ID, amount,
// status) — not cart contents — so this is where the webhook looks up the
// rest. Same pattern as the old lib/stripePendingOrders.js.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const TTL_SECONDS = 60 * 60 * 24; // redirect flows should finish in minutes, not days

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export async function savePendingOrder(orderId, order) {
  assertConfigured();
  await fetch(`${KV_URL}/set/bankful:pending:${orderId}?EX=${TTL_SECONDS}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(order),
  });
}

export async function getPendingOrder(orderId) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/bankful:pending:${orderId}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

// Deleted right after fulfillment so a redelivered/duplicate callback (the
// docs explicitly warn Bankful may send more than one for the same
// transaction) finds nothing and skips instead of fulfilling twice.
export async function deletePendingOrder(orderId) {
  assertConfigured();
  await fetch(`${KV_URL}/del/bankful:pending:${orderId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}
