// Captures which ad/campaign brought a visitor in, so it can be attached to
// their order later (checkout often happens well after the ad click).
// Stored in localStorage (survives across the whole visit, not just one
// tab/session) and only overwritten when a NEW url actually carries
// utm/click-id params -- plain internal navigation between pages never
// clears a previously captured touch.

const STORAGE_KEY = 'veil-attribution';
// Meta only honors a click id for 90 days after the click — past that an
// fbc is just noise in the event, so a stale one isn't sent.
const FBC_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
// adset_name/ad_name/campaign_name aren't standard UTM params — they're what
// you get from Meta URL tags written as `adset_name={{adset.name}}` instead
// of folding those values into utm_content/utm_term. Both styles are common,
// so capture either and let describeAdPlacement() below sort out which won.
const PARAM_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'campaign_name', 'adset_name', 'ad_name',
  'fbclid', 'gclid',
];

export function captureAttribution() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const found = {};
  let hasAny = false;
  for (const key of PARAM_KEYS) {
    const value = params.get(key);
    if (value) {
      found[key] = value;
      hasAny = true;
    }
  }
  if (!hasAny) return;

  const now = Date.now();
  // Meta's ClickID parameter (fbc), built the way Meta specifies it:
  // fb.<subdomain_index>.<click time in ms>.<fbclid>. Kept here alongside
  // the raw fbclid so the order's Purchase event can still send it when the
  // _fbc cookie is gone. The cookie (set by the Pixel, and by middleware.js
  // server-side) is preferred when present; this is the fallback for when
  // it isn't (Pixel blocked, cookie cleared or expired by the browser).
  if (found.fbclid) {
    const cookieFbc = readCookie('_fbc');
    found.fbc = cookieFbc && cookieFbc.endsWith(`.${found.fbclid}`)
      ? cookieFbc
      : `fb.1.${now}.${found.fbclid}`;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...found,
      landingPage: window.location.pathname,
      capturedAt: new Date(now).toISOString(),
    }));
  } catch (e) {
    // ignore storage write failures (e.g. private browsing quota)
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// The click time encoded in an fbc value (its third dot-separated part).
function fbcIsFresh(fbc) {
  const createdAt = Number(String(fbc || '').split('.')[2]);
  return Number.isFinite(createdAt) && Date.now() - createdAt < FBC_MAX_AGE_MS;
}

function readStoredAttribution() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// What every checkout path sends with an order. On top of the stored touch,
// this snapshots Meta's _fbc/_fbp cookies at checkout time, so the
// server-side Purchase event (lib/orderFulfillment.js) has them on the order
// itself and doesn't depend solely on the cookies riding along on the
// checkout request.
export function getStoredAttribution() {
  if (typeof window === 'undefined') return null;
  const stored = readStoredAttribution();
  const cookieFbc = readCookie('_fbc');
  const fbp = readCookie('_fbp');
  const fbc = [cookieFbc, stored?.fbc].find((value) => value && fbcIsFresh(value)) || null;
  if (!stored && !fbc && !fbp) return null;
  const { fbc: _storedFbc, ...rest } = stored || {};
  return {
    ...rest,
    ...(fbc ? { fbc } : {}),
    ...(fbp ? { fbp } : {}),
  };
}

// Which campaign / ad set / ad the click came from, pulled out of whatever
// naming style the ad's URL tags used.
//
// Meta's own convention maps its dynamic params onto UTMs — {{campaign.name}}
// to utm_campaign, {{adset.name}} to utm_content, {{ad.name}} to utm_term —
// so those are the fallback. An explicitly named param wins when present,
// because "adset_name" can only mean one thing, whereas utm_content is also
// used by plenty of setups to mean the ad rather than the ad set.
//
// Every value here is whatever was typed into Ads Manager. Nothing derives
// it, so a blank means the ad's URL simply didn't carry it.
export function describeAdPlacement(attr) {
  return {
    campaign: attr?.campaign_name || attr?.utm_campaign || null,
    adset: attr?.adset_name || attr?.utm_content || null,
    ad: attr?.ad_name || attr?.utm_term || null,
  };
}

// Best-effort human label for where a visitor came from, for the live admin
// view. Unlike getStoredAttribution() (which only captures a touch when a
// utm/click-id param is present, since that's all an order needs), this also
// falls back to document.referrer so someone who arrived from an organic
// search or another site still gets a real label instead of just "Direct".
export function describeTrafficSource(attr, referrer) {
  if (attr?.utm_source) return { source: attr.utm_source, campaign: attr.utm_campaign || null };
  if (attr?.fbclid) return { source: 'Facebook/Instagram ad', campaign: null };
  if (attr?.gclid) return { source: 'Google ad', campaign: null };

  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '');
      const isOwnSite = typeof window !== 'undefined' && host === window.location.hostname;
      if (host && !isOwnSite) {
        if (/google\./.test(host)) return { source: 'Google (organic)', campaign: null };
        if (/bing\./.test(host)) return { source: 'Bing (organic)', campaign: null };
        if (/duckduckgo\./.test(host)) return { source: 'DuckDuckGo (organic)', campaign: null };
        if (/yahoo\./.test(host)) return { source: 'Yahoo (organic)', campaign: null };
        if (/(facebook|instagram)\./.test(host)) return { source: 'Facebook/Instagram', campaign: null };
        if (/tiktok\./.test(host)) return { source: 'TikTok', campaign: null };
        if (/pinterest\./.test(host)) return { source: 'Pinterest', campaign: null };
        return { source: host, campaign: null };
      }
    } catch (e) {
      // malformed referrer — fall through to Direct
    }
  }

  return { source: 'Direct', campaign: null };
}
