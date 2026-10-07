import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import AddressFields from '../components/AddressFields';
import { useCart } from '../lib/useCart';
import { tokenizeCard } from '../lib/qbPayments';
import { PRODUCTS, getProductById } from '../lib/products';
import { firstTimeThisSession } from '../lib/funnelTracking';
import { fbTrack, generateEventId, refreshPixelIdentity } from '../lib/fbPixel';
import { getIdentity, rememberIdentity } from '../lib/identity';
import { getStoredAttribution } from '../lib/attribution';
import { getSessionId } from '../lib/session';
import { captureCheckoutEmail } from '../lib/emailPlatform';
import { T, S } from '../lib/theme';
import { renderAmazonPayButton } from '../lib/amazonPayClient';

// Third and final step of the ad funnel — a single-page "order form" style
// checkout (product + quantity, shipping, payment all on one page), the
// structural pattern the funnel reference used. It reuses the exact same
// secure payment path as /checkout — QuickBooks Payments tokenizes the
// card from the browser straight against Intuit's API (lib/qbPayments.js),
// then /api/qb-checkout charges it server-side, so the raw card number
// never reaches this site's own server. Card only: QuickBooks' API has no
// Apple Pay / Google Pay / Afterpay support (the Square version of this
// page, with those wallets, is in git history). This page keeps its own
// local order state (one product + quantity) rather than depending on the
// shared cart, since it's meant to work as a standalone "buy this now"
// destination from an ad.
//
// Same honesty rule as /offer and /offer2: badges are pulled from real
// product data (lib/products.js), the guarantee is VEIL's real 30-day
// policy, and there's no fabricated accreditation badge, press logo, phone
// number, or countdown timer that doesn't correspond to something real.

const DISCOUNT_CODE = 'VEIL15';

// Flat optional add-on for reshipment/refund if a package is lost, damaged,
// or stolen in transit — same offering and price as /checkout. Adjust
// freely; only means something to a shopper if there's a real support
// process behind it (reship/refund on request for orders that paid for it).
const SHIPPING_PROTECTION_PRICE = 2.79;

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

const EMPTY_ADDRESS = { name: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };
const EMPTY_CARD = { number: '', expiry: '', cvc: '' };

// Same helpers as /checkout (pages/checkout.jsx): "MM / YY" while typing,
// split back into the { expMonth, expYear } shape lib/qbPayments.js expects.
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

// VEIL's shipping-protection mark — an open-flap box with a small
// shield-check badge overlapping its corner, reading as "this box is
// covered" rather than a generic insurance/shield glyph on its own.
function BoxProtectionIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M2.5 7.5l7.5-3.7 7.5 3.7-7.5 3.7-7.5-3.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.5 7.5v7.6l7.5 3.7 7.5-3.7V7.5M10 11.2v7.6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16.3 12.6l3 1v2.1c0 1.9-1.3 3-3 3.6-1.7-.6-3-1.7-3-3.6v-2.1l3-1Z" fill="#FCFBF7" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M15.2 16.3l.9.9 1.6-1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="7.7" r="1" fill="currentColor" />
    </svg>
  );
}



// Read server-side, same as /checkout, so client-side tokenization always
// targets the same Intuit environment the server charges against.
export async function getServerSideProps() {
  return { props: { qbEnvironment: process.env.QB_ENVIRONMENT === 'production' ? 'production' : 'sandbox' } };
}

export default function Offer3Page({ qbEnvironment }) {
  const router = useRouter();
  const { clear, applyDiscount, appliedDiscount } = useCart();

  const [selectedId, setSelectedId] = React.useState('original');
  const [quantity, setQuantity] = React.useState(1);
  const [email, setEmail] = React.useState('');
  const [shipping, setShipping] = React.useState(EMPTY_ADDRESS);
  const [shippingProtection, setShippingProtection] = React.useState(false);

  // Payment — plain card fields, tokenized against Intuit's API at submit
  // time (lib/qbPayments.js); nothing to mount or wait on.
  const [card, setCard] = React.useState(EMPTY_CARD);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const errorRef = React.useRef(null);
  const [discountApplied, setDiscountApplied] = React.useState(false);

  // The error message renders once, near the "Place order" button at the
  // bottom of the form — scrolled into view on every change so it's never
  // missed on a long single-page form.
  React.useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

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
  // checkout_start tracking /checkout does. Waits for router.query so the
  // scent an ad link chose (?scent=…) is what gets reported rather than the
  // default, and fires each event at most once per scent per browser
  // session (lib/funnelTracking.js), so a refresh isn't another checkout.
  // Someone who picked their scent on /offer2 already sent AddToCart
  // there; anyone landing here directly sends it now, since choosing a
  // product on this order form is that same step.
  React.useEffect(() => {
    if (!router.isReady) return;
    const queryScent = typeof router.query.scent === 'string' && PRODUCTS.some((p) => p.id === router.query.scent)
      ? router.query.scent
      : null;
    const id = queryScent || selectedId;
    const item = getProductById(id);
    if (!item) return;
    const value = item.price * quantity;
    const track = (pixelEvent, funnelEvent, params) => {
      const eventId = generateEventId();
      fbTrack(pixelEvent, params, eventId);
      fetch('/api/track/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: funnelEvent,
          eventId,
          value,
          productName: item.name,
          contentId: id,
          contentIds: [id],
          contents: [{ id, quantity }],
          url: window.location.href,
          sessionId: getSessionId(),
          ...getIdentity(),
        }),
        keepalive: true,
      }).catch(() => {});
    };
    if (firstTimeThisSession(`addtocart:offer:${id}`)) {
      track('AddToCart', 'addtocart', { content_ids: [id], content_name: item.name, content_type: 'product', value, currency: 'USD' });
    }
    if (firstTimeThisSession(`checkout_start:offer:${id}`)) {
      track('InitiateCheckout', 'checkout_start', { content_ids: [id], value, currency: 'USD', num_items: quantity });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const subtotal = product.price * quantity;
  const discountAmount = discountApplied
    ? (appliedDiscount?.type === 'percent' ? Math.round(subtotal * ((appliedDiscount.value || 15) / 100) * 100) / 100 : Math.min(appliedDiscount?.value || 0, subtotal))
    : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const addressEntered = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());
  const shippingCost = !addressEntered ? 0 : (subtotal >= 50 ? 0 : 5);
  const shippingProtectionCost = shippingProtection ? SHIPPING_PROTECTION_PRICE : 0;
  const grandTotal = discountedSubtotal + shippingCost + shippingProtectionCost;

  const latestRef = React.useRef({});
  latestRef.current = { email, shipping, product, quantity, grandTotal, shippingProtectionCost };

  // Amazon Pay (lib/amazonPayClient.js) — an alternative to the card form,
  // shown only once Amazon's button has rendered (hidden unless the
  // AMAZON_PAY_* env vars are set). Reads the order through latestRef at
  // click time, and checks email/address are filled in first since this
  // page collects them on the same screen.
  const [amazonPayReady, setAmazonPayReady] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    renderAmazonPayButton('amazon-pay-button', {
      getOrder: () => {
        const { email, shipping, product, quantity, grandTotal, shippingProtectionCost } = latestRef.current;
        const addrOk = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());
        if (!email.trim() || !addrOk) return { error: 'Enter your email and shipping address before paying with Amazon Pay.' };
        rememberIdentity({ email, phone: shipping.phone });
        return {
          amount: grandTotal, items: [{ ...product, quantity }], email, shipping,
          eventId: generateEventId(), url: window.location.href,
          attribution: getStoredAttribution(), sessionId: getSessionId(),
          shippingProtection: shippingProtectionCost || 0, storeName: 'VEIL',
        };
      },
      onError: setError,
    }).then((ok) => { if (!cancelled) setAmazonPayReady(ok); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Same abandoned-checkout capture as /checkout — fires once the shopper
  // leaves the email field, so someone who lands here from an ad and
  // doesn't finish still ends up recorded somewhere, not lost entirely.
  // Unlike /checkout, this page has no marketing-consent checkbox at all
  // (single-product order-form design, minimal friction for ad traffic),
  // so consent defaults to true here the same way the checkbox itself
  // defaults to checked everywhere else on the site — revisit this if
  // that sitewide default ever changes.
  const handleEmailBlur = () => {
    if (!email.trim()) return;
    // Same as /checkout: remember it for ad matching and re-init the Pixel
    // so the rest of this visit's events carry it (lib/identity.js).
    rememberIdentity({ email, phone: shipping.phone });
    refreshPixelIdentity(process.env.NEXT_PUBLIC_META_PIXEL_ID);
    const cartSnapshot = [{ id: product.id, name: product.name, quantity, price: product.price, images: product.images }];
    fetch('/api/checkout-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        cart: cartSnapshot,
        source: 'offer3',
        sessionId: getSessionId(),
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
    captureCheckoutEmail({ email, consent: true, cartValue: product.price * quantity, items: cartSnapshot });
  };

  const completeOrder = async (token) => {
    const { email, shipping, product, quantity, grandTotal, shippingProtectionCost } = latestRef.current;
    const purchaseEventId = generateEventId();
    const items = [{ ...product, quantity }];
    // The phone is often typed after the email field's blur already fired,
    // so record both again here — /success's browser Purchase reads them.
    rememberIdentity({ email, phone: shipping.phone });

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
        shippingProtection: shippingProtectionCost || 0,
        sessionId: getSessionId(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Payment failed');

    sessionStorage.setItem('veil-purchase', JSON.stringify({
      eventId: purchaseEventId,
      orderId: data.id,
      amount: grandTotal,
      contentIds: [product.id],
      contents: [{ id: product.id, quantity, item_price: product.price }],
    }));
    await router.push('/success');
    clear();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Enter your email to place your order.');
      return;
    }
    const expiry = parseExpiry(card.expiry);
    if (!card.number.trim() || !expiry || !card.cvc.trim()) {
      setError('Fill in your card details to place your order.');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: tokenize the card directly against Intuit's Payments Tokens
      // API from the browser (lib/qbPayments.js) — the raw card number never
      // reaches our own server. Billing address is the shipping address.
      const token = await tokenizeCard(
        {
          number: card.number,
          expMonth: expiry.expMonth,
          expYear: expiry.expYear,
          cvc: card.cvc,
          name: shipping.name.trim(),
          street: shipping.address,
          city: shipping.city,
          region: shipping.state,
          postalCode: shipping.zip,
          country: 'US',
        },
        qbEnvironment
      );

      // Step 2: charge that token server-side (/api/qb-checkout), which
      // authorizes and captures synchronously — no redirect, no webhook.
      await completeOrder(token);
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
            <AddressFields value={shipping} onChange={setShipping} inputStyle={input} rowClass2="o3-row-2" />
          </section>

          <section style={{ marginTop: 16 }}>
            <div style={protectionCard}>
              <div style={protectionIconBox}>
                <BoxProtectionIcon style={{ color: T.ink }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 14, color: T.ink }}>Shipping Protection</span>
                  <span title="Covers reshipment or a refund if your order is lost, damaged, or stolen in transit. Contact us and we'll make it right.">
                    <InfoIcon style={{ color: T.soft }} />
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>For lost, damaged, or stolen packages</div>
                <div style={{ fontSize: 13, color: T.ink, marginTop: 4 }}>${SHIPPING_PROTECTION_PRICE.toFixed(2)}</div>
              </div>
              <button
                type="button"
                onClick={() => setShippingProtection((v) => !v)}
                style={{ ...S.btnOutline, height: 38, padding: '0 20px', ...(shippingProtection ? { background: T.paper } : {}) }}
              >
                {shippingProtection ? 'Remove' : 'Add'}
              </button>
            </div>
          </section>

          <section style={{ marginTop: 32 }}>
            <h2 style={{ ...sectionTitle, marginBottom: 4 }}>3. Payment</h2>
            <p style={{ fontSize: 13, color: T.soft, marginBottom: 14 }}>All transactions are secure and encrypted.</p>

            {/* Amazon renders its own button here once configured; empty
                and spaceless until then. */}
            <div style={{ marginBottom: amazonPayReady ? 14 : 0 }}>
              <div id="amazon-pay-button" />
              {amazonPayReady && <p style={{ fontSize: 12, color: T.soft, textAlign: 'center', margin: '12px 0 0' }}>or pay by card</p>}
            </div>

            <div style={paymentList}>
              <div style={accordionRow}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Credit card</span>
              </div>
              <div style={accordionBody}>
                <div style={cardFieldGroup}>
                  <input
                    placeholder="Card number"
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: e.target.value })}
                    style={cardSubInput}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    required
                  />
                  <div style={{ height: 1, background: T.line }} />
                  <div style={{ display: 'flex' }}>
                    <input
                      placeholder="MM / YY"
                      value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                      style={{ ...cardSubInput, flex: 1 }}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      required
                    />
                    <div style={{ width: 1, background: T.line }} />
                    <input
                      placeholder="Security code"
                      value={card.cvc}
                      onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                      style={{ ...cardSubInput, flex: 1 }}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error && <p ref={errorRef} style={errorText}>{error}</p>}

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
              <ProductVisual id={product.id} images={product.images} alt={product.name} width={48} hoverSwap={false} />
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
          {shippingProtection && (
            <div style={summaryRow}>
              <span style={{ color: T.soft }}>Shipping Protection</span>
              <span>${SHIPPING_PROTECTION_PRICE.toFixed(2)}</span>
            </div>
          )}
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
const summaryCol = { padding: '32px 40px', background: T.white };
const secureNote = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, fontSize: 12, color: T.soft };
const sectionHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 8 };
const sectionTitle = { fontFamily: T.sans, fontWeight: 700, fontSize: 20, margin: 0 };
// fontSize must stay at 16px or higher — below that, iOS Safari auto-zooms
// the whole page in when a shopper taps into any of these fields, which is
// the "moves the checkout page weird" behavior on focus.
const input = { width: '100%', height: 44, padding: '0 14px', border: `1px solid ${T.line}`, background: T.white, fontFamily: T.sans, fontSize: 16, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 4 };
const scentGrid = { display: 'grid', gap: 12 };
const scentTile = { position: 'relative', textAlign: 'left', cursor: 'pointer', background: T.white, padding: '14px 14px 16px', borderRadius: 4 };
const scentBadge = { position: 'absolute', top: 8, right: 8, fontSize: 9, letterSpacing: '0.08em', background: T.ink, color: T.white, padding: '3px 7px', borderRadius: 3 };
const qtyStepper = { display: 'flex', alignItems: 'center', gap: 0, border: `1px solid ${T.line}`, borderRadius: 4 };
const qtyBtn = { width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: T.ink };
const paymentList = { border: `1.5px solid ${T.ink}`, borderRadius: 10, background: T.white, overflow: 'hidden' };
const accordionRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 14px', borderBottom: `1px solid ${T.line}`, background: T.white };
const accordionBody = { padding: '14px 14px 18px', background: T.white };
// Card number/expiry/CVC as one outlined box with thin internal dividers,
// same look as /checkout's card field.
const cardFieldGroup = { border: `1px solid ${T.line}`, borderRadius: 4, background: T.white, overflow: 'hidden' };
const cardSubInput = {
  width: '100%', height: 44, padding: '0 14px', border: 'none', background: 'transparent',
  fontFamily: T.sans, fontSize: 16, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box',
};
const protectionCard = {
  display: 'flex', alignItems: 'center', gap: 14, padding: 14,
  border: `1px solid ${T.line}`, borderRadius: 8, background: T.white,
};
const protectionIconBox = {
  width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${T.line}`, borderRadius: 8, background: T.white,
};
const errorText = { color: '#a13d2b', fontSize: 13, marginTop: 20 };
const summaryItem = { display: 'flex', alignItems: 'center', gap: 14, padding: '0 0 16px' };
const summaryImgWrap = { position: 'relative', width: 48, height: 48, flexShrink: 0, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.white };
const qtyBadge = { position: 'absolute', top: -8, right: -8, background: T.soft, color: T.white, borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const summaryRow = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 };
const legalLinks = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20, maxWidth: 1280, margin: '0 auto', padding: '24px 40px 36px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft, borderTop: `1px solid ${T.line}` };
