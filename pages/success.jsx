import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Marquee from '../components/Marquee';
import Footer from '../components/Footer';
import { useCart } from '../lib/useCart';
import { fbTrack } from '../lib/fbPixel';
import { T, S } from '../lib/theme';

export default function SuccessPage() {
  const router = useRouter();
  const { clear } = useCart();
  const [failed, setFailed] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!router.isReady) return;

    // Bankful's hosted payment page always redirects the shopper back here
    // rather than returning control to checkout.jsx's own JS — which also
    // means checkout.jsx's clear() call never runs for that path. This
    // effect is what has to do it instead. url_failed/url_pending point at
    // distinct ?status= values (see lib/bankfulServer.js); url_complete has
    // none, since actual fulfillment is decided by the signature-verified
    // webhook, not anything in this query string.
    const status = router.query.status;
    const raw = sessionStorage.getItem('veil-purchase');
    sessionStorage.removeItem('veil-purchase');

    if (status === 'pending') {
      setPending(true);
      return;
    }
    if (status === 'failed') {
      setFailed(true);
      return;
    }

    if (!raw) return;
    clear();
    try {
      const purchase = JSON.parse(raw);
      fbTrack('Purchase', {
        content_ids: purchase.contentIds,
        contents: purchase.contents,
        value: purchase.amount,
        currency: 'USD',
      }, purchase.eventId);
    } catch {
      // malformed sessionStorage value — nothing to track
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.status]);

  if (pending) {
    return (
      <div>
        <Header cartCount={0} onCartClick={() => {}} />
        <section style={{ maxWidth: 640, margin: '0 auto', padding: '120px 40px', textAlign: 'center' }}>
          <p style={S.label}>Payment pending</p>
          <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(32px,5vw,48px)', margin: '16px 0 20px' }}>
            Your payment is still processing.
          </h1>
          <p style={{ color: T.soft, fontSize: 16, marginBottom: 34 }}>
            We&rsquo;ll confirm your order by email as soon as it clears — no need to try again.
          </p>
          <Link href="/" style={S.btnOutline}>Return home</Link>
        </section>
        <Marquee />
        <Footer />
      </div>
    );
  }

  if (failed) {
    return (
      <div>
        <Header cartCount={0} onCartClick={() => {}} />
        <section style={{ maxWidth: 640, margin: '0 auto', padding: '120px 40px', textAlign: 'center' }}>
          <p style={S.label}>Payment not completed</p>
          <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(32px,5vw,48px)', margin: '16px 0 20px' }}>
            Something interrupted your payment.
          </h1>
          <p style={{ color: T.soft, fontSize: 16, marginBottom: 34 }}>
            You haven’t been charged, and your cart is still saved — please try again.
          </p>
          <Link href="/checkout" style={S.btnOutline}>Back to checkout</Link>
        </section>
        <Marquee />
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header cartCount={0} onCartClick={() => {}} />
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '120px 40px', textAlign: 'center' }}>
        <p style={S.label}>Thank you</p>
        <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(38px,5vw,60px)', margin: '16px 0 20px' }}>Your ritual is <span style={S.it}>on its way.</span></h1>
        <p style={{ color: T.soft, fontSize: 16, marginBottom: 34 }}>We’ve received your order and sent a confirmation to your email.</p>
        <Link href="/" style={S.btnOutline}>Return home</Link>
      </section>
      <Marquee />
      <Footer />
    </div>
  );
}
