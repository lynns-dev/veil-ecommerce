// Order ledger and funnel event counters, both day-bucketed in the same
// Upstash KV store used elsewhere. Keys use the calendar date
// (YYYY-MM-DD) in the store's own Pacific timezone, not UTC — "today" in
// the admin dashboard should roll over at midnight for the person actually
// looking at it, not at 4/5pm Pacific when UTC happens to tick over.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const STORE_TIMEZONE = 'America/Los_Angeles';

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// en-CA formats as YYYY-MM-DD directly; DateTimeFormat handles the
// PST/PDT transition automatically so this stays correct year-round.
export function todayKey() {
  return dateFormatter.format(new Date());
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

// Timestamped event log for the "last few minutes" live-activity view — a
// Redis sorted set (score = timestamp ms) so a sliding window is a single
// ZRANGEBYSCORE. Entries older than RETENTION_MS are trimmed on every write
// so the set never grows unbounded; nothing needs this data past a few
// minutes, unlike the day-bucketed counters/order ledger above.
const RETENTION_MS = 15 * 60 * 1000;
const RECENT_EVENTS_KEY = 'events:recent';

async function redisCommand(command) {
  assertConfigured();
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redis command failed.');
  return data.result;
}

export async function logEvent(type, meta = {}) {
  const now = Date.now();
  const entry = JSON.stringify({ type, ts: now, ...meta });
  await redisCommand(['ZADD', RECENT_EVENTS_KEY, String(now), entry]);
  await redisCommand(['ZREMRANGEBYSCORE', RECENT_EVENTS_KEY, '-inf', String(now - RETENTION_MS)]);
}

export async function getRecentEvents(windowMs = 5 * 60 * 1000) {
  const since = Date.now() - windowMs;
  const raw = await redisCommand(['ZRANGEBYSCORE', RECENT_EVENTS_KEY, String(since), '+inf']);
  return (raw || []).map((entry) => {
    try {
      return JSON.parse(entry);
    } catch {
      return null;
    }
  }).filter(Boolean);
}
