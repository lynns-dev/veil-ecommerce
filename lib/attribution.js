// Captures which ad/campaign brought a visitor in, so it can be attached to
// their order later (checkout often happens well after the ad click).
// Stored in localStorage (survives across the whole visit, not just one
// tab/session) and only overwritten when a NEW url actually carries
// utm/click-id params -- plain internal navigation between pages never
// clears a previously captured touch.

const STORAGE_KEY = 'veil-attribution';
const PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

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

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...found,
      landingPage: window.location.pathname,
      capturedAt: new Date().toISOString(),
    }));
  } catch (e) {
    // ignore storage write failures (e.g. private browsing quota)
  }
}

export function getStoredAttribution() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
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
