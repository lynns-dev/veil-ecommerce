// What "on the site right now" means for admin's Live view — shared by the
// browser heartbeat (pages/_app.jsx), the endpoint that receives it
// (pages/api/track/heartbeat.js) and the endpoint admin reads
// (pages/api/admin/live.js), so the three can't drift apart.
//
// A visitor is live while a heartbeat from them is recent AND they are
// actually doing something. Having the page open is not enough: a tab left
// open in the background, a browser window abandoned overnight, or a bot
// holding the page open all keep pinging every 10 seconds indefinitely, and
// used to sit in the Live view for as long as they did.

// How long a presence entry survives without a fresh heartbeat.
export const PRESENCE_TTL_SECONDS = 25;

// A presence entry counts only if its own timestamp is this recent. The TTL
// above normally removes old entries by itself; this is the backstop for an
// entry that was ever stored without one, which would otherwise show as a
// live visitor permanently.
export const LIVE_FRESH_MS = 45 * 1000;

// No interaction and nothing changing for this long = no longer live. They
// reappear on their next scroll, click, keypress or page change.
export const IDLE_LIMIT_MS = 5 * 60 * 1000;

// Session ids are generated in the browser (lib/session.js) and arrive here
// as untrusted input that ends up in a storage key, so only the shape that
// generator produces is accepted.
export const SESSION_ID_RE = /^[A-Za-z0-9_-]{6,80}$/;

// Everything about a heartbeat that changes when a person is actually using
// the page. Two heartbeats with the same signature mean nothing happened in
// between. lastActiveAt is the browser's own "last scroll/click/keypress"
// time; browsers still running an older copy of the site don't send it, and
// for them the page, scroll position, focused field and stage stand in.
export function activitySignature({ stage, path, scrollPct, activeField, lastActiveAt }) {
  return [stage, path, scrollPct, activeField, lastActiveAt].map((v) => (v == null ? '' : String(v))).join('|');
}

export function isFreshPresence(entry, now = Date.now()) {
  return Boolean(entry) && Number.isFinite(entry.ts) && now - entry.ts <= LIVE_FRESH_MS && entry.ts <= now + LIVE_FRESH_MS;
}
