import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'admin_session';

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    // Storefront page loads that arrive from a Meta ad click — see
    // setMetaClickId below. Static files and API routes are left out.
    {
      source: '/((?!api|_next|admin|.*\\..*).*)',
      has: [{ type: 'query', key: 'fbclid' }],
    },
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
function setMetaClickId(req) {
  const res = NextResponse.next();
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

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return setMetaClickId(req);
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
