import React from 'react';
import { useRouter } from 'next/router';
import { CartProvider, useCart } from '../lib/useCart';
import { loadPixel, fbTrack } from '../lib/fbPixel';

const SESSION_STORAGE_KEY = 'veil-session-id';
const HEARTBEAT_MS = 10000;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// Fire-and-forget analytics pings live here (inside CartProvider, so it can
// read cart-open state) rather than duplicated across every page.
function Tracking() {
  const router = useRouter();
  const cart = useCart();
  const sessionIdRef = React.useRef(null);
  const isAdmin = router.pathname.startsWith('/admin');

  React.useEffect(() => {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    sessionIdRef.current = id;
  }, []);

  // Meta Pixel — never on /admin, that traffic isn't customer activity.
  React.useEffect(() => {
    if (isAdmin || !PIXEL_ID) return;
    loadPixel(PIXEL_ID);
  }, [isAdmin]);

  React.useEffect(() => {
    if (isAdmin) return;
    fbTrack('PageView');
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

    const sendHeartbeat = () => {
      if (!sessionIdRef.current) return;
      fetch('/api/track/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current, stage: currentStage() }),
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

  return (
    <CartProvider>
      <Tracking />
      <div key={router.asPath} className="page-fade">
        <Component {...pageProps} />
      </div>
      <style jsx global>{`
        .page-fade {
          animation: page-fade-in 0.28s ease both;
        }
        @keyframes page-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .page-fade { animation: none; }
        }
      `}</style>
    </CartProvider>
  );
}
