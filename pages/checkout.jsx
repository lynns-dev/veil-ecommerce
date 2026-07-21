import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import { useCart } from '../lib/useCart';
import { tokenizeCard } from '../lib/qbPayments';
import { TASSEL_GIFT } from '../lib/products';
import { fbTrack, generateEventId } from '../lib/fbPixel';
import { getStoredAttribution } from '../lib/attribution';
import { getSessionId } from '../lib/session';
import { T, S } from '../lib/theme';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const EMPTY_ADDRESS = { firstName: '', lastName: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };
const EMPTY_CARD = { number: '', expiry: '', cvc: '', name: '' };

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

function HelpIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.3 2.36c-.6.22-1 .78-1 1.44v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

function ShipIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M3 7l9-4 9 4-9 4-9-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 7v10l9 4 9-4V7M12 11v10" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ReturnIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 12a8 8 0 1 1 2.34 5.66" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 8v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LeafIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5 19c0-6 3-9 9-11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// "1225" -> "12 / 25", typed digit by digit — matches the MM / YY single
// field convention shoppers already know from their physical card.
function formatExpiry(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

// Splits a "12 / 28" expiry field into { expMonth: "12", expYear: "2028" }.
// Returns null if the field isn't a complete MM/YY yet.
function parseExpiry(raw) {
  const [month, year] = raw.split('/').map((s) => s.trim());
  if (!month || !year || year.length !== 2) return null;
  return { expMonth: month, expYear: `20${year}` };
}

// Small, recognizable renderings of each network's real mark (not a
// colored text pill) so the "we accept" row reads as legitimate rather
// than placeholder-ish.
function CardLogoBadge({ children, bg = '#fff' }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 20, borderRadius: 3, background: bg,
        border: `1px solid ${T.line}`, overflow: 'hidden', flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function VisaLogo() {
  return (
    <CardLogoBadge>
      <svg width="24" height="10" viewBox="0 0 48 18" aria-label="Visa">
        <text x="0" y="14" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="800" fontSize="16" fill="#1434CB" letterSpacing="-0.5">VISA</text>
      </svg>
    </CardLogoBadge>
  );
}

function MastercardLogo() {
  return (
    <CardLogoBadge>
      <svg width="22" height="14" viewBox="0 0 40 26" aria-label="Mastercard">
        <circle cx="15" cy="13" r="11" fill="#EB001B" />
        <circle cx="25" cy="13" r="11" fill="#F79E1B" style={{ mixBlendMode: 'multiply' }} />
      </svg>
    </CardLogoBadge>
  );
}

function AmexLogo() {
  return (
    <CardLogoBadge bg="#006FCF">
      <svg width="26" height="13" viewBox="0 0 52 22" aria-label="American Express">
        <text x="1" y="16" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="13" fill="#fff" letterSpacing="0.5">AMEX</text>
      </svg>
    </CardLogoBadge>
  );
}

function DiscoverLogo() {
  return (
    <CardLogoBadge>
      <svg width="28" height="11" viewBox="0 0 66 20" aria-label="Discover">
        <text x="0" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="11" fill="#1B1B1B" letterSpacing="-0.3">Discover</text>
        <circle cx="62" cy="14" r="4" fill="#FF6600" />
      </svg>
    </CardLogoBadge>
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
      <input placeholder="Address" value={value.address} onChange={set('address')} style={{ ...input, marginTop: 8 }} autoComplete={`${section} address-line1`} required />
      <input placeholder="Apartment, suite, etc. (optional)" value={value.apt} onChange={set('apt')} style={{ ...input, marginTop: 8 }} autoComplete={`${section} address-line2`} />
      <div className="row-3" style={{ marginTop: 8 }}>
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
        style={{ ...input, marginTop: 8 }}
        autoComplete={`${section} tel`}
        id={idPrefix ? `${idPrefix}-phone` : undefined}
      />
    </>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, total, hydrated, clear, add, appliedDiscount, applyDiscount, clearDiscount, codeDiscountAmount, discountedTotal } = useCart();

  // Contact + delivery
  const [email, setEmail] = React.useState('');
  const [newsletter, setNewsletter] = React.useState(true);
  const [shipping, setShipping] = React.useState(EMPTY_ADDRESS);

  // Payment
  const [card, setCard] = React.useState(EMPTY_CARD);
  const [billingSame, setBillingSame] = React.useState(true);
  const [billing, setBilling] = React.useState(EMPTY_ADDRESS);

  // Discount + UI state
  const [discountCode, setDiscountCode] = React.useState('');
  const [discountMessage, setDiscountMessage] = React.useState('');
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [tasselSeconds, setTasselSeconds] = React.useState(5 * 60);

  React.useEffect(() => {
    const t = setInterval(() => setTasselSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (appliedDiscount) setDiscountCode(appliedDiscount.code);
  }, [appliedDiscount]);

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
        sessionId: getSessionId(),
      }),
      keepalive: true,
    }).catch(() => {});
    // Fire once per checkout page load, not on every cart mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const hasTassel = cart.some((i) => i.id === TASSEL_GIFT.id);
  const tasselExpired = tasselSeconds <= 0;
  const tasselMins = Math.floor(tasselSeconds / 60);
  const tasselSecs = String(tasselSeconds % 60).padStart(2, '0');
  const handleAddTassel = () => add({ ...TASSEL_GIFT, price: 0, originalPrice: TASSEL_GIFT.price }, 1);

  const addressEntered = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());
  // Don't add shipping to the total until there's an address to base it on —
  // showing $5 on top of what the shopper expected from the product/cart
  // page, before they've typed anything, just reads as an unexplained price
  // jump. It only enters the total once addressEntered flips true, same
  // moment the Shipping method section below stops saying "enter your
  // address" and starts showing an actual rate.
  const shippingCost = !addressEntered || cart.length === 0 ? 0 : (total >= 50 ? 0 : 5);
  const subtotal = cart.reduce((sum, item) => sum + (item.originalPrice ?? item.price) * item.quantity, 0);
  const discountTotal = subtotal - total;
  const grandTotal = discountedTotal + shippingCost;

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountMessage('Checking…');
    const data = await applyDiscount(discountCode);
    if (data.valid) {
      setDiscountMessage(`Code "${data.code}" applied.`);
    } else if (data.error) {
      setDiscountMessage('Could not check that code — please try again.');
    } else {
      setDiscountMessage('That code isn’t valid.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const expiry = parseExpiry(card.expiry);
    if (!card.number.trim() || !expiry || !card.cvc.trim() || !card.name.trim()) {
      setError('Fill in your card details to place your order.');
      return;
    }

    setSubmitting(true);
    try {
      // Billing address feeds AVS (address verification) on the card
      // network side — falls back to the shipping address unless the
      // shopper explicitly unchecked "same as shipping".
      const billingAddress = billingSame ? shipping : billing;

      // Step 1: tokenize the card directly against Intuit's Payments Tokens
      // API from the browser (lib/qbPayments.js) — the raw card number
      // never reaches our own server. The token is single-use and tied to
      // this exact card + billing address + CVC.
      const token = await tokenizeCard(
        {
          number: card.number,
          expMonth: expiry.expMonth,
          expYear: expiry.expYear,
          cvc: card.cvc,
          name: card.name.trim(),
          street: billingAddress.address,
          city: billingAddress.city,
          region: billingAddress.state,
          postalCode: billingAddress.zip,
          country: 'US',
        },
        process.env.NEXT_PUBLIC_QB_ENVIRONMENT || 'sandbox'
      );

      const purchaseEventId = generateEventId();

      // Step 2: charge that token server-side (/api/qb-checkout). A
      // QuickBooks charge has no redirect step and no webhook — it either
      // succeeds or fails in this same request — so fulfillment and the
      // success-page navigation both happen right here, not from a
      // separate async confirmation.
      const res = await fetch('/api/qb-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: grandTotal,
          items: cart,
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

  if (!hydrated || cart.length === 0) return null;

  return (
    <div>
      <header style={topbar}>
        <Link href="/" style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, textDecoration: 'none' }}>
          <img src="/images/veil-logo-black.png" alt="VEIL" style={{ height: 24, width: 'auto' }} />
        </Link>
      </header>

      <button className="summary-toggle" style={summaryToggle} onClick={() => setSummaryOpen((o) => !o)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{summaryOpen ? 'Hide' : 'Show'} order summary</span>
          <span style={{ fontSize: 10 }}>{summaryOpen ? '▲' : '▼'}</span>
        </span>
        <span style={{ fontFamily: T.sans, fontSize: 17 }}>${grandTotal.toFixed(2)}</span>
      </button>

      <div className="checkout-grid" style={checkoutGrid}>
        <form onSubmit={handleSubmit} style={formCol}>
          {!tasselExpired && (
            <section>
              <div style={tasselCard}>
                <p style={{ ...S.label, marginBottom: 10 }}>Get the Veil Scented Tassel for free</p>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={tasselImgWrap}>
                    <ProductVisual id={TASSEL_GIFT.id} images={TASSEL_GIFT.images} alt={TASSEL_GIFT.name} width={48} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.sans, fontSize: 15, color: T.ink }}>{TASSEL_GIFT.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 13, color: T.soft, textDecoration: 'line-through' }}>
                        ${TASSEL_GIFT.price.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>$0.00</span>
                    </div>
                  </div>
                  {hasTassel ? (
                    <span style={{ fontSize: 12, color: T.ink, whiteSpace: 'nowrap' }}>✓ Added</span>
                  ) : (
                    <button type="button" onClick={handleAddTassel} style={S.btnOutline}>Add to cart</button>
                  )}
                </div>
                {!hasTassel && (
                  <p style={tasselTimer}>
                    Offer expires in {tasselMins}:{tasselSecs} — place your order before time runs out.
                  </p>
                )}
              </div>
            </section>
          )}

          <section style={{ marginTop: 24 }}>
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

          <section style={{ marginTop: 24 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Delivery</h2>
            </div>
            <select value="United States" readOnly style={{ ...input, marginBottom: 12, color: T.soft }}>
              <option>United States</option>
            </select>
            <AddressFields value={shipping} onChange={setShipping} idPrefix="ship" />
          </section>

          <section style={{ marginTop: 24 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Shipping method</h2>
            </div>
            {addressEntered ? (
              <div style={shipMethod}>
                <div>
                  <div>Standard Shipping</div>
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>3–5 business days after order placed</div>
                </div>
                <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
              </div>
            ) : (
              <p style={{ color: T.soft, fontSize: 14 }}>Enter your delivery address to see shipping options.</p>
            )}
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 style={{ ...sectionTitle, marginBottom: 4 }}>Payment</h2>
            <p style={{ fontSize: 13, color: T.soft, marginBottom: 14 }}>All transactions are secure and encrypted.</p>
            <div style={paymentList}>
              <div style={accordionRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Credit card</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <VisaLogo />
                  <MastercardLogo />
                  <AmexLogo />
                  <DiscoverLogo />
                </div>
              </div>
              <div style={accordionBody}>
                <div style={{ position: 'relative' }}>
                  <input
                    placeholder="Card number"
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: e.target.value })}
                    style={{ ...pillInput, paddingRight: 42 }}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    required
                  />
                  <LockIconSolid style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: T.soft }} />
                </div>
                <input
                  placeholder="Expiration date (MM / YY)"
                  value={card.expiry}
                  onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                  style={{ ...pillInput, marginTop: 10 }}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  required
                />
                <div style={{ position: 'relative' }}>
                  <input
                    placeholder="Security code"
                    value={card.cvc}
                    onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                    style={{ ...pillInput, marginTop: 10, paddingRight: 42 }}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    required
                  />
                  <HelpIcon style={{ position: 'absolute', right: 16, top: 'calc(50% + 5px)', transform: 'translateY(-50%)', color: T.soft }} />
                </div>
                <input
                  placeholder="Name on card"
                  value={card.name}
                  onChange={(e) => setCard({ ...card, name: e.target.value })}
                  style={{ ...pillInput, marginTop: 10 }}
                  autoComplete="cc-name"
                  required
                />
                <label style={{ ...checkboxLabel, marginTop: 16 }}>
                  <input
                    type="checkbox"
                    checked={billingSame}
                    onChange={(e) => setBillingSame(e.target.checked)}
                    style={{ accentColor: T.ink, width: 18, height: 18 }}
                  />
                  <span style={{ color: T.ink }}>Use shipping address as billing address</span>
                </label>
                {!billingSame && (
                  <div style={{ marginTop: 10 }}>
                    <AddressFields value={billing} onChange={setBilling} idPrefix="bill" />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Discount code</h2>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                placeholder="Discount code"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(e.target.value);
                  if (appliedDiscount) clearDiscount();
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

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...S.btnFill, width: '100%', justifyContent: 'center', marginTop: 20,
              height: 58, fontSize: 13, opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Processing…' : `Place order — $${grandTotal.toFixed(2)}`}
          </button>
          <div style={secureNote}>
            <LockIcon />
            <span>256-bit SSL encrypted &middot; your card details never touch our servers</span>
          </div>
          <p style={{ fontSize: 11, color: T.soft, textAlign: 'center', marginTop: 8 }}>
            Payments securely processed by QuickBooks
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
            <span>{!addressEntered ? 'Enter address' : (shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`)}</span>
          </div>
          <div style={{ ...summaryRow, borderTop: `1px solid ${T.line}`, paddingTop: 16, marginTop: 6 }}>
            <span style={{ fontFamily: T.sans, fontSize: 18 }}>Total</span>
            <span style={{ fontFamily: T.sans, fontSize: 24 }}>${grandTotal.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <input
              placeholder="Discount code"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value);
                if (appliedDiscount) clearDiscount();
                setDiscountMessage('');
              }}
              style={{ ...input, flex: 1 }}
            />
            <button type="button" style={S.btnOutline} onClick={handleApplyDiscount}>Apply</button>
          </div>
          {discountMessage && (
            <p style={{ fontSize: 12, color: appliedDiscount ? T.ink : '#a13d2b', marginTop: 8 }}>{discountMessage}</p>
          )}
        </aside>
      </div>

      <div style={reassuranceWrap}>
        <div className="reassurance-grid" style={reassuranceGrid}>
          {[
            [ShipIcon, 'Free shipping over $50', 'Ships within 1 business day.'],
            [ReturnIcon, '30-day returns', 'Not the right fit? Send it back for a full refund.'],
            [LockIcon, 'Secure checkout', 'Payments encrypted and processed by QuickBooks.'],
            [LeafIcon, 'Vegan & cruelty-free', 'Every formula, always.'],
          ].map(([Icon, title, copy]) => (
            <div key={title} style={reassuranceItem}>
              <Icon style={{ color: T.ink, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</div>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{copy}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={legalLinks}>
        <Link href="/terms">Terms & Conditions</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/returns">Return Policy</Link>
        <Link href="/shipping">Shipping Policy</Link>
      </div>

      <style jsx>{`
        :global(.row-2) { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        :global(.row-3) { display: grid; grid-template-columns: 1.4fr 0.8fr 1fr; gap: 10px; }
        .summary-toggle { display: none; }
        .checkout-grid { grid-template-columns: 1.35fr 1fr; }
        .reassurance-grid { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 860px) {
          .reassurance-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .reassurance-grid { grid-template-columns: 1fr; }
        }
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
const checkoutGrid = { display: 'grid', maxWidth: 1280, margin: '0 auto', columnGap: 40, rowGap: 20 };
const formCol = { padding: '32px 10px', borderRight: `1px solid ${T.line}` };
const summaryCol = { padding: '32px 40px', background: T.paper };
const secureNote = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, fontSize: 12, color: T.soft };
const sectionHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 8 };
const sectionTitle = { fontFamily: T.sans, fontWeight: 700, fontSize: 22, margin: 0 };
const input = {
  width: '100%', height: 44, padding: '0 14px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 4,
};
const checkboxLabel = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 13, color: T.soft };
const paymentList = { border: `1.5px solid ${T.ink}`, borderRadius: 10, background: T.white, overflow: 'hidden' };
const accordionRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 14px', borderBottom: `1px solid ${T.line}`, background: T.paper,
};
const accordionBody = { padding: '14px 14px 18px', background: T.paper };
// Pill-shaped fields sitting on the gray accordion body, matching the
// reference's very rounded card-detail inputs (vs. the site's normal
// 4px-radius fields elsewhere on this page).
const pillInput = {
  width: '100%', height: 48, padding: '0 16px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, fontWeight: 400, color: T.ink, outline: 'none',
  boxSizing: 'border-box', borderRadius: 24,
};
const tasselCard = { border: `1px solid ${T.line}`, background: T.paper, padding: 16 };
const tasselImgWrap = {
  width: 48, height: 48, flexShrink: 0, overflow: 'hidden', background: T.white,
  border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const tasselTimer = { fontSize: 11, color: '#a13d2b', marginTop: 10, marginBottom: 0 };
const shipMethod = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 14px',
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
const reassuranceWrap = { borderTop: `1px solid ${T.line}`, background: T.paper };
const reassuranceGrid = { maxWidth: 1280, margin: '0 auto', padding: '32px 40px', display: 'grid', gap: 24 };
const reassuranceItem = { display: 'flex', alignItems: 'flex-start', gap: 12 };
const legalLinks = {
  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20,
  maxWidth: 1280, margin: '0 auto', padding: '24px 40px 36px',
  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft,
  borderTop: `1px solid ${T.line}`,
};
