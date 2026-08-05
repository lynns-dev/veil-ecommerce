import React from 'react';
import AddressFields from './AddressFields';
import { createSquareCard, tokenizeSquareCard } from '../lib/squareClient';
import { subscriptionPrice, SUBSCRIPTION_CADENCE_DAYS } from '../lib/products';
import { T, S } from '../lib/theme';

const EMPTY_ADDRESS = { name: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };

// Self-contained "Subscribe & Save" order form — deliberately separate
// from the cart/checkout flow, same reasoning pages/offer3.jsx uses for
// its own single-product order form: a subscription is one recurring
// product, not a multi-item cart, so there's no reason to route it through
// useCart/CartDrawer/checkout.jsx at all. Opens over the product page,
// collects email/shipping/card, and posts straight to /api/subscribe.
export default function SubscribeModal({ product, onClose }) {
  const [email, setEmail] = React.useState('');
  const [shipping, setShipping] = React.useState(EMPTY_ADDRESS);
  const [step, setStep] = React.useState('form'); // form | submitting | success
  const [error, setError] = React.useState('');

  const squareCardRef = React.useRef(null);
  const [squareReady, setSquareReady] = React.useState(false);
  const [squareError, setSquareError] = React.useState('');

  // Mounted once, same shape as checkout.jsx's own Step 2 card-mount effect
  // — the container isn't in the DOM until this modal renders, and Square's
  // attach() needs it to already exist.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const card = await createSquareCard('subscribe-card-container');
        if (cancelled) {
          await card.destroy();
          return;
        }
        squareCardRef.current = card;
        setSquareReady(true);
      } catch (err) {
        console.error('Square card setup failed:', err);
        setSquareError('Payment form failed to load — please refresh and try again.');
      }
    })();
    return () => {
      cancelled = true;
      if (squareCardRef.current) {
        squareCardRef.current.destroy().catch(() => {});
        squareCardRef.current = null;
      }
    };
  }, []);

  const price = subscriptionPrice(product.price);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!shipping.city.trim() || !shipping.state) {
      setError('Enter a ZIP code so we can confirm your city and state.');
      return;
    }
    if (!squareReady || !squareCardRef.current) {
      setError('Payment form is still loading — please wait a moment and try again.');
      return;
    }
    setStep('submitting');
    try {
      const cardToken = await tokenizeSquareCard(squareCardRef.current);
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, cardToken, email, shipping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start your subscription.');
      setStep('success');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStep('form');
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <span style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 16 }}>Subscribe & Save</span>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        </div>

        <div style={{ padding: '20px 24px 28px', overflowY: 'auto' }}>
          {step === 'success' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontFamily: T.serif, fontSize: 22, marginBottom: 12 }}>You're subscribed.</p>
              <p style={{ fontSize: 14, color: T.soft, lineHeight: 1.6 }}>
                {product.name} will ship today, then every {SUBSCRIPTION_CADENCE_DAYS} days at ${price.toFixed(2)} —
                a confirmation is on its way to {email}.
              </p>
              <button type="button" onClick={onClose} style={{ ...S.btnFill, marginTop: 20 }}>Done</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={summaryCard}>
                <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18 }}>{product.name}</div>
                <div style={{ fontSize: 13, color: T.soft, marginTop: 4 }}>Delivered every {SUBSCRIPTION_CADENCE_DAYS} days · cancel anytime</div>
                <div style={{ marginTop: 10 }}>
                  <span style={{ textDecoration: 'line-through', color: T.soft, fontSize: 14, marginRight: 8 }}>${product.price}</span>
                  <span style={{ fontFamily: T.serif, fontSize: 20 }}>${price.toFixed(2)}</span>
                  <span style={{ fontSize: 12, color: T.soft }}> / delivery</span>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={fieldGroupLabel}>Contact</p>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={input}
                  autoComplete="email"
                  required
                />
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={fieldGroupLabel}>Shipping address</p>
                <AddressFields value={shipping} onChange={setShipping} idPrefix="ship" inputStyle={input} />
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={fieldGroupLabel}>Payment</p>
                <div id="subscribe-card-container" style={{ minHeight: 48, border: `1px solid ${T.fieldLine || T.line}`, borderRadius: 14, padding: squareReady ? 0 : 14 }} />
                {!squareReady && !squareError && <p style={{ fontSize: 12, color: T.soft, marginTop: 8 }}>Loading payment form…</p>}
                {squareError && <p style={{ fontSize: 12, color: '#a13d2b', marginTop: 8 }}>{squareError}</p>}
              </div>

              {error && <p style={{ fontSize: 13, color: '#a13d2b', marginTop: 16 }}>{error}</p>}

              <button type="submit" disabled={step === 'submitting'} style={{ ...S.btnFill, width: '100%', marginTop: 24, justifyContent: 'center', opacity: step === 'submitting' ? 0.6 : 1 }}>
                {step === 'submitting' ? 'Processing…' : `Subscribe & save — $${price.toFixed(2)} today`}
              </button>
              <p style={{ fontSize: 11, color: T.soft, textAlign: 'center', marginTop: 10 }}>
                Charged today, then every {SUBSCRIPTION_CADENCE_DAYS} days. Cancel anytime — email us and we'll take care of it.
              </p>
            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        :global(.row-2) { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      `}</style>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(22,20,15,0.5)', zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const sheet = {
  width: '100%', maxWidth: 460, maxHeight: '90vh', background: T.white, borderRadius: 16,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const head = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '18px 24px', borderBottom: `1px solid ${T.line}`, flexShrink: 0,
};
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: T.soft, padding: 4 };
const summaryCard = { padding: 16, border: `1.5px solid ${T.line}`, borderRadius: 14, background: T.paper };
const fieldGroupLabel = {
  fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: T.soft, fontWeight: 700, marginBottom: 10,
};
const input = {
  width: '100%', height: 50, padding: '0 16px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 15, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 12,
};
