// Requests from these IPs, or from Meta's own crawlers/bots, don't count
// toward site analytics (live visitors, funnel counters, recent-activity
// feed) or server-side Meta ad events -- IPs are the store owner's own
// testing/QA traffic, bots are Meta's link-preview/ad-review crawlers, and
// neither is a real customer. IP list is comma-separated so more can be
// added later via the env var alone.

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || null;
}

export function isExcludedIp(req) {
  const list = (process.env.EXCLUDED_ANALYTICS_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (list.length === 0) return false;

  const ip = getClientIp(req);
  return ip ? list.includes(ip) : false;
}

// Meta's crawlers identify themselves in their User-Agent -- this covers
// the link-preview crawler (shares in Messenger/Instagram/Facebook,
// "facebookexternalhit" and its older "Facebot" alias), its ad-quality/
// policy-review crawler ("meta-externalagent"), and the Facebook catalog/
// product-feed fetcher ("facebookcatalog"). None of these run the page's
// JS interactively like a real visitor -- when they do fetch tracking
// endpoints directly (e.g. an ad-review bot replaying a landing-page URL),
// this keeps them out of the live count and funnel numbers.
const META_BOT_UA_RE = /facebookexternalhit|facebot|meta-externalagent|facebookcatalog/i;

export function isMetaBot(req) {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' && META_BOT_UA_RE.test(ua);
}

export function isExcludedTraffic(req) {
  return isExcludedIp(req) || isMetaBot(req);
}

// The store only ships within the United States (pages/shipping.jsx), so a
// visitor browsing from anywhere else can't place an order. Traffic like that
// is almost entirely bots, scrapers, and click farms — e.g. paid engagement
// pushing a thread that links here — and counting it skews the funnel and
// feeds junk into Meta's ad optimization and retargeting audiences.
//
// US territories count as inside the service area. A missing country header
// (local dev, or a request that didn't come through Vercel's edge) is never
// treated as outside, so nothing is dropped by accident.
export const SERVICE_AREA_COUNTRIES = ['US', 'PR', 'GU', 'VI', 'AS', 'MP'];

export function isOutsideServiceAreaCountry(country) {
  return Boolean(country) && !SERVICE_AREA_COUNTRIES.includes(String(country).toUpperCase());
}

export function isOutsideServiceArea(req) {
  return isOutsideServiceAreaCountry(req.headers['x-vercel-ip-country']);
}
