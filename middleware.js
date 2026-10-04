import { NextResponse } from 'next/server';
import { isOutsideServiceAreaCountry } from './lib/ipFilter';

const SESSION_COOKIE = 'admin_session';

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    // Every storefront page load — see storefrontResponse below. Static
    // files and API routes are left out.
    '/((?!api|_next|admin|.*\\..*).*)',
  ],
};

const FBC_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

// Sets Meta's _fbc (ClickID) cookie from the server the moment an ad click
// lands. The Pixel sets the same cookie from JavaScript, but Safari caps
// JS-set cookies at 7 days and an ad blocker stops the Pixel setting it at
// all — either way the Purchase that follows goes out with no ClickID and
// can't be tied back to the ad. A server-set cookie survives both, for
// Meta's full 90-day click window. Format: fb.1.<click time ms>.<fbclid>.
// An existing cookie for the same click keeps its original timestamp.
function setMetaClickId(req, res) {
  const fbclid = req.nextUrl.searchParams.get('fbclid');
  const existing = req.cookies.get('_fbc')?.value;
  if (!fbclid || (existing && existing.endsWith(`.${fbclid}`))) return res;
  res.cookies.set('_fbc', `fb.1.${Date.now()}.${fbclid}`, {
    path: '/',
    maxAge: FBC_MAX_AGE_SECONDS,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
  });
  return res;
}

// Tells the page which country the visitor is browsing from (Vercel's edge
// geo-IP, no external lookup), so pages/_app.jsx can skip loading the Meta
// Pixel for visitors outside the US — see lib/ipFilter.js. Only written when
// it changes, so most responses carry no Set-Cookie at all.
const GEO_COOKIE = 'veil_geo';

function setGeoTag(req, res) {
  const country = req.geo?.country || req.headers.get('x-vercel-ip-country');
  if (!country) return res;
  const tag = isOutsideServiceAreaCountry(country) ? 'outside' : 'us';
  if (req.cookies.get(GEO_COOKIE)?.value === tag) return res;
  res.cookies.set(GEO_COOKIE, tag, { path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax' });
  return res;
}

// Visitors arriving from these sites get a plain "not available" page instead
// of the store. Added for a Reddit thread being pushed by paid engagement
// (click farms clicking through to the site). Matches the host and any
// subdomain (www., old., out., np.). Remove an entry to let that traffic in
// again.
//
// Limits worth knowing: Reddit usually sends only "https://www.reddit.com/"
// as the referrer, not the thread's URL, so this blocks all Reddit click-
// throughs, not one thread. The Reddit app and copy-pasted links often send
// no referrer at all and can't be told apart from direct visits. The cookie
// below keeps a blocked browser blocked when it comes back without one.
const BLOCKED_REFERRER_HOSTS = ['reddit.com', 'redd.it'];
const BLOCKED_COOKIE = 'veil_ref_block';
const BLOCKED_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function isBlockedReferrer(req) {
  const referrer = req.headers.get('referer');
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return BLOCKED_REFERRER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function blockedResponse() {
  const res = new NextResponse(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not available</title></head>'
    + '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FCFBF7;color:#16140F;font-family:system-ui,sans-serif">'
    + '<p style="font-size:15px">This page isn’t available.</p></body></html>',
    { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
  res.cookies.set(BLOCKED_COOKIE, '1', { path: '/', maxAge: BLOCKED_COOKIE_MAX_AGE, sameSite: 'lax' });
  return res;
}

function storefrontResponse(req) {
  if (isBlockedReferrer(req) || req.cookies.get(BLOCKED_COOKIE)?.value === '1') {
    return blockedResponse();
  }
  const res = NextResponse.next();
  setMetaClickId(req, res);
  setGeoTag(req, res);
  return res;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return storefrontResponse(req);
  }

  // The login page/route itself must stay reachable without a session.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySession(token) : false;

  if (valid) return NextResponse.next();

  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', req.url);
  return NextResponse.redirect(loginUrl);
}

async function verifySession(token) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const res = await fetch(`${KV_URL}/get/admin_session:${token}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const data = await res.json();
    return Boolean(data.result);
  } catch {
    return false;
  }
}
