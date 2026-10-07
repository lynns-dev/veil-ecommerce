// Where Afterpay sends the shopper back after approving (or cancelling)
// (lib/afterpay.js). Captures the payment, then hands off to /success the
// same way the card checkout does — including the browser Pixel Purchase,
// which shares its event id with the server-side one.

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCart } from '../../lib/useCart';
import { clearCheckoutProgress } from '../../lib/checkoutProgress';
import { T, S } from '../../lib/theme';

const PURCHASE_KEY = 'veil-purchase';

export default function AfterpayReturn() {
  const router = useRouter();
  const { clear } = useCart();
  const [error, setError] = React.useState('');
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!router.isReady || started.current) return;
    started.current = true;
    const { ref, orderToken, status } = router.query;
    if (status !== 'SUCCESS') {
      setError('Afterpay checkout was cancelled.');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/afterpay/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref, orderToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Payment failed');
        sessionStorage.setItem(PURCHASE_KEY, JSON.stringify({
          eventId: data.eventId,
          orderId: data.orderId,
          amount: data.amount,
          contentIds: (data.items || []).map((i) => i.id),
          contents: (data.items || []).map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
        }));
        clearCheckoutProgress();
        await router.replace('/success');
        clear();
      } catch (err) {
        setError(err.message || 'Something went wrong with Afterpay.');
      }
    })();
  }, [router, clear]);

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '120px 24px', textAlign: 'center', fontFamily: T.sans }}>
      {error ? (
        <>
          <p style={{ fontSize: 16, color: '#a13d2b', marginBottom: 24 }}>{error}</p>
          <p style={{ fontSize: 14, color: T.soft, marginBottom: 24 }}>You have not been charged unless Afterpay emails you a confirmation.</p>
          <Link href="/checkout" style={S.btnOutline}>Back to checkout</Link>
        </>
      ) : (
        <p style={{ fontSize: 16, color: T.soft }}>Confirming your Afterpay payment…</p>
      )}
    </div>
  );
}
