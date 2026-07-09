import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import ProductVisual from '../../components/ProductVisual';
import { PRODUCTS, getProductById } from '../../lib/products';
import { useCart } from '../../lib/useCart';
import { T, S } from '../../lib/theme';

export async function getStaticPaths() {
  return { paths: PRODUCTS.map((p) => ({ params: { id: p.id } })), fallback: false };
}
export async function getStaticProps({ params }) {
  return { props: { product: getProductById(params.id) || null } };
}

export default function ProductPage({ product }) {
  const c = useCart();
  const router = useRouter();
  if (router.isFallback || !product) return null;

  return (
    <div>
      <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} />
      <section style={{ maxWidth: T.maxw, margin: '0 auto', padding: '30px 40px 90px' }}>
        <Link href="/shop" style={{ ...S.label, display: 'inline-block', marginBottom: 30 }}>← Back to shop</Link>
        <div className="pdp-grid" style={grid}>
          <div style={imgSide}><ProductVisual id={product.id} image={product.image} alt={product.name} width={230} /></div>
          <div>
            {product.badge && <span style={{ ...S.label, display: 'block', marginBottom: 14 }}>{product.badge}</span>}
            <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(34px,4.4vw,54px)', lineHeight: 1.02 }}>{product.name}</h1>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, margin: '10px 0' }}>{product.tagline}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: T.soft, marginBottom: 22 }}>
              <span style={{ color: T.ink, letterSpacing: '2px' }}>★★★★★</span> 4.9 · 2,143 reviews
            </div>
            <p style={{ fontSize: 16, color: '#4a453c', maxWidth: '46ch', marginBottom: 24 }}>{product.longDescription}</p>
            <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 30, marginBottom: 24 }}>${product.price} <span style={{ fontSize: 14, color: T.soft }}>· {product.size}</span></div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={S.btnFill} onClick={() => c.add(product)}>Add to cart</button>
              <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft }}>Free shipping over $50</span>
            </div>

            {product.notes && (
              <div style={{ marginTop: 40, borderTop: `1px solid ${T.line}` }}>
                {Object.entries(product.notes).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.soft }}>{k}</span>
                    <span style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 17 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <CartDrawer {...c} onClose={() => c.setOpen(false)} />

      <style jsx>{`
        .pdp-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 680px) {
          .pdp-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

const grid = { display: 'grid', gap: 60, alignItems: 'start' };
const imgSide = { background: T.paper, aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.line}`, overflow: 'hidden' };
