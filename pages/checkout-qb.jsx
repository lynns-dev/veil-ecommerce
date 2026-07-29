import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import AddressFields from '../components/AddressFields';
import { useCart } from '../lib/useCart';
import { tokenizeCard } from '../lib/qbPayments';
import { TASSEL_GIFT } from '../lib/products';
import { computeCartTotals } from '../lib/cartTotals';
import { fbTrack, generateEventId, refreshPixelIdentity } from '../lib/fbPixel';
import { getStoredAttribution } from '../lib/attribution';
import { getSessionId } from '../lib/session';
import { getIdentity, rememberIdentity } from '../lib/identity';
import { setCheckoutStep } from '../lib/checkoutStage';
import { loadCheckoutProgress, saveCheckoutProgress, clearCheckoutProgress } from '../lib/checkoutProgress';
import { captureCheckoutEmail } from '../lib/emailPlatform';
import { T, S } from '../lib/theme';

// Backup checkout page on QuickBooks Payments, at a stable URL separate
// from the live /checkout (pages/checkout.jsx, on Square now — see that
// file and pages/checkout-square.jsx) — not linked from anywhere on the
// site, kept in sync with the other two checkout pages' non-payment
// sections by hand. Reads QB_ENVIRONMENT straight from the
// server via getServerSideProps below rather than the separately-
// configured NEXT_PUBLIC_QB_ENVIRONMENT checkout.jsx uses, so this page's
// client-side tokenization can never drift out of sync with the server's
// own environment across Vercel's Preview/Production env-var scoping.
//
// A 2-step flow (Shipping -> Payment), modeled on Apple's own checkout
// (large touch-friendly fields/buttons) rather than the single long-scroll
// form this page used before — brand colors/fonts stay VEIL's own (black/
// white, Hanken Grotesk/Fraunces), not Apple's blue. Payment is the final
// step: its submit button ("Complete Order") tokenizes and charges the
// card directly rather than advancing to a separate review step — this
// used to be a 3-step Shipping -> Payment -> Review flow, but the review
// step was folded into Payment (its tassel-offer/total recap moved up,
// its shipping/payment-detail read-only recaps dropped as redundant with
// Step 1 and the order summary sidebar). Each step is real, native <form>
// validation (required/type="email" on visible fields only — a step's
// inputs aren't in the DOM at all while another step is active, so the
// browser only ever validates what's currently on screen) rather than
// hand-rolled field checks, except where the format needs custom parsing
// (card expiry).
//
// No Apple Pay / Google Pay / Afterpay — QuickBooks Payments (as
// integrated in lib/qbPayments.js / lib/qbPaymentsServer.js) is a raw
// card-token API with no wallet support, unlike Square's Web Payments SDK.
//
// The card form is plain <input> elements, not a third-party iframe —
// QuickBooks' tokenizeCard() call goes straight from the browser to
// Intuit's API with the raw field values, so there's no embedded SDK UI to
// fight with, and no separate styling
// surface that could conflict with anything on this page.
//
// Billing address is always the shipping address entered in Step 1 — no
// separate billing-address toggle, matching the simplification already
// made on this page; Step 2 just displays it as a read-only recap (like
// the reference checkout's "Use my shipping address" checked state).

const EMPTY_ADDRESS = { name: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };
const EMPTY_CARD = { number: '', expiry: '', cvc: '' };

// Formats raw digits as "MM / YY" while typing; parseExpiry below splits it
// back out into the { expMonth, expYear } shape lib/qbPayments.js expects.
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

function CheckIcon(props) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 12.5l5.5 5.5L20 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Itemized cart (image/name/size/qty/price — the free Tassel gift, always
// present per below, shows "FREE" rather than "$0.00"), discount code
// entry, and the full price breakdown — shown once at the top of the form
// column on both steps (in the space the old Shipping/Payment step
// indicator used to occupy), so a shopper never loses sight of what
// they're buying while filling in the form beneath it.
function OrderItemsPanel({
  cart, subtotal, giftValue, hasGift, totalSavings, shippingCost, addressEntered, grandTotal,
  discountCode, setDiscountCode, discountMessage, setDiscountMessage, appliedDiscount, clearDiscount, handleApplyDiscount,
}) {
  return (
    <div style={reviewCard}>
      <div>
        {cart.map((item) => (
          <div key={item.id} style={summaryItem}>
            <div style={summaryImgWrap}>
              <ProductVisual id={item.id} images={item.images} alt={item.name} width={48} hoverSwap={false} />
              <span style={qtyBadge}>{item.quantity}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{item.size}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: item.id === TASSEL_GIFT.id ? 700 : 400, color: item.id === TASSEL_GIFT.id ? T.green : T.ink }}>
              {item.id === TASSEL_GIFT.id ? 'FREE' : `$${(item.price * item.quantity).toFixed(2)}`}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            placeholder="Discount code"
            value={discountCode}
            onChange={(e) => {
              setDiscountCode(e.target.value);
              if (appliedDiscount) clearDiscount();
              setDiscountMessage('');
            }}
            // Same reasoning as the old inline field this replaces: Enter
            // must apply the code, not fall through to native form submit.
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              handleApplyDiscount();
            }}
            style={{ ...bigInput, height: 46, flex: 1 }}
          />
          <button type="button" style={{ ...smallOutlineButton, height: 46 }} onClick={handleApplyDiscount}>Apply</button>
        </div>
        {discountMessage && (
          <p style={{ fontSize: 12, color: appliedDiscount ? T.ink : '#a13d2b', marginTop: 8 }}>{discountMessage}</p>
        )}
      </div>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
        <div style={summaryRow}>
          <span style={{ color: T.soft }}>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {hasGift && (
          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Gift</span>
            <span>
              <span style={{ textDecoration: 'line-through', color: T.soft, marginRight: 8 }}>${giftValue.toFixed(2)}</span>
              <span style={{ color: T.green, fontWeight: 700 }}>$0.00</span>
            </span>
          </div>
        )}
        {totalSavings > 0 && (
          <div style={summaryRow}>
            <span style={{ color: T.green }}>Savings</span>
            <span style={{ color: T.green, fontWeight: 700 }}>−${totalSavings.toFixed(2)}</span>
          </div>
        )}
        <div style={summaryRow}>
          <span style={{ color: T.soft }}>Shipping</span>
          <span>{!addressEntered ? 'Enter address' : (shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`)}</span>
        </div>
        <div style={{ ...summaryRow, borderTop: `1px solid ${T.line}`, paddingTop: 12, marginTop: 4 }}>
          <span style={{ fontFamily: T.sans, fontSize: 17, fontWeight: 700 }}>Total</span>
          <span style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700 }}>${grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: { qbEnvironment: process.env.QB_ENVIRONMENT === 'production' ? 'production' : 'sandbox' } };
}

export default function CheckoutPage({ qbEnvironment }) {
  const router = useRouter();
  const { cart, total, hydrated, clear, add, appliedDiscount, applyDiscount, clearDiscount, codeDiscountAmount, discountedTotal } = useCart();

  // Loaded once at mount — see lib/checkoutProgress.js. Seeds the step +
  // contact/shipping state below so a refresh mid-checkout resumes instead
  // of starting over.
  const [savedProgress] = React.useState(loadCheckoutProgress);

  // Contact + delivery
  const [email, setEmail] = React.useState(savedProgress?.email ?? '');
  const [newsletter, setNewsletter] = React.useState(savedProgress?.newsletter ?? true);
  const [shipping, setShipping] = React.useState(savedProgress?.shipping ?? EMPTY_ADDRESS);

  // Payment — raw card fields (no third-party SDK/iframe); tokenized
  // directly against Intuit at final submit (Step 2) via lib/qbPayments.js.
  const [card, setCard] = React.useState(EMPTY_CARD);

  // 2-step flow (Shipping -> Payment) — Step 1's submit and Step 2's Back
  // button are the only ways to move between them now that the step
  // indicator (which also let a shopper jump back by clicking a completed
  // step's label) is gone.
  const [step, setStep] = React.useState(savedProgress?.step ?? 1);

  // Reported to the live-view heartbeat in pages/_app.jsx (via
  // lib/checkoutStage.js) so admin can see which step visitors are stuck
  // on, not just that they're "at checkout" generically.
  React.useEffect(() => {
    setCheckoutStep(step);
    return () => setCheckoutStep(null);
  }, [step]);

  // Mirrors step/email/newsletter/shipping to sessionStorage on every
  // change so a mid-checkout refresh (F5, accidental reload) resumes on
  // the same step with the address/email already filled in, rather than
  // bouncing back to a blank Step 1. Cleared on successful order below.
  React.useEffect(() => {
    saveCheckoutProgress({ step, email, newsletter, shipping });
  }, [step, email, newsletter, shipping]);

  // Historical funnel counter (admin's Today's funnel card) — reaching
  // Step 2 for the first time, deduped server-side per session so jumping
  // back and forth via the step indicator doesn't inflate this. Step 1 is
  // already covered by the existing checkout_start ping below.
  React.useEffect(() => {
    if (step !== 2) return;
    fetch('/api/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'checkout_payment', sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {});
  }, [step]);

  // Discount + UI state
  const [discountCode, setDiscountCode] = React.useState('');
  const [discountMessage, setDiscountMessage] = React.useState('');
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const errorRef = React.useRef(null);

  // Scrolled into view on every change so an error is never left off-screen.
  React.useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  // Every step change scrolls back to the top of the form — otherwise
  // advancing from a long Step 1 (address fully filled in, scrolled down)
  // to a short Step 2 can leave the shopper staring at empty space below
  // the fold with no visible change.
  React.useEffect(() => {
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const formTopRef = React.useRef(null);

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
        ...getIdentity(),
      }),
      keepalive: true,
    }).catch(() => {});
    // Fire once per checkout page load, not on every cart mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // The Tassel is now a free gift on every order, not an opt-in upsell —
  // added automatically once the cart's hydrated rather than via a click,
  // and re-added if it's ever missing (cart.length as the dep, not the
  // tassel's own presence, so this can't loop: adding it changes length,
  // which re-runs the effect once more and then finds it already there).
  React.useEffect(() => {
    if (!hydrated || cart.length === 0) return;
    if (!cart.some((i) => i.id === TASSEL_GIFT.id)) {
      add({ ...TASSEL_GIFT, price: 0, originalPrice: TASSEL_GIFT.price }, 1, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, cart.length]);

  const addressEntered = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());

  const shippingCost = !addressEntered || cart.length === 0 ? 0 : (total >= 50 ? 0 : 5);
  // Subtotal covers the paid items only, with the free Tassel broken out
  // as its own $0.00 "Gift" row (its $15 value struck through) and folded
  // into the single "Savings" figure instead — see lib/cartTotals.js.
  const { subtotal, giftValue, totalSavings, hasGift, grandTotal } = computeCartTotals({
    cart, codeDiscountAmount, shippingCost, discountedTotal,
  });

  const handleEmailBlur = () => {
    if (!email.trim()) return;
    // Remember it for ad matching, and re-init the Pixel so the rest of
    // this visit's events carry it rather than waiting for the next page
    // load (lib/identity.js, lib/fbPixel.js).
    rememberIdentity({ email, phone: shipping.phone });
    refreshPixelIdentity(process.env.NEXT_PUBLIC_META_PIXEL_ID);
    fetch('/api/checkout-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        cart: cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
        source: 'checkout',
        sessionId: getSessionId(),
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
    // Separately, import into the email platform's subscriber list —
    // consent is whatever the "Email me with news and offers" checkbox
    // above is currently set to (defaults checked); unchecked, the email
    // app's own checkout-capture route no-ops rather than subscribing them.
    captureCheckoutEmail({ email, consent: newsletter, cartValue: total, items: cart });
  };

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

  const goToStep = (n) => {
    setError('');
    setStep(n);
  };

  // Each step is real native <form> validation — required/type="email" on
  // whichever fields are actually mounted for the current step (a step
  // that isn't showing has its inputs removed from the DOM entirely, not
  // just hidden, so the browser only ever validates what's on screen).
  // Card expiry needs its own check since "MM / YY" isn't a native input
  // type; everything else here just needs the step to have gotten this far
  // for the browser's own required-field validation to have already passed.
  const handleStepSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      // City/State are normally filled in from the ZIP rather than typed
      // (components/AddressFields.jsx), so native `required` can't vouch
      // for them — they aren't in the DOM while the lookup is holding
      // them. Guard here instead, otherwise a lookup still in flight lets
      // Step 1 pass with no city and the order is recorded with no
      // shippable address.
      if (!shipping.city.trim() || !shipping.state) {
        setError('Enter a ZIP code so we can confirm your city and state.');
        return;
      }
      goToStep(2);
      return;
    }

    // Step 2 — validate card fields, then actually charge the card.
    const expiry = parseExpiry(card.expiry);
    if (!card.number.trim() || !expiry || !card.cvc.trim()) {
      setError('Fill in your card details to continue.');
      return;
    }
    setSubmitting(true);
    try {
      // Step A: tokenize the card directly against Intuit's Payments
      // Tokens API from the browser (lib/qbPayments.js) — the raw card
      // number never reaches our own server. The token is single-use and
      // tied to this exact card + billing address + CVC. No separate
      // "Name on card" field — the cardholder name Intuit's API wants is
      // just the shipping name already collected in Step 1.
      const token = await tokenizeCard(
        {
          number: card.number,
          expMonth: expiry.expMonth,
          expYear: expiry.expYear,
          cvc: card.cvc,
          name: (shipping.name || `${shipping.firstName || ''} ${shipping.lastName || ''}`).trim(),
          street: shipping.address,
          city: shipping.city,
          region: shipping.state,
          postalCode: shipping.zip,
          country: 'US',
        },
        qbEnvironment
      );

      const purchaseEventId = generateEventId();

      // Step B: charge that token server-side (/api/qb-checkout).
      // lib/qbPaymentsServer.js's chargeCard() authorizes and captures
      // funds synchronously within that one call — no redirect, no
      // webhook, so fulfillment and the success-page navigation both
      // happen right here.
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
          sessionId: getSessionId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      sessionStorage.setItem('veil-purchase', JSON.stringify({
        eventId: purchaseEventId,
        orderId: data.id,
        amount: grandTotal,
        contentIds: cart.map((i) => i.id),
        contents: cart.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
      }));
      clearCheckoutProgress();
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
      <header className="desktop-topbar" style={topbar}>
        <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/images/veil-logo-black.png" alt="VEIL" style={{ height: 24, width: 'auto' }} />
          </Link>
          <div style={secureBadge}>
            <LockIcon style={{ color: T.soft }} />
            <span>Secure Checkout</span>
          </div>
        </div>
      </header>

      {/* Mobile-only compact header — small lock badge + logo left, total
          right. White background (not the old T.paper toggle bar, which
          read as an off-white/gray band against the rest of the page).
          Tapping the total opens the itemized receipt popup below instead
          of the old inline-collapsing order summary, since that popup now
          covers the same job in less space. */}
      <header className="mobile-topbar" style={mobileTopbar}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <LockIcon style={{ color: T.soft, flexShrink: 0 }} />
          <img src="/images/veil-logo-black.png" alt="VEIL" style={{ height: 16, width: 'auto' }} />
        </Link>
        <button type="button" onClick={() => setReceiptOpen(true)} style={mobileTotalButton}>
          <span style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>${grandTotal.toFixed(2)}</span>
          <span style={{ fontSize: 10, color: T.soft }}>▾</span>
        </button>
      </header>

      {receiptOpen && (
        <div style={receiptOverlay} onClick={() => setReceiptOpen(false)}>
          <div style={receiptSheet} onClick={(e) => e.stopPropagation()}>
            <div style={receiptHead}>
              <span style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 16 }}>Order summary</span>
              <button type="button" onClick={() => setReceiptOpen(false)} style={receiptClose} aria-label="Close">✕</button>
            </div>
            <div style={{ maxHeight: '40vh', overflowY: 'auto', padding: '4px 20px' }}>
              {cart.map((item) => (
                <div key={item.id} style={summaryItem}>
                  <div style={summaryImgWrap}>
                    <ProductVisual id={item.id} images={item.images} alt={item.name} width={48} hoverSwap={false} />
                    <span style={qtyBadge}>{item.quantity}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{item.size}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: item.id === TASSEL_GIFT.id ? 700 : 400, color: item.id === TASSEL_GIFT.id ? T.green : T.ink }}>
                    {item.id === TASSEL_GIFT.id ? 'FREE' : `$${(item.price * item.quantity).toFixed(2)}`}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '4px 20px 24px' }}>
              <div style={summaryRow}>
                <span style={{ color: T.soft }}>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {hasGift && (
                <div style={summaryRow}>
                  <span style={{ color: T.soft }}>Gift</span>
                  <span>
                    <span style={{ textDecoration: 'line-through', color: T.soft, marginRight: 8 }}>${giftValue.toFixed(2)}</span>
                    <span style={{ color: T.green, fontWeight: 700 }}>$0.00</span>
                  </span>
                </div>
              )}
              {totalSavings > 0 && (
                <div style={summaryRow}>
                  <span style={{ color: T.green }}>Savings</span>
                  <span style={{ color: T.green, fontWeight: 700 }}>−${totalSavings.toFixed(2)}</span>
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
            </div>
          </div>
        </div>
      )}

      <div className="checkout-grid" style={checkoutGrid}>
        <div className="form-col" style={formCol}>
          <div ref={formTopRef} />
          <OrderItemsPanel
            cart={cart}
            subtotal={subtotal}
            giftValue={giftValue}
            hasGift={hasGift}
            totalSavings={totalSavings}
            shippingCost={shippingCost}
            addressEntered={addressEntered}
            grandTotal={grandTotal}
            discountCode={discountCode}
            setDiscountCode={setDiscountCode}
            discountMessage={discountMessage}
            setDiscountMessage={setDiscountMessage}
            appliedDiscount={appliedDiscount}
            clearDiscount={clearDiscount}
            handleApplyDiscount={handleApplyDiscount}
          />

          <form
            onSubmit={handleStepSubmit}
            // Defense in depth alongside the discount-code field's own
            // Enter handling above: on Step 2 specifically, Enter pressed
            // anywhere that isn't the actual "Complete Order" button must
            // never submit — that's a real charge, not a step advance like
            // Step 1. Step 1 keeps normal Enter-to-advance behavior; only
            // Step 2's real-money submit is guarded.
            onKeyDown={(e) => {
              if (step === 2 && e.key === 'Enter' && e.target.type !== 'submit') e.preventDefault();
            }}
          >
            {step === 1 && (
              <section style={{ marginTop: 28 }}>
                <h1 style={stepTitle}>Where should we send your order?</h1>

                <div style={{ marginTop: 30 }}>
                  <p style={fieldGroupLabel}>Shipping address</p>
                  <AddressFields value={shipping} onChange={setShipping} idPrefix="ship" inputStyle={bigInput} />
                </div>

                {addressEntered && (
                  <div style={{ marginTop: 26 }}>
                    <p style={fieldGroupLabel}>Shipping method</p>
                    <div style={shipMethod}>
                      <div>
                        <div style={{ fontWeight: 700 }}>Standard Shipping</div>
                        <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>3–5 business days after order placed</div>
                      </div>
                      <span style={{ fontWeight: 700 }}>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 26 }}>
                  <p style={fieldGroupLabel}>Country</p>
                  <select value="United States" readOnly style={{ ...bigInput, color: T.soft }}>
                    <option>United States</option>
                  </select>
                </div>

                <div style={{ marginTop: 26 }}>
                  <p style={fieldGroupLabel}>Contact</p>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    style={bigInput}
                    autoComplete="email"
                    required
                  />
                  <label style={checkboxLabel}>
                    <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
                    Email me with news and offers
                  </label>
                </div>

                {error && <p ref={errorRef} style={errorText}>{error}</p>}

                <button type="submit" style={{ ...bigButton, marginTop: 24 }}>
                  Continue to final step
                </button>
              </section>
            )}

            {step === 2 && (
              <section style={{ marginTop: 28 }}>
                <h1 style={stepTitle}>How do you want to pay?</h1>
                <p style={{ fontSize: 13, color: T.soft, marginTop: 10 }}>All transactions are secure and encrypted.</p>

                <div style={{ ...paymentList, marginTop: 20 }}>
                  <div style={accordionRow}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>Credit or Debit Card</span>
                    <img src="/images/major-credit-card-logos-png-5.png" alt="Visa, Mastercard, American Express, Discover" style={{ height: 20, width: 'auto' }} />
                  </div>
                  <div style={accordionBody}>
                    <div style={cardFieldGroup}>
                      <div style={{ position: 'relative' }}>
                        <input
                          placeholder="Card number"
                          value={card.number}
                          onChange={(e) => setCard({ ...card, number: e.target.value })}
                          style={{ ...cardSubInput, paddingRight: 46 }}
                          inputMode="numeric"
                          autoComplete="cc-number"
                          required
                        />
                        <LockIconSolid style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', color: T.soft }} />
                      </div>
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
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            placeholder="Security code"
                            value={card.cvc}
                            onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                            style={{ ...cardSubInput, paddingRight: 38 }}
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            required
                          />
                          <HelpIcon style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: T.soft }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <p style={fieldGroupLabel}>Billing address</p>
                  <div style={billingRecap}>
                    <CheckIcon style={{ color: T.ink, flexShrink: 0, marginTop: 3 }} />
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Same as shipping address</div>
                      <div style={{ color: T.soft, fontSize: 13, lineHeight: 1.6 }}>
                        {shipping.name || `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim()}<br />
                        {shipping.address}{shipping.apt ? `, ${shipping.apt}` : ''}<br />
                        {shipping.city}, {shipping.state} {shipping.zip}
                      </div>
                    </div>
                  </div>
                </div>

                {error && <p ref={errorRef} style={errorText}>{error}</p>}

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button type="button" onClick={() => goToStep(1)} style={bigButtonSecondary} disabled={submitting}>
                    Back
                  </button>
                  <button type="submit" disabled={submitting} style={{ ...bigButton, flex: 1, opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? 'Processing…' : `Complete Order — $${grandTotal.toFixed(2)}`}
                  </button>
                </div>
                <div style={secureNote}>
                  <LockIcon />
                  <span>256-bit SSL encrypted &middot; your card details never touch our servers</span>
                </div>
                <p style={{ fontSize: 11, color: T.soft, textAlign: 'center', marginTop: 8 }}>
                  Payments securely processed by QuickBooks
                </p>
              </section>
            )}
          </form>
        </div>

        <aside className="order-summary" style={summaryCol}>
          <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 20 }}>
            {cart.map((item) => (
              <div key={item.id} style={summaryItem}>
                <div style={summaryImgWrap}>
                  <ProductVisual id={item.id} images={item.images} alt={item.name} width={48} hoverSwap={false} />
                  <span style={qtyBadge}>{item.quantity}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{item.size}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: item.id === TASSEL_GIFT.id ? 700 : 400, color: item.id === TASSEL_GIFT.id ? T.green : T.ink }}>
                  {item.id === TASSEL_GIFT.id ? 'FREE' : `$${(item.price * item.quantity).toFixed(2)}`}
                </div>
              </div>
            ))}
          </div>

          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {hasGift && (
            <div style={summaryRow}>
              <span style={{ color: T.soft }}>Gift</span>
              <span>
                <span style={{ textDecoration: 'line-through', color: T.soft, marginRight: 8 }}>${giftValue.toFixed(2)}</span>
                <span style={{ color: T.green, fontWeight: 700 }}>$0.00</span>
              </span>
            </div>
          )}
          {totalSavings > 0 && (
            <div style={summaryRow}>
              <span style={{ color: T.green }}>Savings</span>
              <span style={{ color: T.green, fontWeight: 700 }}>−${totalSavings.toFixed(2)}</span>
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
        .mobile-topbar { display: none; }
        .checkout-grid { grid-template-columns: 1.35fr 1fr; }
        .form-col { padding: 32px 20px; }
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
          .desktop-topbar { display: none; }
          .mobile-topbar { display: flex; }
          .order-summary { display: none; }
          .form-col { padding: 32px 25px; }
        }
        @media (max-width: 520px) {
          :global(.row-3) { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

const topbar = { borderBottom: `1px solid ${T.line}`, textAlign: 'center' };
// Compact mobile-only header — small logo left, total right (tap to open
// the itemized receipt popup). White background explicitly, not T.paper —
// the old T.paper toggle bar this replaces was reading as an off-white/
// gray band against the rest of the page on mobile.
// display is deliberately NOT set here — inline styles always beat CSS
// rules, so if 'none' were set inline here, the <style jsx> media query
// below meant to show this at mobile widths could never override it.
// display: none/flex lives entirely in that stylesheet instead.
const mobileTopbar = {
  alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px', borderBottom: `1px solid ${T.line}`, background: T.white,
};
const mobileTotalButton = {
  display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
  padding: 0, cursor: 'pointer', color: T.ink,
};
const receiptOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(22,20,15,0.4)', zIndex: 50,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const receiptSheet = {
  width: '100%', maxWidth: 480, background: T.white, borderRadius: '20px 20px 0 0',
  maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const receiptHead = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '18px 20px', borderBottom: `1px solid ${T.line}`,
};
const receiptClose = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: T.soft, padding: 4,
};
const checkoutGrid = { display: 'grid', maxWidth: 1280, margin: '0 auto', columnGap: 40, rowGap: 20 };
// Horizontal padding lives in the .form-col CSS class below (not inline)
// specifically so the mobile media query can override it — an inline style
// always wins over a plain CSS rule regardless of media query, so this
// value can't just be bumped in place for mobile the way most of this
// file's styling works.
const formCol = { borderRight: `1px solid ${T.line}` };
const summaryCol = { padding: '32px 40px', background: T.white };
const secureNote = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, fontSize: 12, color: T.soft };
const secureBadge = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.soft, fontFamily: T.sans };

// Step heading — replaces the old small-caps section titles for the
// 2-step flow's single big question per screen. Sized down from an
// earlier 28px/800 — that read as too heavy/loud as the very first thing
// on the page, competing with the logo above it instead of sitting
// underneath it in the hierarchy.
const stepTitle = { fontFamily: T.sans, fontWeight: 700, fontSize: 22, margin: 0, color: T.ink, lineHeight: 1.25 };
// letterSpacing dropped from 0.12em to 0.04em — 0.12em on 11px uppercase
// text read as too spread out, especially on narrow mobile widths.
const fieldGroupLabel = {
  fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: T.soft, fontWeight: 700, marginBottom: 10,
};


// Bigger than the old `input` (58px vs 44px tall, 14px radius vs 4px) —
// "large buttons and forms, easy to press on phone" per request. fontSize
// stays 16px or higher — below that, iOS Safari auto-zooms the whole page
// in when a shopper taps into any of these fields.
const bigInput = {
  width: '100%', height: 58, padding: '0 18px', border: `1px solid ${T.fieldLine}`, background: T.white,
  fontFamily: T.sans, fontSize: 16, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 14,
};
// Card number/expiry/CVC as one visual field (a single outlined box with
// thin internal dividers) rather than three separately-bordered inputs —
// matches how Stripe's own default card element reads. cardSubInput has no
// border/background of its own; cardFieldGroup supplies the one outer box.
const cardFieldGroup = { border: `1px solid ${T.fieldLine}`, borderRadius: 14, background: T.white, overflow: 'hidden' };
const cardSubInput = {
  width: '100%', height: 54, padding: '0 18px', border: 'none', background: 'transparent',
  fontFamily: T.sans, fontSize: 16, fontWeight: 400, color: T.ink, outline: 'none', boxSizing: 'border-box',
};
const bigButton = {
  ...S.btnFill, width: '100%', height: 60, borderRadius: 14, justifyContent: 'center',
  fontSize: 15, letterSpacing: 'normal', textTransform: 'none', fontWeight: 700,
};
const bigButtonSecondary = {
  ...S.btnOutline, height: 60, borderRadius: 14, justifyContent: 'center', padding: '0 26px',
  fontSize: 15, letterSpacing: 'normal', textTransform: 'none', fontWeight: 700,
};
// Same rounded/white-outline treatment as bigButtonSecondary, but sized to
// match bigInput's height (58px) exactly for the Apply button that sits
// directly beside a bigInput, and reused for the tassel "Add to cart"
// button for the same rounded-not-sharp-cornered consistency.
const smallOutlineButton = {
  ...S.btnOutline, height: 58, borderRadius: 14, justifyContent: 'center', padding: '0 22px',
  fontSize: 13, letterSpacing: 'normal', textTransform: 'none', fontWeight: 700,
};
const checkboxLabel = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13, color: T.soft };
const paymentList = { border: `1.5px solid ${T.ink}`, borderRadius: 14, background: T.white, overflow: 'hidden' };
const accordionRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '18px 18px', borderBottom: `1px solid ${T.line}`, background: T.white,
};
const accordionBody = { padding: '16px 18px 20px', background: T.white };
const billingRecap = {
  display: 'flex', gap: 12, padding: 16, border: `1.5px solid ${T.line}`, borderRadius: 14, background: T.white, fontSize: 14,
};
const reviewCard = { padding: 16, border: `1.5px solid ${T.line}`, borderRadius: 14, background: T.white, fontSize: 14 };
const shipMethod = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px',
  border: `1.5px solid ${T.ink}`, borderRadius: 14, fontSize: 14,
};
const errorText = { color: '#a13d2b', fontSize: 13, marginTop: 16 };
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
