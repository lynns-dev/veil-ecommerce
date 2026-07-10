// Order ledger and funnel event counters, both day-bucketed in the same
// Upstash KV store used elsewhere. Keys use the UTC calendar date
// (YYYY-MM-DD) so "today" is unambiguous regardless of where a request
// originates from.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordOrder(order) {
  assertConfigured();
  const key = `orders:${todayKey()}`;
  const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  const existing = data.result ? JSON.parse(data.result) : [];
  const updated = [...existing, order];
  await fetch(`${KV_URL}/set/${key}?EX=${60 * 60 * 24 * 45}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  return updated;
}

export async function getOrders(dateKey = todayKey()) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/orders:${dateKey}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

const EVENT_NAMES = ['pageview', 'addtocart', 'checkout_start', 'purchase'];

export async function incrementEvent(name) {
  if (!EVENT_NAMES.includes(name)) return;
  assertConfigured();
  const key = `events:${todayKey()}:${name}`;
  await fetch(`${KV_URL}/incr/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  // Give the counter the same retention as the order ledger; INCR creates
  // the key with no TTL, so set one after the fact (cheap, idempotent).
  await fetch(`${KV_URL}/expire/${key}/${60 * 60 * 24 * 45}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

export async function getEventCounts(dateKey = todayKey()) {
  assertConfigured();
  const entries = await Promise.all(
    EVENT_NAMES.map(async (name) => {
      const res = await fetch(`${KV_URL}/get/events:${dateKey}:${name}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      const data = await res.json();
      return [name, Number(data.result) || 0];
    })
  );
  return Object.fromEntries(entries);
}
