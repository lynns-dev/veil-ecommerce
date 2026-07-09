import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import ProductVisual from '../components/ProductVisual';
import { PRODUCTS } from '../lib/products';
import { useCart } from '../lib/useCart';
import { T, S } from '../lib/theme';

export default function ShopPage() {
  const c = useCart();
  return (
    <div>
      <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} />
      <section style={{ maxWidth: T.maxw, margin: '0 auto', padding: '80px 40px 30px', textAlign: 'center' }}>
        <p style={S.label}>The collection</p>
        <h1 style={{ ...S.h2, fontSize: 'clamp(38px,5vw,60px)', marginTop: 12 }}>Shop <span style={S.it}>VEIL.</span></h1>
        <p style={{ color: T.soft, fontSize: 15, marginTop: 14 }}>A small, considered wardrobe of scent.</p>
      </section>

      <section style={{ ...S.wrap, paddingBottom: 100 }}>
        <div className="shop-grid" style={grid}>
          {PRODUCTS.map((p) => (
            <div key={p.id} style={card}>
              <Link href={`/product/${p.id}`} style={imgWrap}>
                {p.badge && <span style={badge}>{p.badge}</span>}
                <ProductVisual id={p.id} image={p.image} image2={p.image2} alt={p.name} width={p.id === 'puff' || p.id === 'ritual-set' ? 130 : 120} />
              </Link>
              <div style={cardText}>
                <Link href={`/product/${p.id}`} style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 24 }}>{p.name}</Link>
                <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, margin: '8px 0 6px' }}>{p.tagline}</div>
                <div style={{ fontSize: 13 }}>${p.price} · {p.size}</div>
                <button style={add} onClick={() => c.add(p)}>Add to cart</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CartDrawer {...c} onClose={() => c.setOpen(false)} />

      <style jsx>{`
        .shop-grid { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 680px) {
          .shop-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

const grid = { display: 'grid', border: `1px solid ${T.line}`, borderBottom: 'none' };
const card = { textAlign: 'center', borderBottom: `1px solid ${T.line}`, borderLeft: `1px solid ${T.line}` };
const badge = { position: 'absolute', top: 14, left: 14, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.soft, background: 'rgba(252,251,247,0.9)', padding: '4px 8px', zIndex: 1 };
const imgWrap = { position: 'relative', aspectRatio: '1/1', display: 'block', overflow: 'hidden', width: '100%' };
const cardText = { padding: '20px 30px 44px' };
const add = { marginTop: 18, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', border: 'none', background: 'none', borderBottom: `1px solid ${T.ink}`, padding: '0 0 5px', cursor: 'pointer', fontFamily: T.sans };
