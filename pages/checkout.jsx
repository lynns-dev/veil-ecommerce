import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import { useCart } from '../lib/useCart';
import { TASSEL_GIFT } from '../lib/products';
import { getStripeClient } from '../lib/stripeClient';
import { fbTrack, generateEventId } from '../lib/fbPixel';
import { getStoredAttribution } from '../lib/attribution';
import { getSessionId } from '../lib/session';
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


// Human labels for the payment method types Stripe's Payment Element can
// resolve to (reported via its 'change' event) — used for the order
// record/analytics label, since the element itself doesn't hand back a
// pretty name.
const PAYMENT_METHOD_LABELS = {
  card: 'Card',
  klarna: 'Klarna',
  afterpay_clearpay: 'Afterpay',
  link: 'Link',
  amazon_pay: 'Amazon Pay',
  paypal: 'PayPal',
  cashapp: 'Cash App Pay',
};

// These always leave the page for an off-site confirmation step, unlike
// card/Link/Cash App Pay which normally resolve without navigating away —
// handleSubmit uses this to know whether it can rely on running code after
// stripe.confirmPayment() or needs to prep sessionStorage beforehand.
const REDIRECT_PAYMENT_TYPES = ['klarna', 'afterpay_clearpay', 'amazon_pay', 'paypal'];

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

  const [email, setEmail] = React.useState('');
  const [newsletter, setNewsletter] = React.useState(true);
  const [shipping, setShipping] = React.useState(emptyAddress);
  const [billingSame, setBillingSame] = React.useState(true);
  const [billing, setBilling] = React.useState(emptyAddress);

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

  const shippingCost = total >= 50 || cart.length === 0 ? 0 : 5;
  const addressEntered = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());
  const subtotal = cart.reduce((sum, item) => sum + (item.originalPrice ?? item.price) * item.quantity, 0);
  const discountTotal = subtotal - total;
  const grandTotal = discountedTotal + shippingCost;

  // Stripe Payment Element: a single Stripe-hosted iframe that shows
  // whichever methods (card, Klarna, Afterpay, Link, Amazon Pay, ...) are
  // eligible and enabled in the Stripe Dashboard — raw payment details
  // never touch our own JS. It needs a PaymentIntent client_secret up front
  // to know what's eligible for this amount, so the intent is created once,
  // early (intentCreatedRef guards against re-creating it as grandTotal
  // changes). elements.update({amount}) only works for the "deferred"
  // Elements setup (mode: 'payment'), not this clientSecret-based one, so
  // if the total changes later (a discount code applied after the element
  // is already mounted) the displayed amount/eligibility won't reflect it
  // until submit — /api/stripe/update-intent syncs the real PaymentIntent
  // amount server-side right before confirmPayment, so the actual charge
  // is always correct regardless.
  const paymentElementRef = React.useRef(null);
  const stripeRef = React.useRef(null);
  const elementsRef = React.useRef(null);
  const paymentIntentIdRef = React.useRef(null);
  const intentCreatedRef = React.useRef(false);
  const [stripeReady, setStripeReady] = React.useState(false);
  const [activePaymentType, setActivePaymentType] = React.useState('card');
  const [paymentElementError, setPaymentElementError] = React.useState('');

  React.useEffect(() => {
    if (!hydrated || cart.length === 0 || grandTotal <= 0 || intentCreatedRef.current) return;
    intentCreatedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const [stripeInstance, intentRes] = await Promise.all([
          getStripeClient(),
          fetch('/api/stripe/create-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: grandTotal }),
          }).then((r) => r.json()),
        ]);
        if (cancelled || !stripeInstance || !paymentElementRef.current) return;
        if (!intentRes.clientSecret) throw new Error(intentRes.error || 'Could not start checkout.');

        stripeRef.current = stripeInstance;
        paymentIntentIdRef.current = intentRes.paymentIntentId;

        const elements = stripeInstance.elements({
          clientSecret: intentRes.clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              fontFamily: T.sans, colorText: T.ink, colorTextPlaceholder: T.soft,
              colorPrimary: T.ink, borderRadius: '4px', colorDanger: '#a13d2b',
            },
          },
        });
        elementsRef.current = elements;

        // Explicit priority order for the tabs: Card first (most familiar/
        // trusted), then Klarna, then Afterpay, then whatever else is
        // enabled in the Dashboard. Apple Pay/Google Pay are deliberately
        // off — Stripe only offers those as a wallet button rendered above
        // the tab list, never as a plain tab, so there's no way to place
        // them below Card; turning them off keeps Card unambiguously first.
        const paymentElement = elements.create('payment', {
          layout: 'tabs',
          paymentMethodOrder: ['card', 'klarna', 'afterpay_clearpay', 'link', 'amazon_pay', 'paypal', 'cashapp'],
          wallets: { applePay: 'never', googlePay: 'never' },
        });
        paymentElement.mount(paymentElementRef.current);
        paymentElement.on('change', (e) => {
          setActivePaymentType(e.value?.type || 'card');
          setPaymentElementError('');
        });
        paymentElement.on('loaderror', (e) => {
          console.error('Stripe Payment Element failed to load:', e.error);
        });

        setStripeReady(true);
      } catch (err) {
        // Missing/bad publishable key, blocked script, etc. — surfaced via
        // stripeReady staying false, which disables the submit button below
        // rather than letting the shopper submit into a broken form.
        console.error('Stripe setup failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, cart.length, grandTotal]);

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

  const completeCheckout = async ({ paymentMethodType, paymentMethodLabel, paymentMethodData }) => {
    setError('');
    setSubmitting(true);
    try {
      const stripeInstance = stripeRef.current;
      const elements = elementsRef.current;
      if (!stripeInstance || !elements || !paymentIntentIdRef.current) {
        throw new Error('Payment form is still loading — please wait a moment and try again.');
      }

      const purchaseEventId = generateEventId();

      // Saves everything the webhook needs to fulfill this order once
      // Stripe confirms it — the client can't be trusted to do that itself,
      // since redirect-based methods below never return control to this
      // function at all.
      const updateRes = await fetch('/api/stripe/update-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentIntentIdRef.current,
          amount: grandTotal,
          items: cart,
          email,
          shipping,
          eventId: purchaseEventId,
          url: window.location.href,
          paymentMethod: paymentMethodLabel,
          attribution: getStoredAttribution(),
        }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error || 'Payment failed');

      const purchaseRecord = {
        eventId: purchaseEventId,
        amount: grandTotal,
        contentIds: cart.map((i) => i.id),
        contents: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
      };

      // Afterpay/Amazon Pay always redirect off-site — the browser leaves
      // this page entirely, so /success needs this record to already be
      // there when Stripe sends the shopper back, not set by code that
      // never gets to run.
      const isRedirectType = REDIRECT_PAYMENT_TYPES.includes(paymentMethodType);
      if (isRedirectType) {
        sessionStorage.setItem('veil-purchase', JSON.stringify(purchaseRecord));
      }

      const { error: confirmError } = await stripeInstance.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
          ...(paymentMethodData ? { payment_method_data: paymentMethodData } : {}),
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        sessionStorage.removeItem('veil-purchase');
        throw new Error(confirmError.message);
      }

      // Reaching this line means nothing redirected — card, Link, and Cash
      // App Pay usually resolve right here in-page — so finish up ourselves
      // instead of waiting on a navigation that isn't coming.
      if (!isRedirectType) {
        sessionStorage.setItem('veil-purchase', JSON.stringify(purchaseRecord));
      }

      await router.push('/success');
      clear();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const billingAddress = billingSame ? shipping : billing;
    await completeCheckout({
      paymentMethodType: activePaymentType,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[activePaymentType] || 'Card',
      paymentMethodData: {
        billing_details: {
          name: `${billingAddress.firstName} ${billingAddress.lastName}`.trim() || undefined,
          email: email || undefined,
          phone: billingAddress.phone || undefined,
          address: {
            line1: billingAddress.address,
            line2: billingAddress.apt || undefined,
            city: billingAddress.city,
            state: billingAddress.state,
            postal_code: billingAddress.zip,
            country: 'US',
          },
        },
      },
    });
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
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Payment</h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.soft }}>
                <LockIcon />
                All transactions are secure and encrypted.
              </span>
            </div>
            <div style={paymentBox}>
              <div ref={paymentElementRef} />
              {paymentElementError && (
                <p style={{ fontSize: 12, color: '#a13d2b', marginTop: 8 }}>{paymentElementError}</p>
              )}
              <label style={{ ...checkboxLabel, marginTop: 14 }}>
                <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
                Use shipping address as billing address
              </label>
              {!billingSame && (
                <div style={{ marginTop: 10 }}>
                  <AddressFields value={billing} onChange={setBilling} idPrefix="bill" />
                </div>
              )}
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
            disabled={submitting || !stripeReady}
            style={{
              ...S.btnFill, width: '100%', justifyContent: 'center', marginTop: 20,
              height: 58, fontSize: 13, opacity: submitting || !stripeReady ? 0.6 : 1,
            }}
          >
            {submitting ? 'Processing…' : `Place order — $${grandTotal.toFixed(2)}`}
          </button>
          <div style={secureNote}>
            <LockIcon />
            <span>256-bit SSL encrypted &middot; your card details never touch our servers</span>
          </div>
          <p style={{ fontSize: 11, color: T.soft, textAlign: 'center', marginTop: 8 }}>
            Payments securely processed by Stripe
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
            [LockIcon, 'Secure checkout', 'Payments encrypted and processed by Stripe.'],
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
const paymentBox = { border: `1px solid ${T.line}`, background: T.paper, padding: 16 };
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
