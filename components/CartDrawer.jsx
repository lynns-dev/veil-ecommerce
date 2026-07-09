import React from 'react';
import Link from 'next/link';
import { T, S } from '../lib/theme';
import ProductVisual from './ProductVisual';
import { getProductById } from '../lib/products';

const FREE_SHIP_AT = 50;
const FREE_GIFT_AT = 70;

export default function CartDrawer({ cart, open, onClose, remove, setQty, total, add }) {
  const puff = getProductById('puff');
  const hasPuff = cart.some((i) => i.id === 'puff');
  const puffPrice = puff ? Math.round(puff.price * 0.9 * 100) / 100 : 0;

  const progressPct = Math.min(100, (total / FREE_GIFT_AT) * 100);
  const shipMarkerPct = (FREE_SHIP_AT / FREE_GIFT_AT) * 100;
  let progressMessage;
  if (total >= FREE_GIFT_AT) {
    progressMessage = 'You’ve unlocked free shipping and a free scented tassel gift.';
  } else if (total >= FREE_SHIP_AT) {
    progressMessage = `Free shipping unlocked — add $${(FREE_GIFT_AT - total).toFixed(2)} more for a free scented tassel gift.`;
  } else {
    progressMessage = `Add $${(FREE_SHIP_AT - total).toFixed(2)} more for free shipping.`;
  }

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
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={S.label}>Your cart</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.ink }}>×</button>
        </div>

        {cart.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, color: T.ink, marginBottom: 8 }}>{progressMessage}</p>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${progressPct}%` }} />
              <div style={{ ...progressMarker, left: `${shipMarkerPct}%` }} />
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 && <p style={{ color: T.soft, fontSize: 14 }}>Your cart is empty.</p>}
          {cart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '18px 0', borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={itemImg}>
                  <ProductVisual id={item.id} images={item.images} alt={item.name} width={56} />
                </div>
                <div>
                  <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 20 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>${item.price} · {item.size}</div>
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
            <div style={upsellCard}>
              <div style={itemImg}>
                <ProductVisual id="puff" images={puff.images} alt={puff.name} width={44} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{puff.name}</div>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>
                  <span style={{ textDecoration: 'line-through', marginRight: 6 }}>${puff.price}</span>
                  ${puffPrice.toFixed(2)} · 10% off
                </div>
              </div>
              <button onClick={() => add({ ...puff, price: puffPrice }, 1)} style={upsellAddBtn}>Add</button>
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 20, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={S.label}>Total</span>
            <span style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 24 }}>${total.toFixed(2)}</span>
          </div>
          <Link
            href="/checkout"
            onClick={(e) => cart.length === 0 && e.preventDefault()}
            style={{ ...S.btnFill, width: '100%', justifyContent: 'center', opacity: cart.length === 0 ? 0.4 : 1, textAlign: 'center' }}
          >
            Checkout
          </Link>
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

const progressTrack = { position: 'relative', height: 4, background: T.paper, marginTop: 2 };
const progressFill = { position: 'absolute', top: 0, left: 0, bottom: 0, background: T.ink, transition: 'width .3s ease' };
const progressMarker = { position: 'absolute', top: -3, bottom: -3, width: 2, background: T.white, boxShadow: `0 0 0 1px ${T.ink}` };

const upsellCard = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0',
  borderBottom: `1px solid ${T.line}`, borderTop: `1px dashed ${T.line}`,
};
const upsellAddBtn = {
  fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', border: `1px solid ${T.ink}`,
  background: 'none', padding: '8px 14px', cursor: 'pointer', fontFamily: T.sans, flexShrink: 0,
};
