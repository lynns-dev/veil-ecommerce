// Browser side of admin's Paths tab (lib/journeys.js).
import { describeTrafficSource } from './attribution';

const COOKIE = 'site_vid';
const VISIT_SOURCE_KEY = 'site-visit-source';

// Long-lived first-party visitor id, read by the server from requests the
// site already makes, so one path can span several visits. Random, not
// derived from anything about the person.
export function ensureVisitorCookie() {
  if (typeof document === 'undefined') return;
  if (new RegExp(`(?:^|; )${COOKIE}=`).test(document.cookie)) return;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${id}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
}

// Where this visit came from, worked out once at the start of the visit
// from its own link and referrer. lib/attribution.js keeps the *first* ad
// click for the life of the browser, which would make every later return
// visit look like it came from that ad.
export function getVisitSource() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.sessionStorage.getItem(VISIT_SOURCE_KEY);
    if (cached) return cached;
  } catch { /* storage blocked: compute fresh */ }
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  let source = describeTrafficSource(params, document.referrer).source;
  if (params.utm_medium === 'email' || params.utm_source === 'email') source = 'Email';
  try { window.sessionStorage.setItem(VISIT_SOURCE_KEY, source); } catch { /* best-effort */ }
  return source;
}
