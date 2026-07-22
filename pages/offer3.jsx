import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import { useCart } from '../lib/useCart';
import { tokenizeCard } from '../lib/qbPayments';
import { PRODUCTS, getProductById } from '../lib/products';
import { fbTrack, generateEventId } from '../lib/fbPixel';
import { getStoredAttribution } from '../lib/attribution';
import { getSessionId } from '../lib/session';
import { T, S } from '../lib/theme';

// Third and final step of the ad funnel — a single-page "order form" style
// checkout (product + quantity, shipping, payment all on one page), the
// structural pattern the funnel reference used. It reuses the exact same
// secure payment path as /checkout — tokenizeCard() against Intuit's
// Payments Tokens API client-side, then /api/qb-checkout server-side — a
// deliberate choice not to rebuild or duplicate that logic with a raw,
// untokenized card form. This page keeps its own local order state (one
// product + quantity) rather than depending on the shared cart, since it's
// meant to work as a standalone "buy this now" destination from an ad.
//
// Same honesty rule as /offer and /offer2: badges are pulled from real
// product data (lib/products.js), the guarantee is VEIL's real 30-day
// policy, and there's no fabricated accreditation badge, press logo, phone
// number, or countdown timer that doesn't correspond to something real.

const DISCOUNT_CODE = 'VEIL15';

// Same bright, raised "3D" CTA as /offer and /offer2 — kept consistent
// across the funnel.
const ctaBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, #FFD54A 0%, #FFB300 100%)',
  color: '#241900', border: 'none', borderRadius: 8, cursor: 'pointer',
  fontFamily: T.sans, fontWeight: 800, fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase',
  boxShadow: '0 5px 0 #C98200, 0 10px 18px rgba(201,130,0,0.35)',
  transition: 'transform .08s ease, box-shadow .08s ease',
};
const SCENT_IDS = ['original', 'citron', 'violette', 'grand-jar'];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const EMPTY_ADDRESS = { firstName: '', lastName: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };
const EMPTY_CARD = { number: '', expiry: '', cvc: '', name: '' };

function formatExpiry(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

function parseExpiry(raw) {
  const [month, year] = raw.split('/').map((s) => s.trim());
  if (!month || !year || year.length !== 2) return null;
  return { expMonth: month, expYear: `20${year}` };
}

function LockIcon(props) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIconSolid(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <rect x="5" y="11" width="14" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function CardLogoBadge({ children, bg = '#fff' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 20, borderRadius: 3, background: bg, border: `1px solid ${T.line}`, overflow: 'hidden', flexShrink: 0 }}>
      {children}
    </span>
  );
}
function VisaLogo() {
  return <CardLogoBadge><svg width="24" height="10" viewBox="0 0 48 18" aria-label="Visa"><text x="0" y="14" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="800" fontSize="16" fill="#1434CB" letterSpacing="-0.5">VISA</text></svg></CardLogoBadge>;
}
function MastercardLogo() {
  return <CardLogoBadge><svg width="22" height="14" viewBox="0 0 40 26" aria-label="Mastercard"><circle cx="15" cy="13" r="11" fill="#EB001B" /><circle cx="25" cy="13" r="11" fill="#F79E1B" style={{ mixBlendMode: 'multiply' }} /></svg></CardLogoBadge>;
}
function AmexLogo() {
  return <CardLogoBadge bg="#006FCF"><svg width="26" height="13" viewBox="0 0 52 22" aria-label="American Express"><text x="1" y="16" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="13" fill="#fff" letterSpacing="0.5">AMEX</text></svg></CardLogoBadge>;
}
function DiscoverLogo() {
  return <CardLogoBadge><svg width="28" height="11" viewBox="0 0 66 20" aria-label="Discover"><text x="0" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="11" fill="#1B1B1B" letterSpacing="-0.3">Discover</text><circle cx="62" cy="14" r="4" fill="#FF6600" /></svg></CardLogoBadge>;
}

function AddressFields({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  return (
    <>
      <div className="o3-row-2">
        <input placeholder="First name" value={value.firstName} onChange={set('firstName')} style={input} autoComplete="shipping given-name" required />
        <input placeholder="Last name" value={value.lastName} onChange={set('lastName')} style={input} autoComplete="shipping family-name" required />
      </div>
      <input placeholder="Address" value={value.address} onChange={set('address')} style={{ ...input, marginTop: 8 }} autoComplete="shipping address-line1" required />
      <input placeholder="Apartment, suite, etc. (optional)" value={value.apt} onChange={set('apt')} style={{ ...input, marginTop: 8 }} autoComplete="shipping address-line2" />
      <div className="o3-row-3" style={{ marginTop: 8 }}>
        <input placeholder="City" value={value.city} onChange={set('city')} style={input} autoComplete="shipping address-level2" required />
        <select value={value.state} onChange={set('state')} style={input} autoComplete="shipping address-level1" required>
          <option value="">State</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="ZIP code" value={value.zip} onChange={set('zip')} style={input} autoComplete="shipping postal-code" required />
      </div>
      <input placeholder="Phone (optional)" value={value.phone} onChange={set('phone')} style={{ ...input, marginTop: 8 }} autoComplete="shipping tel" />
    </>
  );
}

export default function Offer3Page() {
  const router = useRouter();
  const { clear, applyDiscount, appliedDiscount } = useCart();

  const [selectedId, setSelectedId] = React.useState('original');
  const [quantity, setQuantity] = React.useState(1);
  const [email, setEmail] = React.useState('');
  const [shipping, setShipping] = React.useState(EMPTY_ADDRESS);
  const [card, setCard] = React.useState(EMPTY_CARD);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [discountApplied, setDiscountApplied] = React.useState(false);

  const product = getProductById(selectedId);

  React.useEffect(() => {
    const { scent } = router.query;
    if (typeof scent === 'string' && PRODUCTS.some((p) => p.id === scent)) setSelectedId(scent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.scent]);

  React.useEffect(() => {
    if (appliedDiscount?.code === DISCOUNT_CODE) {
      setDiscountApplied(true);
      return;
    }
    applyDiscount(DISCOUNT_CODE).then((r) => setDiscountApplied(!!r?.valid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This page IS the checkout step of the funnel, so it fires the same
  // checkout_start tracking /checkout fires on mount — without this, the
  // admin dashboard's funnel counters see zero checkout activity for
  // everyone who buys through /offer instead of /shop.
  React.useEffect(() => {
    const eventId = generateEventId();
    const value = product.price * quantity;
    fbTrack('InitiateCheckout', { content_ids: [selectedId], value, currency: 'USD', num_items: quantity }, eventId);
    fetch('/api/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'checkout_start',
        eventId,
        value,
        contentIds: [selectedId],
        contents: [{ id: selectedId, quantity }],
        url: window.location.href,
        sessionId: getSessionId(),
      }),
      keepalive: true,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = product.price * quantity;
  const discountAmount = discountApplied
    ? (appliedDiscount?.type === 'percent' ? Math.round(subtotal * ((appliedDiscount.value || 15) / 100) * 100) / 100 : Math.min(appliedDiscount?.value || 0, subtotal))
    : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const addressEntered = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());
  const shippingCost = !addressEntered ? 0 : (subtotal >= 50 ? 0 : 5);
  const grandTotal = discountedSubtotal + shippingCost;

  // Same abandoned-checkout capture as /checkout — fires once the shopper
  // leaves the email field, so someone who lands here from an ad and
  // doesn't finish still ends up recorded somewhere, not lost entirely.
  const handleEmailBlur = () => {
    if (!email.trim()) return;
    fetch('/api/checkout-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        cart: [{ id: product.id, name: product.name, quantity }],
        source: 'offer3',
        sessionId: getSessionId(),
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const expiry = parseExpiry(card.expiry);
    if (!card.number.trim() || !expiry || !card.cvc.trim() || !card.name.trim()) {
      setError('Fill in your card details to place your order.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email to place your order.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await tokenizeCard(
        {
          number: card.number,
          expMonth: expiry.expMonth,
          expYear: expiry.expYear,
          cvc: card.cvc,
          name: card.name.trim(),
          street: shipping.address,
          city: shipping.city,
          region: shipping.state,
          postalCode: shipping.zip,
          country: 'US',
        },
        process.env.NEXT_PUBLIC_QB_ENVIRONMENT || 'sandbox'
      );

      const purchaseEventId = generateEventId();
      const items = [{ ...product, quantity }];

      const res = await fetch('/api/qb-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: grandTotal,
          items,
          email,
          shipping,
          eventId: purchaseEventId,
          url: window.location.href,
          paymentMethod: 'QuickBooks',
          attribution: getStoredAttribution(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      sessionStorage.setItem('veil-purchase', JSON.stringify({
        eventId: purchaseEventId,
        amount: grandTotal,
        contentIds: [product.id],
        contents: [{ id: product.id, quantity }],
      }));
      await router.push('/success');
      clear();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Head>
        <title>VEIL — Complete Your Order</title>
      </Head>

      {discountApplied && (
        <div style={{ background: T.ink, color: T.white, textAlign: 'center', padding: '10px 16px', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Your 15% discount has been applied &mdash; code {DISCOUNT_CODE}
        </div>
      )}

      <header style={topbar}>
        <Link href="/" style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, textDecoration: 'none' }}>
          <img src="/images/veil-logo-black.png" alt="VEIL" style={{ height: 24, width: 'auto' }} />
        </Link>
      </header>

      <div className="o3-progress" style={progressStrip}>
        <span style={progressStep}>1&nbsp; Your Order</span>
        <span style={progressArrow}>&rarr;</span>
        <span style={progressStep}>2&nbsp; Shipping</span>
        <span style={progressArrow}>&rarr;</span>
        <span style={progressStep}>3&nbsp; Payment</span>
      </div>

      <div className="o3-grid" style={checkoutGrid}>
        <form onSubmit={handleSubmit} style={formCol}>
          <section>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>1. Choose Your Scent</h2>
            </div>
            <div className="o3-scent-grid" style={scentGrid}>
              {SCENT_IDS.map((id) => {
                const p = PRODUCTS.find((x) => x.id === id);
                if (!p) return null;
                const active = id === selectedId;
                const unitDiscounted = discountApplied ? Math.round(p.price * 0.85 * 100) / 100 : p.price;
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setSelectedId(id)}
                    style={{ ...scentTile, border: `1.5px solid ${active ? T.ink : T.line}`, outline: active ? `1px solid ${T.ink}` : 'none', outlineOffset: -2 }}
                  >
                    {p.badge && <span style={scentBadge}>{p.badge.toUpperCase()}</span>}
                    <div style={{ aspectRatio: '1/1', marginBottom: 10 }}>
                      <ProductVisual id={p.id} images={p.images} alt={p.name} width={140} />
                    </div>
                    <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 400 }}>{p.name}</div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      {discountApplied && <span style={{ fontSize: 12, color: T.soft, textDecoration: 'line-through' }}>${p.price.toFixed(2)}</span>}
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>${unitDiscounted.toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
              <span style={{ fontSize: 13, color: T.soft }}>Quantity</span>
              <div style={qtyStepper}>
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={qtyBtn} aria-label="Decrease quantity">&minus;</button>
                <span style={{ width: 28, textAlign: 'center', fontSize: 14 }}>{quantity}</span>
                <button type="button" onClick={() => setQuantity((q) => Math.min(9, q + 1))} style={qtyBtn} aria-label="Increase quantity">+</button>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 32 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>2. Shipping</h2>
            </div>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={handleEmailBlur} style={{ ...input, marginBottom: 12 }} autoComplete="email" required />
            <AddressFields value={shipping} onChange={setShipping} />
          </section>

          <section style={{ marginTop: 32 }}>
            <h2 style={{ ...sectionTitle, marginBottom: 4 }}>3. Payment</h2>
            <p style={{ fontSize: 13, color: T.soft, marginBottom: 14 }}>All transactions are secure and encrypted.</p>
            <div style={paymentList}>
              <div style={accordionRow}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Credit card</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <VisaLogo /><MastercardLogo /><AmexLogo /><DiscoverLogo />
                </div>
              </div>
              <div style={accordionBody}>
                <div style={{ position: 'relative' }}>
                  <input placeholder="Card number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} style={{ ...pillInput, paddingRight: 42 }} inputMode="numeric" autoComplete="cc-number" required />
                  <LockIconSolid style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: T.soft }} />
                </div>
                <input placeholder="Expiration date (MM / YY)" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} style={{ ...pillInput, marginTop: 10 }} inputMode="numeric" autoComplete="cc-exp" required />
                <input placeholder="Security code" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} style={{ ...pillInput, marginTop: 10 }} inputMode="numeric" autoComplete="cc-csc" required />
                <input placeholder="Name on card" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} style={{ ...pillInput, marginTop: 10 }} autoComplete="cc-name" required />
              </div>
            </div>
          </section>

          {error && <p style={errorText}>{error}</p>}

          <button className="cta-3d" type="submit" disabled={submitting} style={{ ...ctaBtn, width: '100%', marginTop: 24, height: 58, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Processing…' : `Complete Order — $${grandTotal.toFixed(2)}`}
          </button>
          <div style={secureNote}>
            <LockIcon />
            <span>256-bit SSL encrypted &middot; your card details never touch our servers</span>
          </div>
          <p style={{ fontSize: 11, color: T.soft, textAlign: 'center', marginTop: 8 }}>Payments securely processed by QuickBooks</p>
        </form>

        <aside style={summaryCol}>
          <div style={summaryItem}>
            <div style={summaryImgWrap}>
              <ProductVisual id={product.id} images={product.images} alt={product.name} width={48} />
              <span style={qtyBadge}>{quantity}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>{product.name}</div>
              <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{product.size}</div>
            </div>
            <div style={{ fontSize: 14 }}>${subtotal.toFixed(2)}</div>
          </div>

          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={summaryRow}>
              <span style={{ color: T.soft }}>Promo ({DISCOUNT_CODE})</span>
              <span>&minus;${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Shipping</span>
            <span>{!addressEntered ? 'Enter address' : (shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`)}</span>
          </div>
          <div style={{ ...summaryRow, borderTop: `1px solid ${T.line}`, paddingTop: 16, marginTop: 6 }}>
            <span style={{ fontFamily: T.sans, fontSize: 18 }}>Total</span>
            <span style={{ fontFamily: T.sans, fontSize: 24 }}>${grandTotal.toFixed(2)}</span>
          </div>

          <div style={{ marginTop: 24, padding: 18, border: `1px solid ${T.line}`, background: T.white }}>
            <div style={{ fontFamily: T.serif, fontSize: 15, marginBottom: 6 }}>30-Day Guarantee</div>
            <p style={{ fontSize: 12, color: T.soft, lineHeight: 1.6, margin: 0 }}>
              Not the right fit? Return it unopened within 30 days for a full refund to your original payment method.
            </p>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {['Talc-Free', 'Vegan & Cruelty-Free', 'Ships in 1 Business Day'].map((b) => (
              <span key={b} style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft }}>{b}</span>
            ))}
          </div>
        </aside>
      </div>

      <div style={legalLinks}>
        <Link href="/terms">Terms &amp; Conditions</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/returns">Return Policy</Link>
        <Link href="/shipping">Shipping Policy</Link>
      </div>

      <style jsx>{`
        .o3-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .o3-row-3 { display: grid; grid-template-columns: 1.4fr 0.8fr 1fr; gap: 10px; }
        .o3-grid { grid-template-columns: 1.35fr 1fr; }
        .o3-scent-grid { grid-template-columns: repeat(4, 1fr); }
        .o3-progress { display: flex; }
        @media (max-width: 860px) {
          .o3-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .o3-scent-grid { grid-template-columns: repeat(2, 1fr); }
          .o3-progress span:not(:first-child):not(:nth-child(2)) { display: none; }
        }
        @media (max-width: 520px) {
          .o3-row-3 { grid-template-columns: 1fr; }
        }
        :global(.cta-3d:hover:not(:disabled)) { filter: brightness(1.04); }
        :global(.cta-3d:active:not(:disabled)) {
          transform: translateY(4px);
          box-shadow: 0 1px 0 #C98200, 0 3px 8px rgba(201,130,0,0.3);
        }
      `}</style>
    </div>
  );
}

const topbar = { borderBottom: `1px solid ${T.line}`, textAlign: 'center' };
const progressStrip = { justifyContent: 'center', alignItems: 'center', gap: 14, padding: '14px 16px', background: T.paper, borderBottom: `1px solid ${T.line}`, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.soft };
const progressStep = { color: T.ink };
const progressArrow = { color: T.soft };
const checkoutGrid = { display: 'grid', maxWidth: 1280, margin: '0 auto', columnGap: 40, rowGap: 20 };
const formCol = { padding: '32px 10px', borderRight: `1px solid ${T.line}` };
const summaryCol = { padding: '32px 40px', background: T.paper };
const secureNote = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, fontSize: 12, color: T.soft };
const sectionHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 8 };
const sectionTitle = { fontFamily: T.sans, fontWeight: 700, fontSize: 20, margin: 0 };
const input = { width: '100%', height: 44, padding: '0 14px', border: `1px solid ${T.line}`, background: T.white, fontFamily: T.sans, fontSize: 14, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 4 };
const scentGrid = { display: 'grid', gap: 12 };
const scentTile = { position: 'relative', textAlign: 'left', cursor: 'pointer', background: T.white, padding: '14px 14px 16px', borderRadius: 4 };
const scentBadge = { position: 'absolute', top: 8, right: 8, fontSize: 9, letterSpacing: '0.08em', background: T.ink, color: T.white, padding: '3px 7px', borderRadius: 3 };
const qtyStepper = { display: 'flex', alignItems: 'center', gap: 0, border: `1px solid ${T.line}`, borderRadius: 4 };
const qtyBtn = { width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: T.ink };
const paymentList = { border: `1.5px solid ${T.ink}`, borderRadius: 10, background: T.white, overflow: 'hidden' };
const accordionRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 14px', borderBottom: `1px solid ${T.line}`, background: T.paper };
const accordionBody = { padding: '14px 14px 18px', background: T.paper };
const pillInput = { width: '100%', height: 48, padding: '0 16px', border: `1px solid ${T.line}`, background: T.white, fontFamily: T.sans, fontSize: 14, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 24 };
const errorText = { color: '#a13d2b', fontSize: 13, marginTop: 20 };
const summaryItem = { display: 'flex', alignItems: 'center', gap: 14, padding: '0 0 16px' };
const summaryImgWrap = { position: 'relative', width: 48, height: 48, flexShrink: 0, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.white };
const qtyBadge = { position: 'absolute', top: -8, right: -8, background: T.soft, color: T.white, borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const summaryRow = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 };
const legalLinks = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20, maxWidth: 1280, margin: '0 auto', padding: '24px 40px 36px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft, borderTop: `1px solid ${T.line}` };
