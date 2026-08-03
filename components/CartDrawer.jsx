import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T, S } from '../lib/theme';
import ProductVisual from './ProductVisual';
import { getProductById, discountedPrice, TASSEL_GIFT } from '../lib/products';
import { computeCartTotals } from '../lib/cartTotals';
import { createApplePayButton, tokenizeWalletWithContact } from '../lib/squareClient';
import { isShopPayAvailable, mountShopPayButton } from '../lib/shopPayClient';
import { fbTrack, generateEventId } from '../lib/fbPixel';
import { getStoredAttribution } from '../lib/attribution';
import { getSessionId } from '../lib/session';
import { getIdentity } from '../lib/identity';

const SHOP_PAY_CONTAINER_ID = 'cart-shop-pay-button';

const FREE_SHIP_AT = 50;

export default function CartDrawer({
  cart, open, onClose, remove, setQty, total, add, clear,
  appliedDiscount, applyDiscount, clearDiscount, codeDiscountAmount, discountedTotal,
}) {
  const router = useRouter();
  const [discountCode, setDiscountCode] = React.useState('');
  const [discountMessage, setDiscountMessage] = React.useState('');
  const [discountSubmitting, setDiscountSubmitting] = React.useState(false);
  const [applePayReady, setApplePayReady] = React.useState(false);
  const [shopPayReady, setShopPayReady] = React.useState(false);
  const [payError, setPayError] = React.useState('');
  const [paying, setPaying] = React.useState(false);
  const applePayRef = React.useRef(null);
  const shopPayEventIdRef = React.useRef(null);
  const puff = getProductById('puff');
  const hasPuff = cart.some((i) => i.id === 'puff');

  React.useEffect(() => {
    if (appliedDiscount) setDiscountCode(appliedDiscount.code);
  }, [appliedDiscount]);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountSubmitting(true);
    setDiscountMessage('Checking…');
    const data = await applyDiscount(discountCode);
    setDiscountSubmitting(false);
    if (data.valid) {
      setDiscountMessage(`Code "${data.code}" applied.`);
    } else if (data.error) {
      setDiscountMessage('Could not check that code — please try again.');
    } else {
      setDiscountMessage('That code isn’t valid.');
    }
  };

  const freeShipping = total >= FREE_SHIP_AT;
  // Shipping is only truly known once there's an address, but Apple Pay
  // from here has to commit to a number before opening its sheet — this
  // mirrors the checkout pages' own rule (free at $50+, otherwise $5).
  const shippingCost = cart.length === 0 ? 0 : (freeShipping ? 0 : 5);
  const { subtotal, giftValue, totalSavings, hasGift, grandTotal } = computeCartTotals({
    cart, codeDiscountAmount, shippingCost, discountedTotal,
  });

  // Apple Pay reads the amount at creation time, so the button is rebuilt
  // whenever the charged total changes (quantity edits, promo codes) —
  // otherwise the sheet could show a stale figure. Only mounted while the
  // drawer is actually open with something in it; createApplePayButton
  // resolves null off Safari, which just leaves the button hidden.
  const latestRef = React.useRef({});
  latestRef.current = { cart, grandTotal, shippingCost, discountCode: appliedDiscount?.code };

  React.useEffect(() => {
    if (!open || cart.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const apple = await createApplePayButton(grandTotal, null, { requestContact: true });
      if (cancelled) return;
      applePayRef.current = apple;
      setApplePayReady(Boolean(apple));
    })();
    return () => {
      cancelled = true;
      applePayRef.current = null;
      setApplePayReady(false);
    };
  }, [open, cart.length, grandTotal]);

  const handleApplePay = async () => {
    if (!applePayRef.current) return;
    setPayError('');
    setPaying(true);
    try {
      const { token, contact } = await tokenizeWalletWithContact(applePayRef.current);
      // Nothing is charged until there's somewhere to ship it — Apple
      // returns the sheet's contact info alongside the token, and an order
      // without a usable address can't be fulfilled.
      if (!contact) {
        setPayError('Apple Pay didn’t return a shipping address. Please use checkout instead.');
        return;
      }
      const { cart: items, grandTotal: amount } = latestRef.current;
      const purchaseEventId = generateEventId();
      const res = await fetch('/api/square-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount,
          items,
          email: contact.email,
          shipping: contact,
          eventId: purchaseEventId,
          url: window.location.href,
          paymentMethod: 'Square (Apple Pay)',
          attribution: getStoredAttribution(),
          sessionId: getSessionId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      sessionStorage.setItem('veil-purchase', JSON.stringify({
        eventId: purchaseEventId,
        orderId: data.id,
        amount,
        contentIds: items.map((i) => i.id),
        contents: items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
      }));
      onClose?.();
      await router.push('/success');
      clear?.();
    } catch (err) {
      if (!err.cancelled) setPayError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  // Shop Pay's button, unlike Apple Pay's, doesn't bake the amount in at
  // creation — a fresh session is requested (POST /api/shop-pay/session)
  // every time the shopper actually opens the sheet, so it's mounted once
  // per drawer-open rather than rebuilt on every total change. Availability
  // is a static SDK check (isShopPayAvailable), not tied to cart contents —
  // per-cart eligibility (every item needs a mapped Shopify variant, see
  // lib/shopifyProductMap.js) is discovered when a session is actually
  // requested, and a 422 there just surfaces as a normal payment error
  // rather than hiding the button pre-emptively, since there's no cheap way
  // to check mapping without asking the server.
  React.useEffect(() => {
    if (!open || cart.length === 0) return undefined;
    let cancelled = false;
    let teardown = null;
    (async () => {
      const available = await isShopPayAvailable();
      if (cancelled || !available) return;
      teardown = await mountShopPayButton(SHOP_PAY_CONTAINER_ID, {
        onSessionRequest: async () => {
          setPayError('');
          setPaying(true);
          const { cart: items, grandTotal: amount, shippingCost: shipping, discountCode: code } = latestRef.current;
          const purchaseEventId = generateEventId();
          shopPayEventIdRef.current = purchaseEventId;
          const res = await fetch('/api/shop-pay/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cart: items,
              amount,
              shippingCost: shipping,
              discountCode: code,
              eventId: purchaseEventId,
              email: getIdentity().email || undefined,
              url: window.location.href,
              attribution: getStoredAttribution(),
              sessionId: getSessionId(),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Shop Pay is unavailable for this cart.');
          return data.session;
        },
        onComplete: () => {
          // Optimistic, best-effort UX only — the order that actually lands
          // in this site's own ledger/admin comes from the Shopify webhook
          // (pages/api/shop-pay/webhook.js), which is the one thing
          // guaranteed to see every completed order even if this event
          // never fires (Shopify's own guidance: the shopper can close the
          // tab or lose their connection right after paying). Firing the
          // pixel here with the same eventId the webhook's server-side CAPI
          // call will use is what lets Meta dedupe the pair, same as every
          // other payment method on this site.
          const { cart: items, grandTotal: amount } = latestRef.current;
          fbTrack('Purchase', {
            content_ids: items.map((i) => i.id),
            content_type: 'product',
            contents: items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
            value: amount,
            currency: 'USD',
          }, shopPayEventIdRef.current);
          onClose?.();
          router.push('/success');
          clear?.();
          setPaying(false);
        },
        onClose: () => setPaying(false),
        onError: (err) => {
          setPayError(err?.message || 'Something went wrong with Shop Pay. Please try again.');
          setPaying(false);
        },
      });
      if (!cancelled) setShopPayReady(Boolean(teardown));
    })();
    return () => {
      cancelled = true;
      teardown?.();
      setShopPayReady(false);
    };
  }, [open, cart.length]);

  // The gift is no longer something to earn — checkout adds the Tassel to
  // every order (pages/checkout.jsx), and the promo bar now says so on every
  // page, so the old "add $X more for a free scented tassel gift" copy was
  // telling shoppers to spend more for something they already had. Free
  // shipping is the only remaining threshold, so the bar tracks just that.
  const progressPct = Math.min(100, (total / FREE_SHIP_AT) * 100);
  const progressMessage = freeShipping
    ? 'Free shipping unlocked — and your free scented tassel is included.'
    : `Add $${(FREE_SHIP_AT - total).toFixed(2)} more for free shipping. Your free scented tassel is already included.`;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(22,20,15,0.4)', zIndex: 200,
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .3s',
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100%)', zIndex: 201,
          background: T.white, borderLeft: `1px solid ${T.line}`, padding: '32px 30px',
          transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .35s ease',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
          <span style={S.label}>Your cart</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.ink }}>×</button>
        </div>

        {cart.length > 0 && (
          <div style={{ marginBottom: 24, flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: T.ink, marginBottom: 8 }}>{progressMessage}</p>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {cart.length === 0 && <p style={{ color: T.soft, fontSize: 14 }}>Your cart is empty.</p>}
          {cart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '18px 0', borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={itemImg}>
                  <ProductVisual id={item.id} images={item.images} alt={item.name} width={56} hoverSwap={false} />
                </div>
                <div>
                  <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 20 }}>{item.name}</div>
                  {item.plan === 'subscribe' && (
                    <div style={subscribeNote}>Subscribe &amp; save · every 2 months</div>
                  )}
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>
                    {item.id === TASSEL_GIFT.id ? (
                      <>FREE · {item.size}</>
                    ) : (
                      <>
                        <span style={{ textDecoration: 'line-through', marginRight: 4 }}>${item.price}</span>
                        ${discountedPrice(item.price).toFixed(2)} · {item.size}
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <button onClick={() => setQty(item.id, item.quantity - 1)} style={qtyBtn}>−</button>
                    <span style={{ fontSize: 13 }}>{item.quantity}</span>
                    <button onClick={() => setQty(item.id, item.quantity + 1)} style={qtyBtn}>+</button>
                  </div>
                </div>
              </div>
              <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, alignSelf: 'flex-start' }}>Remove</button>
            </div>
          ))}

          {puff && !hasPuff && cart.length > 0 && (
            <div style={upsellSection}>
              <p style={{ ...S.label, marginBottom: 12 }}>You might also like</p>
              <div style={upsellCard}>
                <div style={itemImg}>
                  <ProductVisual id="puff" images={puff.images} alt={puff.name} width={44} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{puff.name}</div>
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>
                    <span style={{ textDecoration: 'line-through', marginRight: 6 }}>${puff.price}</span>
                    ${discountedPrice(puff.price).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => add(puff, 1)} style={upsellAddBtn}>Add</button>
              </div>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ marginTop: 16, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                placeholder="Discount code"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(e.target.value);
                  if (appliedDiscount) clearDiscount();
                  setDiscountMessage('');
                }}
                style={discountInput}
              />
              <button type="button" style={S.btnOutline} onClick={handleApplyDiscount} disabled={discountSubmitting}>Apply</button>
            </div>
            {discountMessage && (
              <p style={{ fontSize: 12, color: appliedDiscount ? T.ink : '#a13d2b', marginTop: 6 }}>{discountMessage}</p>
            )}
          </div>
        )}

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 20, marginTop: 16, flexShrink: 0 }}>
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
          <p style={shippingNote}>{freeShipping ? 'Free shipping' : 'Shipping and taxes calculated at checkout'}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 0 18px' }}>
            <span style={S.label}>Total</span>
            <span style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 24 }}>${discountedTotal.toFixed(2)}</span>
          </div>
          <Link
            href="/checkout"
            onClick={(e) => cart.length === 0 && e.preventDefault()}
            style={{ ...S.btnFill, width: '100%', justifyContent: 'center', opacity: cart.length === 0 ? 0.4 : 1, textAlign: 'center' }}
          >
            Checkout
          </Link>

          {/* Apple Pay, under the main Checkout button and split off by an
              "or". Renders only once Square confirms the wallet is actually
              available (Safari + a verified merchant domain), so nothing
              shows on browsers that can't offer it. */}
          {(applePayReady || shopPayReady) && cart.length > 0 && (
            <>
              <div style={orDivider}>
                <span style={orDividerLine} />
                <span style={orDividerText}>or</span>
                <span style={orDividerLine} />
              </div>
              {applePayReady && (
                <button
                  type="button"
                  className="cart-apple-pay-button"
                  aria-label="Buy with Apple Pay"
                  disabled={paying}
                  onClick={handleApplePay}
                  style={{ opacity: paying ? 0.6 : 1, marginBottom: shopPayReady ? 10 : 0 }}
                />
              )}
            </>
          )}
          {/* Always in the DOM once there's a cart to mount into — the SDK
              (lib/shopPayClient.js) targets this id as soon as
              isShopPayAvailable() resolves, which can happen before
              shopPayReady flips true. Only the visible space collapses. */}
          {cart.length > 0 && (
            <div id={SHOP_PAY_CONTAINER_ID} style={{ display: shopPayReady ? 'block' : 'none', opacity: paying ? 0.6 : 1, pointerEvents: paying ? 'none' : 'auto' }} />
          )}
          {payError && <p style={{ fontSize: 12, color: '#a13d2b', marginTop: 10 }}>{payError}</p>}

          <style jsx>{`
            .cart-apple-pay-button {
              display: block;
              width: 100%;
              min-height: 44px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              -webkit-appearance: -apple-pay-button;
              -apple-pay-button-type: buy;
              -apple-pay-button-style: black;
            }
            @supports not (-webkit-appearance: -apple-pay-button) {
              .cart-apple-pay-button { display: none; }
            }
          `}</style>
        </div>
      </aside>
    </>
  );
}

const qtyBtn = {
  width: 26, height: 26, border: `1px solid ${T.line}`, background: 'transparent',
  cursor: 'pointer', fontSize: 14, lineHeight: 1, color: '#16140F',
};

const itemImg = {
  width: 56, height: 56, flexShrink: 0, overflow: 'hidden',
  background: T.paper, border: `1px solid ${T.line}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const subscribeNote = { fontSize: 11, color: T.soft, marginTop: 3, letterSpacing: '0.02em' };

const progressTrack = { position: 'relative', height: 4, background: T.paper, marginTop: 2 };
const progressFill = { position: 'absolute', top: 0, left: 0, bottom: 0, background: T.ink, transition: 'width .3s ease' };

const upsellSection = { background: T.paper, padding: '18px 16px', marginTop: 12 };
const upsellCard = { display: 'flex', alignItems: 'center', gap: 14 };
const upsellAddBtn = {
  fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', border: `1px solid ${T.ink}`,
  background: 'none', padding: '8px 14px', cursor: 'pointer', fontFamily: T.sans, flexShrink: 0,
};

const discountInput = {
  flex: 1, height: 44, padding: '0 14px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 13, color: T.ink, outline: 'none', boxSizing: 'border-box',
};

const summaryRow = { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' };
const orDivider = { display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' };
const orDividerLine = { flex: 1, height: 1, background: T.line };
const orDividerText = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft };
const shippingNote = { fontSize: 11, color: T.soft, marginTop: 8, letterSpacing: '0.02em' };
