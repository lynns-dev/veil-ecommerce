import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import AddressFields from '../components/AddressFields';
import { useCart } from '../lib/useCart';
import {
  createSquareCard, tokenizeSquareCard,
  createApplePayButton, createGooglePayButton, createAfterpayButton, tokenizeWallet,
} from '../lib/squareClient';
import { TASSEL_GIFT } from '../lib/products';
import { fbTrack, generateEventId } from '../lib/fbPixel';
import { getStoredAttribution } from '../lib/attribution';
import { getSessionId } from '../lib/session';
import { setCheckoutStep } from '../lib/checkoutStage';
import { loadCheckoutProgress, saveCheckoutProgress, clearCheckoutProgress } from '../lib/checkoutProgress';
import { captureCheckoutEmail } from '../lib/emailPlatform';
import { T, S } from '../lib/theme';

// Backup checkout page on Square (Web Payments SDK), at a stable URL
// separate from the live /checkout (pages/checkout.jsx) — not linked from
// anywhere on the site. Identical twin of the live page (same reasoning as
// pages/checkout-qb.jsx for QuickBooks): to rotate Square back to live,
// swap which file lives at pages/checkout.jsx. Keep both non-payment
// sections and Square integration in sync by hand when any of the three
// checkout pages changes.
//
// A 2-step flow (Shipping -> Payment), modeled on Apple's own checkout
// (large touch-friendly fields/buttons) rather than the single long-scroll
// form this page used before — brand colors/fonts stay VEIL's own (black/
// white, Hanken Grotesk/Fraunces), not Apple's blue. Payment is the final
// step: its submit button ("Complete Order") tokenizes and charges the
// card directly rather than advancing to a separate review step. Each step
// is real, native <form> validation (required/type="email" on visible
// fields only — a step's inputs aren't in the DOM at all while another
// step is active, so the browser only ever validates what's currently on
// screen).
//
// Square's Web Payments SDK renders its own card number/expiry/CVC/postal
// element (a single bordered box, already merged the way this redesign
// wants a card field to look) into #square-card-container — see the mount
// effect below, gated on step === 2 since that container isn't in the DOM
// at all until Step 2 renders (Square's attach() needs the element to
// already exist). Apple Pay / Google Pay / Afterpay mount as soon as the
// card element is ready, each wrapped so a wallet that isn't available
// (unsupported browser/device, Afterpay's order-amount range, etc.) just
// doesn't show its button rather than breaking the rest of checkout.
//
// Billing address is always the shipping address entered in Step 1 — no
// separate billing-address toggle; Step 2 just displays it as a read-only
// recap.

const EMPTY_ADDRESS = { firstName: '', lastName: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };

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
  cart, subtotal, totalSavings, shippingCost, addressEntered, grandTotal,
  discountCode, setDiscountCode, discountMessage, setDiscountMessage, appliedDiscount, clearDiscount, handleApplyDiscount,
}) {
  return (
    <div style={reviewCard}>
      <div>
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
        {totalSavings > 0 && (
          <div style={summaryRow}>
            <span style={{ color: T.green }}>You saved</span>
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

export default function CheckoutPage() {
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

  // Payment — Square's Card element renders its own number/expiry/CVC/
  // postal-code fields into #square-card-container; the returned Card
  // instance lives in squareCardRef for tokenize() at submit time.
  // squareReady disables submit until it's actually mounted.
  const squareCardRef = React.useRef(null);
  const [squareReady, setSquareReady] = React.useState(false);
  const [squareError, setSquareError] = React.useState('');

  // Apple Pay / Google Pay / Afterpay tokenize on click against the method
  // instance Square attaches into each container below. Tri-state, not
  // boolean: null = still attaching (render the container visible, since
  // that's exactly when attach() needs it to have real dimensions —
  // Apple Pay's own button validates the target element's size at attach
  // time and silently fails against a zero-size/display:none container,
  // unlike Google Pay/Afterpay which tolerate it and just fill in once
  // visible). Only collapse a container once we know for sure (false).
  const appleMethodRef = React.useRef(null);
  const googleMethodRef = React.useRef(null);
  const afterpayMethodRef = React.useRef(null);
  const [appleAvailable, setAppleAvailable] = React.useState(null);
  const [googleAvailable, setGoogleAvailable] = React.useState(null);
  const [afterpayAvailable, setAfterpayAvailable] = React.useState(null);
  // Temporary on-screen diagnostics for whichever wallet(s) fail to
  // initialize — remove once Apple Pay is confirmed working live; the
  // underlying error otherwise only ever reaches the browser console
  // (lib/squareClient.js's own console.error), which isn't reachable from
  // a phone without a separate computer.
  const [walletErrors, setWalletErrors] = React.useState({});

  // 2-step flow (Shipping -> Payment) — Step 1's submit and Step 2's Back
  // button are the only ways to move between them now that the step
  // indicator (which also let a shopper jump back by clicking a completed
  // step's label) is gone.
  const [step, setStep] = React.useState(savedProgress?.step ?? 1);

  // Reported to the live-view heartbeat in pages/_app.jsx (via
  // lib/checkoutStage.js) so admin can see which step visitors are stuck
  // on, not just that they're "at checkout" generically. Cleared on
  // unmount so a visitor who navigates away doesn't linger as mid-checkout
  // until their next heartbeat happens to overwrite it.
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
  // back and forth doesn't inflate this. Step 1 is already covered by the
  // existing checkout_start ping below.
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
      add({ ...TASSEL_GIFT, price: 0, originalPrice: TASSEL_GIFT.price }, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, cart.length]);

  // Mounts Square's own card-entry form into #square-card-container —
  // gated on step === 2 since that container isn't in the DOM at all until
  // Step 2 renders (a step's inputs are removed entirely, not just hidden,
  // same as every other field on this page), and Square's attach() needs
  // the element to already exist. Re-mounts fresh every time Step 2 is
  // (re-)entered — going back to Step 1 unmounts the container along with
  // the rest of that step's JSX, which would otherwise leave the old Card
  // instance attached to a now-detached node.
  React.useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    (async () => {
      try {
        const card = await createSquareCard('square-card-container');
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
      setSquareReady(false);
    };
  }, [step]);

  const addressEntered = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());

  // Mounts Apple Pay / Google Pay / Afterpay as soon as the Square SDK is
  // ready (which only happens on Step 2, per the effect above — shipping is
  // always already filled in by then, unlike this same code's previous
  // single-page layout). Each pre-declares a total when created (whatever
  // grandTotal is at that moment); known limitation: that displayed total
  // doesn't live-update as discounts change afterward (recreating the
  // buttons on every total change would flicker them) — the amount actually
  // charged is always read fresh from latestRef at tokenize time, so this
  // is a display lag, not a billing bug. Afterpay additionally has its own
  // order-amount eligibility range — outside it, createAfterpayButton fails
  // the same way an unsupported browser/device does for Apple/Google Pay,
  // and the button just doesn't appear.
  React.useEffect(() => {
    if (!squareReady) return;
    let cancelled = false;
    const cleanupFns = [];

    (async () => {
      const amount = latestRef.current.grandTotal;

      const apple = await createApplePayButton(amount, (err) => {
        const msg = err?.message || String(err);
        // Expected on every non-Safari browser (Square's own "unsupported"
        // error for that case) — the button is already hidden via
        // appleAvailable(false) below, so this isn't a real failure worth
        // surfacing as an error banner to the vast majority of shoppers.
        if (/apple pay is only available on safari/i.test(msg)) return;
        setWalletErrors((w) => ({ ...w, apple: msg }));
      });
      if (!cancelled) {
        if (apple) {
          appleMethodRef.current = apple;
          setAppleAvailable(true);
        } else {
          setAppleAvailable(false);
        }
      }

      const google = await createGooglePayButton(amount, 'google-pay-button', (err) => {
        setWalletErrors((w) => ({ ...w, google: err?.message || String(err) }));
      });
      if (cancelled) {
        google?.destroy?.().catch(() => {});
      } else if (google) {
        googleMethodRef.current = google;
        setGoogleAvailable(true);
        const btn = document.getElementById('google-pay-button');
        const onClick = (event) => { event.preventDefault(); handleWalletPay(googleMethodRef, 'Google Pay'); };
        btn?.addEventListener('click', onClick);
        cleanupFns.push(() => btn?.removeEventListener('click', onClick));
      } else {
        setGoogleAvailable(false);
      }

      const afterpay = await createAfterpayButton(amount, 'afterpay-button', (err) => {
        setWalletErrors((w) => ({ ...w, afterpay: err?.message || String(err) }));
      });
      if (cancelled) {
        afterpay?.destroy?.().catch(() => {});
      } else if (afterpay) {
        afterpayMethodRef.current = afterpay;
        setAfterpayAvailable(true);
        const btn = document.getElementById('afterpay-button');
        const onClick = (event) => { event.preventDefault(); handleWalletPay(afterpayMethodRef, 'Afterpay'); };
        btn?.addEventListener('click', onClick);
        cleanupFns.push(() => btn?.removeEventListener('click', onClick));
      } else {
        setAfterpayAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
      appleMethodRef.current?.destroy?.().catch(() => {});
      googleMethodRef.current?.destroy?.().catch(() => {});
      afterpayMethodRef.current?.destroy?.().catch(() => {});
      appleMethodRef.current = null;
      googleMethodRef.current = null;
      afterpayMethodRef.current = null;
      // Reset to null (pending), not false — a re-mount (leaving and
      // re-entering Step 2) needs each container visible again for its
      // next attach() attempt, same reasoning as the initial state.
      setAppleAvailable(null);
      setGoogleAvailable(null);
      setAfterpayAvailable(null);
      setWalletErrors({});
    };
    // handleWalletPay only ever reads fresh state via latestRef and stable
    // setters — safe to omit here so this doesn't re-attach on every
    // keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareReady]);

  const shippingCost = !addressEntered || cart.length === 0 ? 0 : (total >= 50 ? 0 : 5);
  const subtotal = cart.reduce((sum, item) => sum + (item.originalPrice ?? item.price) * item.quantity, 0);
  const discountTotal = subtotal - total;
  // The header line this feeds ("You saved") is the code discount plus the
  // Tassel's $15 value — explicit rather than derived from discountTotal
  // above (which is subtotal-vs-total generically) since the Tassel is
  // guaranteed on every order now, not just whenever it happens to be in cart.
  const totalSavings = codeDiscountAmount + TASSEL_GIFT.price;
  const grandTotal = discountedTotal + shippingCost;

  // Apple Pay/Google Pay's button click handler is attached once (see the
  // wallet mount effect above) and can fire long after that — reading
  // email/shipping/cart/grandTotal through this ref instead of closing
  // over them directly means it always sees what's currently on the page,
  // not what was there at mount.
  const latestRef = React.useRef({});
  latestRef.current = { email, shipping, cart, grandTotal };

  // Fires once the shopper's attention leaves the email field — a good
  // enough proxy for "entered their email" without hammering the KV store
  // on every keystroke. If they never complete the order, this is the only
  // record of them; lib/orderFulfillment.js upgrades the same entry to
  // 'purchased' if they do.
  const handleEmailBlur = () => {
    if (!email.trim()) return;
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

  // Shared by the card submit handler below and the Apple Pay/Google Pay/
  // Afterpay click handlers — every Square payment method resolves to the
  // same single-use token shape, so charging and fulfilling it is
  // identical regardless of which method produced it. Reads email/
  // shipping/cart/grandTotal from latestRef rather than closed-over state
  // since the wallet path can fire long after the render that created its
  // handler.
  const completeSquareOrder = async (token, paymentMethodLabel) => {
    const { email, shipping, cart, grandTotal } = latestRef.current;
    const purchaseEventId = generateEventId();

    const res = await fetch('/api/square-checkout', {
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
        paymentMethod: paymentMethodLabel,
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
    clearCheckoutProgress();
    await router.push('/success');
    clear();
  };

  // Apple Pay / Google Pay / Afterpay only render their own button — there's
  // no "Complete Order" click to hang the usual form-level required-field
  // validation off of, so this checks email/shipping directly before
  // approving (belt-and-suspenders here since Step 2 can't be reached
  // without Step 1's own native validation having already passed).
  const handleWalletPay = async (methodRef, label) => {
    setError('');
    const { email, shipping } = latestRef.current;
    const addrOk = Boolean(shipping.address.trim() && shipping.city.trim() && shipping.state && shipping.zip.trim());
    if (!email.trim() || !addrOk) {
      setError(`Enter your email and shipping address before paying with ${label}.`);
      return;
    }
    if (!methodRef.current) return;
    setSubmitting(true);
    try {
      const token = await tokenizeWallet(methodRef.current);
      await completeSquareOrder(token, `Square (${label})`);
    } catch (err) {
      if (!err.cancelled) {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Each step is real native <form> validation — required/type="email" on
  // whichever fields are actually mounted for the current step (a step
  // that isn't showing has its inputs removed from the DOM entirely, not
  // just hidden, so the browser only ever validates what's on screen).
  const handleStepSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      goToStep(2);
      return;
    }

    // Step 2 — charge via Square's Card element.
    if (!squareReady || !squareCardRef.current) {
      setError('Payment form is still loading — please wait a moment and try again.');
      return;
    }
    setSubmitting(true);
    try {
      // Step A: tokenize the card via Square's Web Payments SDK
      // (lib/squareClient.js) — the raw card number never reaches our own
      // server, only Square's. The token is single-use.
      //
      // verificationDetails deliberately omitted — passing one (even with
      // billingContact removed) routes tokenize() through Square's separate
      // buyer-verification call, which has previously rejected this
      // account's location even though the same location processes real
      // charges fine. The wallet buttons above call tokenize() with no
      // arguments and always succeed — mirroring that here avoids the
      // broken verification call.
      const token = await tokenizeSquareCard(squareCardRef.current);

      // Step B: charge that token server-side (/api/square-checkout) —
      // like every processor this site has used, a Square charge has no
      // redirect step and no webhook: it either succeeds or fails in this
      // same request, so fulfillment and the success-page navigation both
      // happen right here.
      await completeSquareOrder(token, 'Square');
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
                    <ProductVisual id={item.id} images={item.images} alt={item.name} width={48} />
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
              {discountTotal > 0 && (
                <div style={summaryRow}>
                  <span style={{ color: T.green }}>Discount</span>
                  <span style={{ color: T.green, fontWeight: 700 }}>−${discountTotal.toFixed(2)}</span>
                </div>
              )}
              {codeDiscountAmount > 0 && (
                <div style={summaryRow}>
                  <span style={{ color: T.green }}>Promo ({appliedDiscount.code})</span>
                  <span style={{ color: T.green, fontWeight: 700 }}>−${codeDiscountAmount.toFixed(2)}</span>
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

                {/* Google Pay's container always exists in the DOM (hidden
                    via display:none, not conditional rendering) since
                    Square's attach() needs to find it by id before we know
                    whether that wallet is actually available on this
                    browser/device; visible while still pending
                    (available === null), not just once confirmed true,
                    only collapsing once confirmed unavailable (=== false).
                    Apple Pay has no attach()/container at all — it's our
                    own native <button> below, styled with Safari's
                    -apple-pay-button appearance, shown/hidden by the same
                    tri-state rule via a plain conditional class instead. */}
                <div style={{ display: (appleAvailable !== false || googleAvailable !== false) ? 'block' : 'none', marginTop: 20 }}>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: appleAvailable !== false ? 'block' : 'none' }}>
                      <button
                        type="button"
                        className="apple-pay-button"
                        aria-label="Apple Pay"
                        onClick={() => handleWalletPay(appleMethodRef, 'Apple Pay')}
                      />
                    </div>
                    <div style={{ display: googleAvailable !== false ? 'block' : 'none' }}>
                      <div id="google-pay-button" style={walletButtonContainer} />
                    </div>
                  </div>
                </div>

                {/* Afterpay sits right above the card box — same
                    email/shipping validation via handleWalletPay, just
                    presented as an alternative to the card form specifically.
                    Only one "OR" divider total, after Afterpay and before
                    Credit card. */}
                <div style={{ display: afterpayAvailable !== false ? 'block' : 'none', marginTop: afterpayAvailable !== false && !(appleAvailable !== false || googleAvailable !== false) ? 20 : 10 }}>
                  <div id="afterpay-button" style={walletButtonContainer} />
                  <div style={orDivider}>
                    <span style={orDividerLine} />
                    <span style={orDividerText}>OR</span>
                    <span style={orDividerLine} />
                  </div>
                </div>

                {/* Temporary — see the walletErrors state comment above.
                    Only renders when a wallet actually failed to
                    initialize, so it's silent once removed/unneeded. */}
                {Object.keys(walletErrors).length > 0 && (
                  <p style={{ fontSize: 11, color: '#a13d2b', marginTop: 10, lineHeight: 1.5 }}>
                    {Object.entries(walletErrors).map(([k, msg]) => `${k}: ${msg}`).join(' · ')}
                  </p>
                )}

                <div style={{ ...paymentList, marginTop: 20 }}>
                  <div style={accordionRow}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>Credit or Debit Card</span>
                  </div>
                  <div style={accordionBody}>
                    {/* Square's Web Payments SDK renders its own card
                        number/expiry/CVC/postal fields into this container,
                        including its own network-brand logo as you type —
                        see the mount effect above. Nothing here reads or
                        holds the raw card data. */}
                    <div id="square-card-container" style={squareCardContainer} />
                    {!squareReady && !squareError && (
                      <p style={{ fontSize: 12, color: T.soft, marginTop: 8 }}>Loading payment form…</p>
                    )}
                    {squareError && (
                      <p style={{ fontSize: 12, color: '#a13d2b', marginTop: 8 }}>{squareError}</p>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <p style={fieldGroupLabel}>Billing address</p>
                  <div style={billingRecap}>
                    <CheckIcon style={{ color: T.ink, flexShrink: 0, marginTop: 3 }} />
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Same as shipping address</div>
                      <div style={{ color: T.soft, fontSize: 13, lineHeight: 1.6 }}>
                        {shipping.firstName} {shipping.lastName}<br />
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
                  <button type="submit" disabled={submitting || !squareReady} style={{ ...bigButton, flex: 1, opacity: submitting || !squareReady ? 0.6 : 1 }}>
                    {submitting ? 'Processing…' : `Complete Order — $${grandTotal.toFixed(2)}`}
                  </button>
                </div>
                <div style={secureNote}>
                  <LockIcon />
                  <span>256-bit SSL encrypted &middot; your card details never touch our servers</span>
                </div>
                <p style={{ fontSize: 11, color: T.soft, textAlign: 'center', marginTop: 8 }}>
                  Payments securely processed by Square
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
                  <ProductVisual id={item.id} images={item.images} alt={item.name} width={48} />
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
          {discountTotal > 0 && (
            <div style={summaryRow}>
              <span style={{ color: T.green }}>Discount</span>
              <span style={{ color: T.green, fontWeight: 700 }}>−${discountTotal.toFixed(2)}</span>
            </div>
          )}
          {codeDiscountAmount > 0 && (
            <div style={summaryRow}>
              <span style={{ color: T.green }}>Promo ({appliedDiscount.code})</span>
              <span style={{ color: T.green, fontWeight: 700 }}>−${codeDiscountAmount.toFixed(2)}</span>
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
            [LockIcon, 'Secure checkout', 'Payments encrypted and processed by Square.'],
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
        .apple-pay-button {
          display: inline-block;
          width: 100%;
          min-height: 44px;
          border-radius: 6px;
          -webkit-appearance: -apple-pay-button;
          -apple-pay-button-type: buy;
          -apple-pay-button-style: black;
        }
        @supports not (-webkit-appearance: -apple-pay-button) {
          .apple-pay-button { display: none; }
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
// directly beside a bigInput.
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
// Square's Web Payments SDK renders its own iframe-based fields into this
// container (card.attach), already inside its own bordered/rounded box —
// no border/padding here, or the card ends up boxed twice; min-height only,
// to keep the layout from jumping while the SDK script loads and mounts.
const squareCardContainer = { minHeight: 48 };
// No background/border/border-radius/overflow here — Apple Pay, Google
// Pay, and Afterpay each render their own styled button (their own colors,
// logo, corner radius, and — for Google Pay/Afterpay — an iframe sized to
// its own intrinsic dimensions). An earlier version added borderRadius +
// overflow:hidden to visually match this page's other rounded boxes, but
// that clipped the actual attached button (cut off, and reading as "too
// wide" since the clipped box no longer matched what Square rendered) —
// width: '100%' is the only sizing this container should constrain.
const walletButtonContainer = { width: '100%', minHeight: 44 };
const orDivider = { display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 0' };
const orDividerLine = { flex: 1, height: 1, background: T.line };
const orDividerText = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft };
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
