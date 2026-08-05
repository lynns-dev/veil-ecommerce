// "Subscribe & Save" subscription records, stored in the same Upstash KV
// store as everything else. Two keys:
//   - square_subscription_plan -> the cached Catalog ids (see
//     lib/squareServer.js's ensureSubscriptionPlan) for the one-time
//     "VEIL Subscribe & Save" plan + its per-product variations, so that
//     Catalog setup only ever runs once, on whichever request happens to
//     be first.
//   - square_subscriptions -> JSON array of subscription records, one per
//     subscriber. Kept here (not just left to live in Square) so admin can
//     list/search them without a Square API round trip, and so the
//     webhook handler can cheaply map an invoice's subscriptionId back to
//     an email/product without calling Square's Subscriptions API again.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const PLAN_KEY = 'square_subscription_plan';
const SUBS_KEY = 'square_subscriptions';

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export async function getCachedSubscriptionPlan() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${PLAN_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

export async function saveSubscriptionPlan(plan) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${PLAN_KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error('Failed to save subscription plan config.');
}

export async function getSubscriptions() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${SUBS_KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

async function saveSubscriptions(subs) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${SUBS_KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(subs),
  });
  if (!res.ok) throw new Error('Failed to save subscriptions.');
}

export async function addSubscription(sub) {
  const existing = await getSubscriptions();
  const updated = [...existing, sub];
  await saveSubscriptions(updated);
  return updated;
}

// id here is Square's own subscription id — every caller (webhook, admin
// cancel action) already has that, not some separate local id.
export async function updateSubscription(id, patch) {
  const existing = await getSubscriptions();
  const idx = existing.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const updated = { ...existing[idx], ...patch };
  const all = [...existing];
  all[idx] = updated;
  await saveSubscriptions(all);
  return updated;
}

export async function findSubscription(id) {
  const existing = await getSubscriptions();
  return existing.find((s) => s.id === id) || null;
}

// Webhook idempotency: invoice.payment_made can in principle be redelivered
// (Square retries on a non-2xx response, and webhook delivery generally
// isn't exactly-once) — recording the same renewal twice would double
// revenue. processedInvoiceIds lives on the subscription record itself
// rather than a separate store, since a lookup here always starts from the
// subscription anyway.
export async function markInvoiceProcessed(subscriptionId, invoiceId) {
  const sub = await findSubscription(subscriptionId);
  if (!sub) return null;
  const processed = new Set(sub.processedInvoiceIds || []);
  processed.add(invoiceId);
  return updateSubscription(subscriptionId, { processedInvoiceIds: [...processed] });
}

export function invoiceAlreadyProcessed(sub, invoiceId) {
  return Boolean(sub?.processedInvoiceIds?.includes(invoiceId));
}
