// Meta Conversions API — server-side event sends, paired with the browser
// Pixel (lib/fbPixel.js) via a shared event_id so Meta dedupes a pixel+CAPI
// pair instead of double-counting. Wired into pages/api/track/event.js
// (AddToCart, InitiateCheckout) and lib/orderFulfillment.js (Purchase).

import crypto from 'crypto';

const GRAPH_VERSION = 'v19.0';

// Meta's own match-quality guidance: hash email/phone (lowercased/trimmed
// first — an unnormalized value hashes to a different digest and simply
// fails to match), never external_id (Events Manager explicitly flags it
// as "Not hashed — no hash required" since it's already a random,
// non-PII per-session id, not something identifying on its own).
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashEmail(email) {
  if (!email) return undefined;
  return sha256(email.trim().toLowerCase());
}

// Meta expects digits only, no symbols/leading '+', country code included —
// this store is US-only (AddressFields has no country selector), so a bare
// 10-digit number gets a '1' prepended; anything already longer is assumed
// to include its country code and is left alone.
function hashPhone(phone) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;
  const withCountryCode = digits.length === 10 ? `1${digits}` : digits;
  return sha256(withCountryCode);
}

// Strips the wrappers proxies add — [::1]:443 brackets-and-port, a %eth0
// zone id — and unwraps IPv4-mapped IPv6 (::ffff:1.2.3.4), which is an IPv4
// address wearing a colon and must not be mistaken for a real IPv6 one.
function normalizeIp(raw) {
  let ip = String(raw || '').trim();
  const bracketed = ip.match(/^\[(.+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  // A bare "1.2.3.4:5678" — an IPv6 address has more than one colon, so a
  // single one here is always a port.
  else if ((ip.match(/:/g) || []).length === 1 && ip.includes('.')) ip = ip.split(':')[0];
  ip = ip.split('%')[0];
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : ip;
}

function isIpv6(ip) {
  return ip.includes(':');
}

// Loopback, LAN, and link-local addresses identify a proxy hop rather than
// the shopper, so they're worthless to Meta as match data — and one of them
// arriving from req.socket would otherwise beat a real client IPv4 in the
// "prefer IPv6" check below and get sent instead.
function isRoutable(ip) {
  if (!ip) return false;
  if (isIpv6(ip)) return !/^(::1|fe80:|f[cd])/i.test(ip);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  return !/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

// Picks the client's real IP from every source Vercel/Next can offer, and
// prefers a routable IPv6 address when one's available among them — Meta's
// own Events Manager recommends IPv6 client_ip_address over IPv4 where
// possible (many mobile carriers are IPv6-only, so an IPv4-only proxy hop
// upstream of this app would otherwise silently discard that signal).
//
// Preference order: public IPv6, then public IPv4, then whatever's left, so
// a request that only ever sees a private address still sends something
// rather than nothing.
function pickClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const candidates = [
    ...(forwardedFor ? forwardedFor.split(',') : []),
    req.headers['x-real-ip'],
    req.socket?.remoteAddress,
  ]
    .filter(Boolean)
    .map(normalizeIp)
    .filter(Boolean);

  return (
    candidates.find((ip) => isIpv6(ip) && isRoutable(ip)) ||
    candidates.find(isRoutable) ||
    candidates[0] ||
    null
  );
}

// fbp/fbc cookies, IP, and user agent all improve Meta's match quality —
// none of this is sensitive PII, so no hashing is needed (unlike email/phone
// below). email/phone/externalId are optional — pass whatever's actually
// known at the call site (e.g. Purchase has them, a bare AddToCart usually
// doesn't) and this only includes the fields it actually got.
export function getRequestUserData(req, { email, phone, externalId } = {}) {
  const cookies = req.cookies || {};
  const em = hashEmail(email);
  const ph = hashPhone(phone);
  return {
    client_ip_address: pickClientIp(req),
    client_user_agent: req.headers['user-agent'],
    fbp: cookies._fbp,
    fbc: cookies._fbc,
    ...(em ? { em } : {}),
    ...(ph ? { ph } : {}),
    ...(externalId ? { external_id: externalId } : {}),
  };
}

export async function sendCapiEvent({ eventName, eventId, eventSourceUrl, userData, customData }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.error('NEXT_PUBLIC_META_PIXEL_ID / META_CAPI_ACCESS_TOKEN are not set — skipping CAPI event.');
    return;
  }

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;
  if (testEventCode) body.test_event_code = testEventCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Meta CAPI event failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Meta CAPI request failed:', err.message);
  }
}
