import React from 'react';
import { useRouter } from 'next/router';
import { CartProvider, useCart } from '../lib/useCart';
import { loadPixel, fbTrack } from '../lib/fbPixel';
import { loadClarity } from '../lib/clarity';
import { captureAttribution, getStoredAttribution, describeTrafficSource } from '../lib/attribution';
import { getSessionId } from '../lib/session';
import ReserveScratchPopup from '../components/ReserveScratchPopup';

// Kept off checkout/admin/the ad-funnel pages — those already have their
// own single-minded call to action (place the order, review analytics),
// and a popup mid-checkout or mid-funnel would just compete with it.
//
// NOTE: the default prize codes (WELCOME10, RESERVED15 — the third panel
// is a deliberate non-winner, "Sorry") need to exist in the live discount
// store before this ships to real traffic — add any missing ones from
// /admin's Discounts tab (10%/15% off respectively) if they aren't there
// already. They're only auto-seeded (lib/discountsStore.js) on a store
// that's never had any codes written to it, which production likely isn't.
const RESERVE_POPUP_EXCLUDED_PREFIXES = ['/admin', '/checkout', '/offer', '/success'];

const HEARTBEAT_MS = 10000;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

// Fire-and-forget analytics pings live here (inside CartProvider, so it can
// read cart-open state) rather than duplicated across every page.
function Tracking() {
  const router = useRouter();
  const cart = useCart();
  const sessionIdRef = React.useRef(null);
  const isAdmin = router.pathname.startsWith('/admin');

  React.useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  // Meta Pixel — never on /admin, that traffic isn't customer activity.
  React.useEffect(() => {
    if (isAdmin || !PIXEL_ID) return;
    loadPixel(PIXEL_ID);
  }, [isAdmin]);

  // Microsoft Clarity — session recording/heatmaps, same admin exclusion.
  React.useEffect(() => {
    if (isAdmin || !CLARITY_PROJECT_ID) return;
    loadClarity(CLARITY_PROJECT_ID);
  }, [isAdmin]);

  React.useEffect(() => {
    if (isAdmin) return;
    fbTrack('PageView');
  }, [router.asPath, isAdmin]);

  // Which ad/campaign brought this visitor in — captured on every page load
  // so a landing page deep in the site (not just "/") still gets credit.
  React.useEffect(() => {
    if (isAdmin) return;
    captureAttribution();
  }, [router.asPath, isAdmin]);

  React.useEffect(() => {
    fetch('/api/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'pageview' }),
      keepalive: true,
    }).catch(() => {});
  }, [router.asPath]);

  React.useEffect(() => {
    const currentStage = () => {
      if (router.pathname === '/success') return 'purchased';
      if (router.pathname === '/checkout') return 'checkout';
      if (cart.open) return 'cart_open';
      return 'browsing';
    };

    // How far down the current page they've scrolled, 0-100 — recomputed
    // fresh on each 10s tick rather than via a scroll listener, consistent
    // with the rest of this heartbeat's "poll, don't stream" approach.
    const scrollPercent = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return 100;
      const pct = (window.scrollY / scrollable) * 100;
      return Math.min(100, Math.max(0, Math.round(pct)));
    };

    const sendHeartbeat = () => {
      if (!sessionIdRef.current) return;
      const { source, campaign } = describeTrafficSource(getStoredAttribution(), document.referrer);
      fetch('/api/track/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          stage: currentStage(),
          path: window.location.pathname,
          source,
          campaign,
          scrollPct: scrollPercent(),
        }),
        keepalive: true,
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [router.pathname, cart.open]);

  return null;
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const reservePopupEnabled = !RESERVE_POPUP_EXCLUDED_PREFIXES.some((p) => router.pathname.startsWith(p));

  return (
    <CartProvider>
      <Tracking />
      <div key={router.asPath} className="page-fade">
        <Component {...pageProps} />
      </div>
      <ReserveScratchPopup enabled={reservePopupEnabled} />
      <style jsx global>{`
        .page-fade {
          animation: page-fade-in 0.28s ease both;
        }
        @keyframes page-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .page-fade { animation: none; }
        }
      `}</style>
    </CartProvider>
  );
}
