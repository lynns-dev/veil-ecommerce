// Tracks a Shop Pay session from the moment we hand off to Shopify's modal
// until the order webhook confirms it (or it's abandoned). Two things ride
// on this that the order webhook payload itself won't carry:
//
//   - the Meta eventId generated at handoff time, so the server-side
//     Purchase CAPI event (fired from the webhook, once the order is
//     confirmed) shares an eventId with the browser-side pixel fire and
//     Meta dedupes the pair instead of double-counting.
//   - attribution/sessionId captured at handoff time, for the same reason
//     every other processor here threads them through to fulfillOrder().
//
// Same KV-backed single-JSON-list shape as lib/checkoutLeadsStore.js — this
// collection is small (only sessions genuinely in flight) and short-lived
// (each entry is deleted once resolved or abandoned), so it doesn't need
// day-bucketing the way the order ledger does.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'shop_pay_pending_orders';

// A pending record left unresolved this long was very likely abandoned —
// the shopper closed the modal, lost their connection, or never finished —
// rather than a webhook that's just running late. Shopify's own guidance is
// that webhooks can lag, but not by hours; the reconciliation job
// (pages/api/shop-pay/reconcile.js) keeps trying up to this point, then
// stops bothering Shopify's API about it.
const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

async function readAll() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

async function writeAll(records) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(records),
  });
  if (!res.ok) throw new Error('Failed to save Shop Pay pending orders.');
}

export async function recordPendingShopPaySession({ sourceIdentifier, eventId, cart, amount, email, sessionId, attribution, url }) {
  const records = await readAll();
  records.push({
    sourceIdentifier,
    eventId,
    cart,
    amount,
    email: email || null,
    sessionId: sessionId || null,
    attribution: attribution || null,
    url: url || null,
    createdAt: new Date().toISOString(),
  });
  await writeAll(records);
}

// Called from the webhook once an order is fulfilled from it — flagged
// resolved in place rather than deleted immediately, because webhooks are
// commonly delivered more than once (Shopify retries on a non-200
// response, and can occasionally redeliver even after a 200 — standard
// at-least-once webhook behavior, not specific to Shopify). The webhook
// handler checks this flag before calling fulfillOrder() so a second
// delivery of the same order is recognized and skipped instead of being
// recorded twice — nothing else in this codebase's order storage
// deduplicates by order id. Actually pruned later by
// pruneAbandonedShopPaySessions() below.
export async function resolvePendingShopPaySession(sourceIdentifier, orderId) {
  if (!sourceIdentifier) return;
  const records = await readAll();
  const idx = records.findIndex((r) => r.sourceIdentifier === sourceIdentifier);
  if (idx === -1) return;
  records[idx] = { ...records[idx], resolved: true, resolvedOrderId: orderId || null, resolvedAt: new Date().toISOString() };
  await writeAll(records);
}

export async function findPendingShopPaySession(sourceIdentifier) {
  if (!sourceIdentifier) return null;
  const records = await readAll();
  return records.find((r) => r.sourceIdentifier === sourceIdentifier) || null;
}

// A resolved record only needs to survive long enough to catch a duplicate
// webhook delivery of the same order — Shopify's own retries happen within
// minutes to a few hours, not days, so there's no reason to keep dedup
// records around any longer than that.
const RESOLVED_RETENTION_MS = 60 * 60 * 1000;

// For the reconciliation cron: unresolved records old enough that a
// webhook should have arrived by now if the order actually went through,
// but not so old they've crossed into "the shopper simply never finished"
// territory.
export async function listStalePendingShopPaySessions({ olderThanMs = 10 * 60 * 1000 } = {}) {
  const records = await readAll();
  const now = Date.now();
  return records.filter((r) => {
    if (r.resolved) return false;
    const age = now - new Date(r.createdAt).getTime();
    return age >= olderThanMs && age < ABANDONED_AFTER_MS;
  });
}

// Housekeeping so the list doesn't grow forever with sessions nobody ever
// completed (or already-resolved ones only kept for dedup) — called from
// the same reconciliation cron, after it's done trying to resolve what it
// can.
export async function pruneAbandonedShopPaySessions() {
  const records = await readAll();
  const now = Date.now();
  const next = records.filter((r) => {
    const age = now - new Date(r.createdAt).getTime();
    if (r.resolved) return age < RESOLVED_RETENTION_MS;
    return age < ABANDONED_AFTER_MS;
  });
  if (next.length !== records.length) await writeAll(next);
  return records.length - next.length;
}
