import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T } from '../lib/theme';

export default function Header({ cartCount = 0, onCartClick }) {
  const router = useRouter();
  const active = (p) => router.pathname === p;
  return (
    <header style={styles.header}>
      <div style={styles.nav}>
        <div style={styles.side}>
          <Link href="/shop" style={{ ...styles.navLink, opacity: active('/shop') ? 1 : 0.7 }}>Shop</Link>
          <a href="/#notes" style={styles.navLink}>Scent</a>
        </div>
        <Link href="/" style={styles.logoLink}><span style={styles.logo}>VEIL</span></Link>
        <div style={{ ...styles.side, justifyContent: 'flex-end' }}>
          <a href="/#reviews" style={styles.navLink}>Reviews</a>
          <button onClick={onCartClick} style={styles.cartBtn} aria-label="Open cart">
            Cart{cartCount > 0 ? ` (${cartCount})` : ''}
          </button>
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(252,251,247,0.9)', backdropFilter: 'blur(10px)',
    borderBottom: `1px solid ${T.line}`,
  },
  nav: {
    maxWidth: T.maxw, margin: '0 auto', padding: '24px 40px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  side: { display: 'flex', gap: 30, flex: 1, alignItems: 'center' },
  navLink: {
    fontFamily: T.sans, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: T.ink,
  },
  cartBtn: {
    fontFamily: T.sans, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: T.ink, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  },
  logoLink: { flex: '0 0 auto' },
  logo: {
    fontFamily: T.serif, fontWeight: 400, fontSize: 26,
    letterSpacing: '0.5em', paddingLeft: '0.5em',
  },
};
