import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import PayPalButton from '../components/PayPalButton';
import { useCart } from '../lib/useCart';
import { tokenizeCard } from '../lib/qbPayments';
import { fbTrack, generateEventId } from '../lib/fbPixel';
import { useAllReviews } from '../lib/useReviews';
import { getStoredAttribution } from '../lib/attribution';
import { T, S } from '../lib/theme';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const emptyAddress = { firstName: '', lastName: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };

function LockIcon(props) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// IIN-range brand detection — good enough to give the user visual
// confirmation their card is recognized, not used for validation.
function detectCardBrand(digits) {
  if (/^4/.test(digits)) return 'visa';
  if (/^5[1-5]/.test(digits) || /^2(2[2-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^6(?:011|5)/.test(digits)) return 'discover';
  return null;
}

function formatCardNumber(digits) {
  if (/^3[47]/.test(digits)) {
    // Amex: 4-6-5
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

const CARD_BRANDS = [
  { id: 'visa', label: 'Visa', color: '#1a1f71' },
  { id: 'mastercard', label: 'Mastercard', color: '#eb001b' },
  { id: 'amex', label: 'Amex', color: '#2e77bc' },
  { id: 'discover', label: 'Discover', color: '#e57200' },
];

function CardBrandBadges() {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {CARD_BRANDS.map((b) => (
        <span
          key={b.id}
          style={{
            fontFamily: T.sans, fontSize: 8, fontWeight: 700, letterSpacing: '0.03em',
            padding: '3px 5px', borderRadius: 3, color: T.white, background: b.color,
          }}
        >
          {b.label.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

function CardBrandIcon({ brand }) {
  if (!brand) return null;
  const b = CARD_BRANDS.find((x) => x.id === brand);
  return (
    <span
      style={{
        fontFamily: T.sans, fontSize: 9, fontWeight: 700, letterSpacing: '0.03em',
        padding: '4px 6px', borderRadius: 3, color: T.white, background: b.color,
      }}
    >
      {b.label.toUpperCase()}
    </span>
  );
}

function AddressFields({ value, onChange, idPrefix }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const section = idPrefix === 'bill' ? 'billing' : 'shipping';
  return (
    <>
      <div className="row-2">
        <input placeholder="First name" value={value.firstName} onChange={set('firstName')} style={input} autoComplete={`${section} given-name`} required />
        <input placeholder="Last name" value={value.lastName} onChange={set('lastName')} style={input} autoComplete={`${section} family-name`} required />
      </div>
      <input placeholder="Address" value={value.address} onChange={set('address')} style={{ ...input, marginTop: 12 }} autoComplete={`${section} address-line1`} required />
      <input placeholder="Apartment, suite, etc. (optional)" value={value.apt} onChange={set('apt')} style={{ ...input, marginTop: 12 }} autoComplete={`${section} address-line2`} />
      <div className="row-3" style={{ marginTop: 12 }}>
        <input placeholder="City" value={value.city} onChange={set('city')} style={input} autoComplete={`${section} address-level2`} required />
        <select value={value.state} onChange={set('state')} style={input} autoComplete={`${section} address-level1`} required>
          <option value="">State</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="ZIP code" value={value.zip} onChange={set('zip')} style={input} autoComplete={`${section} postal-code`} required />
      </div>
      <input
        placeholder="Phone (optional)"
        value={value.phone}
        onChange={set('phone')}
        style={{ ...input, marginTop: 12 }}
        autoComplete={`${section} tel`}
        id={idPrefix ? `${idPrefix}-phone` : undefined}
      />
    </>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, total, hydrated, clear } = useCart();

  const [email, setEmail] = React.useState('');
  const [newsletter, setNewsletter] = React.useState(true);
  const [shipping, setShipping] = React.useState(emptyAddress);
  const [billingSame, setBillingSame] = React.useState(true);
  const [billing, setBilling] = React.useState(emptyAddress);
  const [card, setCard] = React.useState({ number: '', expiry: '', cvc: '' });
  const [discountCode, setDiscountCode] = React.useState('');
  const [appliedDiscount, setAppliedDiscount] = React.useState(null);
  const [discountMessage, setDiscountMessage] = React.useState('');
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (hydrated && cart.length === 0) router.replace('/shop');
  }, [hydrated, cart.length, router]);

  React.useEffect(() => {
    if (!hydrated || cart.length === 0) return;
    const eventId = generateEventId();
    fbTrack('InitiateCheckout', {
      content_ids: cart.map((i) => i.id),
      contents: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
      value: total,
      currency: 'USD',
      num_items: cart.reduce((s, i) => s + i.quantity, 0),
    }, eventId);
    fetch('/api/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'checkout_start',
        eventId,
        value: total,
        contentIds: cart.map((i) => i.id),
        contents: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
    // Fire once per checkout page load, not on every cart mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const cardBrand = React.useMemo(() => detectCardBrand(card.number.replace(/\D/g, '')), [card.number]);

  const reviewsByProduct = useAllReviews();
  const siteReviews = React.useMemo(() => {
    const all = Object.values(reviewsByProduct).flatMap((r) => r.reviews || []);
    const count = all.length;
    const average = count === 0 ? 0 : Math.round((all.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
    return { count, average };
  }, [reviewsByProduct]);

  const shippingCost = total >= 50 || cart.length === 0 ? 0 : 5;
  const subtotal = cart.reduce((sum, item) => sum + (item.originalPrice ?? item.price) * item.quantity, 0);
  const discountTotal = subtotal - total;
  const codeDiscountAmount = !appliedDiscount
    ? 0
    : appliedDiscount.type === 'percent'
    ? Math.round(total * (appliedDiscount.value / 100) * 100) / 100
    : Math.min(appliedDiscount.value, total);
  const grandTotal = Math.max(total - codeDiscountAmount, 0) + shippingCost;

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountMessage('Checking…');
    try {
      const res = await fetch('/api/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({ code: data.code, type: data.type, value: data.value });
        setDiscountMessage(`Code "${data.code}" applied.`);
      } else {
        setAppliedDiscount(null);
        setDiscountMessage('That code isn’t valid.');
      }
    } catch {
      setAppliedDiscount(null);
      setDiscountMessage('Could not check that code — please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const purchaseEventId = generateEventId();
      const [expMonth, expYear] = card.expiry.split('/').map((s) => s.trim());
      const billingAddress = billingSame ? shipping : billing;
      const token = await tokenizeCard(
        {
          number: card.number,
          expMonth,
          expYear: expYear && expYear.length === 2 ? `20${expYear}` : expYear,
          cvc: card.cvc,
          name: `${billingAddress.firstName} ${billingAddress.lastName}`.trim(),
          street: billingAddress.address,
          city: billingAddress.city,
          region: billingAddress.state,
          postalCode: billingAddress.zip,
        },
        process.env.NEXT_PUBLIC_QB_ENVIRONMENT || 'sandbox'
      );

      const res = await fetch('/api/qb-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: grandTotal,
          items: cart,
          email,
          shipping,
          billing: billingSame ? shipping : billing,
          eventId: purchaseEventId,
          url: window.location.href,
          paymentMethod: CARD_BRANDS.find((b) => b.id === cardBrand)?.label || 'Card',
          attribution: getStoredAttribution(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      sessionStorage.setItem('veil-purchase', JSON.stringify({
        eventId: purchaseEventId,
        amount: grandTotal,
        contentIds: cart.map((i) => i.id),
        contents: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
      }));

      await router.push('/success');
      clear();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaypalSuccess = async (result) => {
    sessionStorage.setItem('veil-purchase', JSON.stringify({
      eventId: result.eventId,
      amount: result.amount,
      contentIds: cart.map((i) => i.id),
      contents: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
    }));
    await router.push('/success');
    clear();
  };

  const handlePaypalError = (message) => {
    setError(message || 'PayPal checkout failed. Please try again.');
  };

  if (!hydrated || cart.length === 0) return null;

  return (
    <div>
      <header style={topbar}>
        <Link href="/" style={{ ...S.wrap, display: 'flex', alignItems: 'center', height: 64, textDecoration: 'none' }}>
          <span style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 22, letterSpacing: '0.3em', color: T.ink }}>VEIL</span>
        </Link>
      </header>

      <button className="summary-toggle" style={summaryToggle} onClick={() => setSummaryOpen((o) => !o)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{summaryOpen ? 'Hide' : 'Show'} order summary</span>
          <span style={{ fontSize: 10 }}>{summaryOpen ? '▲' : '▼'}</span>
        </span>
        <span style={{ fontFamily: T.serif, fontSize: 17 }}>${grandTotal.toFixed(2)}</span>
      </button>

      <div className="checkout-grid" style={checkoutGrid}>
        <form onSubmit={handleSubmit} style={formCol}>
          <section>
            <div style={expressStack}>
              <PayPalButton
                amount={grandTotal}
                items={cart}
                url={typeof window !== 'undefined' ? window.location.href : ''}
                disabled={submitting}
                onSuccess={handlePaypalSuccess}
                onError={handlePaypalError}
              />
              <PayPalButton
                fundingSource="venmo"
                amount={grandTotal}
                items={cart}
                url={typeof window !== 'undefined' ? window.location.href : ''}
                disabled={submitting}
                onSuccess={handlePaypalSuccess}
                onError={handlePaypalError}
              />
            </div>
            <div style={dividerRow}>
              <span style={dividerLine} />
              <span style={dividerText}>OR PAY WITH CARD</span>
              <span style={dividerLine} />
            </div>
          </section>

          <section style={{ marginTop: 32 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Contact</h2>
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              autoComplete="email"
              required
            />
            <label style={checkboxLabel}>
              <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
              Email me with news and offers
            </label>
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Delivery</h2>
            </div>
            <select value="United States" readOnly style={{ ...input, marginBottom: 12, color: T.soft }}>
              <option>United States</option>
            </select>
            <AddressFields value={shipping} onChange={setShipping} idPrefix="ship" />
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Shipping method</h2>
            </div>
            <div style={shipMethod}>
              <span>Standard Shipping</span>
              <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
            </div>
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Payment</h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.soft }}>
                <LockIcon />
                All transactions are secure and encrypted.
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                placeholder="Card number"
                value={card.number}
                onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16)) })}
                style={{ ...input, paddingRight: cardBrand ? 70 : 14 }}
                inputMode="numeric"
                autoComplete="cc-number"
                required
              />
              {cardBrand && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <CardBrandIcon brand={cardBrand} />
                </div>
              )}
            </div>
            <div className="row-2" style={{ marginTop: 12 }}>
              <input
                placeholder="Expiration date (MM/YY)"
                value={card.expiry}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                  const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
                  setCard({ ...card, expiry: formatted });
                }}
                style={input}
                inputMode="numeric"
                maxLength={5}
                autoComplete="cc-exp"
                required
              />
              <div style={{ position: 'relative' }}>
                <input
                  placeholder="Security code"
                  value={card.cvc}
                  onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  style={{ ...input, paddingRight: 34 }}
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  title="The 3-digit code on the back of your card (4 digits on the front for Amex)."
                  required
                />
                <span
                  title="The 3-digit code on the back of your card (4 digits on the front for Amex)."
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: T.soft, cursor: 'help' }}
                >
                  <LockIcon />
                </span>
              </div>
            </div>
            <label style={checkboxLabel}>
              <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
              Use shipping address as billing address
            </label>
            {!billingSame && (
              <div style={{ marginTop: 16 }}>
                <AddressFields value={billing} onChange={setBilling} idPrefix="bill" />
              </div>
            )}
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Discount code</h2>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                placeholder="Discount code"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(e.target.value);
                  if (appliedDiscount) setAppliedDiscount(null);
                  setDiscountMessage('');
                }}
                style={{ ...input, flex: 1 }}
              />
              <button type="button" style={S.btnOutline} onClick={handleApplyDiscount}>Apply</button>
            </div>
            {discountMessage && (
              <p style={{ fontSize: 12, color: appliedDiscount ? T.ink : '#a13d2b', marginTop: 8 }}>{discountMessage}</p>
            )}
          </section>

          {error && <p style={errorText}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ ...S.btnFill, width: '100%', justifyContent: 'center', marginTop: 32, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Processing…' : `Pay now — $${grandTotal.toFixed(2)}`}
          </button>
          <div style={secureNote}>
            <LockIcon />
            <span>256-bit SSL encrypted &middot; your card details never touch our servers</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <CardBrandBadges />
          </div>
          <p style={{ fontSize: 11, color: T.soft, textAlign: 'center', marginTop: 10 }}>
            Payments securely processed by QuickBooks Payments (Intuit)
          </p>
        </form>

        <aside className={`order-summary ${summaryOpen ? 'open' : ''}`} style={summaryCol}>
          <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 20 }}>
            {cart.map((item) => (
              <div key={item.id} style={summaryItem}>
                <div style={summaryImgWrap}>
                  <ProductVisual id={item.id} images={item.images} alt={item.name} width={48} />
                  <span style={qtyBadge}>{item.quantity}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{item.size}</div>
                </div>
                <div style={{ fontSize: 14 }}>${(item.price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discountTotal > 0 && (
            <div style={summaryRow}>
              <span style={{ color: T.soft }}>Discount</span>
              <span>−${discountTotal.toFixed(2)}</span>
            </div>
          )}
          {codeDiscountAmount > 0 && (
            <div style={summaryRow}>
              <span style={{ color: T.soft }}>Promo ({appliedDiscount.code})</span>
              <span>−${codeDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Shipping</span>
            <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
          </div>
          <div style={{ ...summaryRow, borderTop: `1px solid ${T.line}`, paddingTop: 16, marginTop: 6 }}>
            <span style={{ fontFamily: T.serif, fontSize: 18 }}>Total</span>
            <span style={{ fontFamily: T.serif, fontSize: 24 }}>${grandTotal.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <input
              placeholder="Discount code"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value);
                if (appliedDiscount) setAppliedDiscount(null);
                setDiscountMessage('');
              }}
              style={{ ...input, flex: 1 }}
            />
            <button type="button" style={S.btnOutline} onClick={handleApplyDiscount}>Apply</button>
          </div>
          {discountMessage && (
            <p style={{ fontSize: 12, color: appliedDiscount ? T.ink : '#a13d2b', marginTop: 8 }}>{discountMessage}</p>
          )}

          {siteReviews.count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.line}` }}>
              <span style={{ color: T.ink, letterSpacing: '2px', fontSize: 14 }}>
                {'★'.repeat(Math.round(siteReviews.average))}{'☆'.repeat(5 - Math.round(siteReviews.average))}
              </span>
              <span style={{ fontSize: 12, color: T.soft }}>
                {siteReviews.average.toFixed(1)} · {siteReviews.count} review{siteReviews.count === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </aside>
      </div>

      <style jsx>{`
        :global(.row-2) { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        :global(.row-3) { display: grid; grid-template-columns: 1.4fr 0.8fr 1fr; gap: 12px; }
        .summary-toggle { display: none; }
        .checkout-grid { grid-template-columns: 1fr 1fr; }
        .order-summary { display: block; }
        @media (min-width: 861px) {
          .order-summary {
            position: sticky;
            top: 24px;
            align-self: start;
            max-height: calc(100vh - 48px);
            overflow-y: auto;
          }
        }
        @media (max-width: 860px) {
          .checkout-grid { grid-template-columns: 1fr; }
          .summary-toggle { display: flex; }
          .order-summary { display: none; order: -1; border-bottom: 1px solid ${T.line}; }
          .order-summary.open { display: block; }
        }
        @media (max-width: 520px) {
          :global(.row-3) { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

const topbar = { borderBottom: `1px solid ${T.line}`, textAlign: 'center' };
const summaryToggle = {
  width: '100%', border: 'none', borderBottom: `1px solid ${T.line}`, background: T.paper,
  padding: '16px 24px', alignItems: 'center', justifyContent: 'space-between',
  cursor: 'pointer', fontFamily: T.sans, fontSize: 13, color: T.ink,
};
const checkoutGrid = { display: 'grid', maxWidth: 1100, margin: '0 auto', columnGap: 56, rowGap: 32 };
const formCol = { padding: '48px 40px', borderRight: `1px solid ${T.line}` };
const summaryCol = { padding: '48px 40px', background: T.paper };
const expressStack = { display: 'flex', flexDirection: 'column', gap: 10 };
const dividerRow = { display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0 0' };
const dividerLine = { flex: 1, height: 1, background: T.line };
const dividerText = { fontSize: 10, letterSpacing: '0.14em', color: T.soft, fontFamily: T.sans };
const secureNote = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, fontSize: 12, color: T.soft };
const sectionHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 };
const sectionTitle = { fontFamily: T.serif, fontWeight: 300, fontSize: 22, margin: 0 };
const input = {
  width: '100%', height: 46, padding: '0 14px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 0,
};
const checkboxLabel = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 13, color: T.soft };
const shipMethod = {
  display: 'flex', justifyContent: 'space-between', padding: '16px 14px',
  border: `1px solid ${T.ink}`, fontSize: 14,
};
const errorText = { color: '#a13d2b', fontSize: 13, marginTop: 20 };
const summaryItem = { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' };
const summaryImgWrap = { position: 'relative', width: 48, height: 48, flexShrink: 0, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.white };
const qtyBadge = {
  position: 'absolute', top: -8, right: -8, background: T.soft, color: T.white, borderRadius: '50%',
  width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const summaryRow = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 };
