import React from 'react';
import Link from 'next/link';
import Seo from '../components/Seo';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import Footer from '../components/Footer';
import { useCart } from '../lib/useCart';
import { T, S } from '../lib/theme';

export default function NotFoundPage() {
  const c = useCart();
  return (
    <div>
      <Seo title="Page not found" path="/404" noindex />
      <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} />
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
        <p style={S.label}>Page not found</p>
        <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(34px,4.6vw,52px)', margin: '16px 0 20px' }}>This page has slipped away. <span style={S.it}>Your scent hasn’t.</span></h1>
        <Link href="/#scents" style={S.btnFill}>Find your scent</Link>
      </section>
      <Footer />
      <CartDrawer {...c} onClose={() => c.setOpen(false)} />
    </div>
  );
}
