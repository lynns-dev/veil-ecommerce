import React from 'react';
import { T, S } from '../lib/theme';
import ProductVisual from './ProductVisual';

export default function CartDrawer({ cart, open, onClose, remove, setQty, total, loading, checkout }) {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <span style={S.label}>Your cart</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.ink }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 && <p style={{ color: T.soft, fontSize: 14 }}>Your cart is empty.</p>}
          {cart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '18px 0', borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={itemImg}>
                  <ProductVisual id={item.id} image={item.image} alt={item.name} width={56} />
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
        </div>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 20, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={S.label}>Total</span>
            <span style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 24 }}>${total}</span>
          </div>
          <button
            onClick={checkout}
            disabled={cart.length === 0 || loading}
            style={{ ...S.btnFill, width: '100%', justifyContent: 'center', opacity: cart.length === 0 ? 0.4 : 1 }}
          >
            {loading ? 'Redirecting…' : 'Checkout'}
          </button>
          <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft, textAlign: 'center', marginTop: 14 }}>
            Complimentary shipping over $50
          </p>
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
