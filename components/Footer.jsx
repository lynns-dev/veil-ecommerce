import React from 'react';
import Link from 'next/link';
import { T, S } from '../lib/theme';

export default function Footer() {
  return (
    <footer style={footer}>
      <div style={{ ...S.wrap, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 18 }}>
        <span style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 22 }}>VEIL</span>
        <div style={{ display: 'flex', gap: 24, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft }}>
          <Link href="/shop">Shop</Link>
          <Link href="/#notes">Scent</Link>
          <Link href="/#reviews">Reviews</Link>
        </div>
        <small style={{ width: '100%', color: T.soft, fontSize: 11, marginTop: 12 }}>
          Poudre de corps parfumée · Concept build — product visuals are illustrative; ratings &amp; reviews are placeholders.
        </small>
      </div>
    </footer>
  );
}

const footer = { borderTop: `1px solid ${T.line}`, padding: '36px 0' };
