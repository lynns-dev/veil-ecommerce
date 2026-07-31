// Resolves a Meta ad-object id (ad set or ad/creative) to its human-readable
// name via the Marketing API, purely for display in admin's Order source.
//
// Why this is needed at all: an ad's URL parameters can be tagged with
// Meta's ID-based dynamic macro ({{adset.id}}, {{ad.id}}) instead of the
// name-based one ({{adset.name}}, {{ad.name}}) — the click still lands with
// a real value in adset_name/ad_name (or utm_content/utm_term), it's just a
// bare numeric id rather than something readable. This resolves that id to
// a name for display without ever touching the raw captured value stored on
// the order — lib/attribution.js's describeAdPlacement() still returns
// exactly what was captured; resolution happens as a separate, best-effort
// step server-side (pages/api/admin/orders.js) since it needs the Marketing
// API token, which must never reach the browser.
//
// Requires META_MARKETING_ACCESS_TOKEN — a Marketing API token with
// ads_read permission on the ad account that owns these objects. This is a
// different scope from META_CAPI_ACCESS_TOKEN (Conversions API events
// only); reusing that token here will just fail permission checks. Without
// it configured, resolveAdObjectName() returns the id back unchanged
// (never throws), so admin falls back to exactly today's behavior — an id
// shown as-is — rather than breaking the orders list.

const GRAPH_VERSION = 'v19.0';
// Ad set/ad names rarely change, so a resolved name is cached for a week.
// A miss (deleted object, no permission, bad id) is cached far more
// briefly — long enough to stop hammering the Graph API on every admin
// page load, short enough that fixing the token/permission takes effect
// within hours, not a week.
const RESOLVED_TTL_SECONDS = 60 * 60 * 24 * 7;
const MISS_TTL_SECONDS = 60 * 60 * 6;

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// Meta ad-object ids are bare numeric strings (typically 15-17 digits) —
// this is what distinguishes an unresolved id from an already-human name
// (which will have spaces/letters) without needing a network round trip
// just to tell the difference.
function looksLikeMetaObjectId(value) {
  return /^\d{6,}$/.test(String(value || '').trim());
}

async function cacheGet(id) {
  if (!KV_URL || !KV_TOKEN) return undefined;
  try {
    const res = await fetch(`${KV_URL}/get/meta_ad_name:${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const data = await res.json();
    // Stored value can legitimately be JSON `null` (a cached miss) — that's
    // still "found in cache", distinct from never having been cached at all.
    return data.result != null ? JSON.parse(data.result) : undefined;
  } catch {
    return undefined;
  }
}

async function cacheSet(id, value, ttlSeconds) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/set/meta_ad_name:${id}?EX=${ttlSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify(value),
    });
  } catch {
    // best-effort cache — a write failure just means the next lookup
    // re-hits the Graph API instead of the cache, not a broken page.
  }
}

async function fetchNameFromGraph(id) {
  const token = process.env.META_MARKETING_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${id}?fields=name&access_token=${token}`);
    const data = await res.json();
    if (!res.ok || !data.name) return null;
    return data.name;
  } catch (err) {
    console.error('Meta ad object name lookup failed:', err.message);
    return null;
  }
}

// Resolves one id. Never throws — a lookup failure (missing token, no
// permission, deleted object, network error) just returns the original
// value unchanged, so a display-only feature can never break the orders
// list it's decorating.
export async function resolveAdObjectName(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value || !looksLikeMetaObjectId(value)) return value || null;

  const cached = await cacheGet(value);
  if (cached !== undefined) return cached || value;

  const name = await fetchNameFromGraph(value);
  await cacheSet(value, name, name ? RESOLVED_TTL_SECONDS : MISS_TTL_SECONDS);
  return name || value;
}

// Resolves several ids in parallel, deduped — orders.js calls this once per
// request with every distinct adset/ad id across the whole order batch,
// rather than resolving per-order (the same ad set is often behind many
// orders, and resolving it once instead of N times is both faster and
// cheaper against the Graph API and the KV cache).
export async function resolveAdObjectNames(rawValues) {
  const unique = [...new Set(rawValues.filter(Boolean).map((v) => String(v).trim()))];
  const resolved = await Promise.all(unique.map((id) => resolveAdObjectName(id)));
  return new Map(unique.map((id, i) => [id, resolved[i]]));
}
