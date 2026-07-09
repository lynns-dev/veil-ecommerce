import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Marquee from '../components/Marquee';
import Footer from '../components/Footer';
import { T, S } from '../lib/theme';

export default function SuccessPage() {
  return (
    <div>
      <Header cartCount={0} onCartClick={() => {}} />
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '120px 40px', textAlign: 'center' }}>
        <p style={S.label}>Thank you</p>
        <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(38px,5vw,60px)', margin: '16px 0 20px' }}>Your ritual is <span style={S.it}>on its way.</span></h1>
        <p style={{ color: T.soft, fontSize: 16, marginBottom: 34 }}>We’ve received your order and sent a confirmation to your email. Complimentary shipping is on us.</p>
        <Link href="/" style={S.btnOutline}>Return home</Link>
      </section>
      <Marquee />
      <Footer />
    </div>
  );
}
