import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import ProductVisual from '../components/ProductVisual';
import Marquee from '../components/Marquee';
import Footer from '../components/Footer';
import { PRODUCTS } from '../lib/products';
import { useCart } from '../lib/useCart';
import { T, S } from '../lib/theme';

export default function ShopPage() {
  const c = useCart();
  return (
    <div>
      <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} />

      {/* BANNER */}
      <section style={banner}>
        <div style={bannerOverlay} />
        <div style={{ ...S.wrap, position: 'relative', textAlign: 'center' }}>
          <p style={{ ...S.label, color: 'rgba(252,251,247,0.75)' }}>The collection</p>
          <h1 style={{ ...S.h2, color: T.white, fontSize: 'clamp(38px,5.6vw,64px)', marginTop: 14 }}>
            Shop <span style={S.it}>VEIL.</span>
          </h1>
          <p style={{ color: 'rgba(252,251,247,0.82)', fontSize: 15, marginTop: 14, maxWidth: '46ch', marginLeft: 'auto', marginRight: 'auto' }}>
            A small, considered wardrobe of scent — featherlight powders, pressed into skin instead of sprayed into the air.
          </p>
        </div>
      </section>

      <section style={{ ...S.wrap, padding: '80px 0 100px' }}>
        <div className="shop-grid" style={grid}>
          {PRODUCTS.filter((p) => p.id !== 'scent-trio').map((p) => (
            <div key={p.id} style={card}>
              <Link href={`/product/${p.id}`} style={imgWrap}>
                {p.badge && <span style={badge}>{p.badge}</span>}
                <ProductVisual id={p.id} image={p.image} image2={p.image2} alt={p.name} width={p.id === 'puff' || p.id === 'ritual-set' ? 130 : 120} />
              </Link>
              <div style={cardText}>
                <Link href={`/product/${p.id}`} style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 22 }}>{p.name}</Link>
                <div style={ratingRow}>
                  <span style={{ letterSpacing: '1.5px', color: T.ink }}>★★★★★</span> 4.9 (2,143)
                </div>
                <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, margin: '8px 0 10px' }}>{p.tagline}</div>
                <div style={{ fontSize: 13, marginBottom: 14 }}>${p.price} · {p.size}</div>
                <button style={{ ...S.btnFill, width: '100%', justifyContent: 'center' }} onClick={() => c.add(p)}>Add to cart</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Marquee />
      <Footer />

      <CartDrawer {...c} onClose={() => c.setOpen(false)} />

      <style jsx>{`
        .shop-grid { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 960px) {
          .shop-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .shop-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

const banner = {
  position: 'relative', minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundImage: 'url(/images/veil-model-one.png)', backgroundSize: 'cover', backgroundPosition: 'center 25%',
};
const bannerOverlay = { position: 'absolute', inset: 0, background: 'rgba(22,20,15,0.55)' };
const grid = { display: 'grid', gap: 40 };
const card = { textAlign: 'center' };
const badge = { position: 'absolute', top: 14, right: 14, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.ink, background: 'rgba(252,251,247,0.92)', padding: '6px 10px', zIndex: 1 };
const imgWrap = { position: 'relative', aspectRatio: '1/1', display: 'block', overflow: 'hidden', width: '100%' };
const cardText = { padding: '20px 6px 0' };
const ratingRow = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: T.soft, marginTop: 8, fontFamily: T.sans };
