import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Header({ cartCount, onCartClick }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => router.pathname === path;

  return (
    <header style={styles.header}>
      <div style={styles.nav}>
        <Link href="/" style={styles.logoLink}>
          <h1 style={styles.logo}>VEIL</h1>
        </Link>

        <nav style={styles.navLinks}>
          <Link href="/shop" style={{ ...styles.navLink, ...(isActive('/shop') ? styles.navLinkActive : {}) }}>
            Shop
          </Link>
          <Link href="/" style={{ ...styles.navLink, ...(isActive('/') && router.pathname !== '/product' ? styles.navLinkActive : {}) }}>
            Home
          </Link>
        </nav>

        <button
          onClick={onCartClick}
          style={styles.cartButton}
          title="Open cart"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {cartCount > 0 && <span style={styles.cartBadge}>{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    backgroundColor: '#FCFBF7',
    borderBottom: '1px solid rgba(22, 20, 15, 0.08)',
    padding: '20px 40px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  nav: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoLink: {
    textDecoration: 'none',
    color: 'inherit',
  },
  logo: {
    fontFamily: '"Fraunces", serif',
    fontSize: '28px',
    fontWeight: '300',
    margin: '0',
    letterSpacing: '0.02em',
    color: '#16140F',
  },
  navLinks: {
    display: 'flex',
    gap: '40px',
  },
  navLink: {
    fontSize: '13px',
    color: '#544E46',
    textDecoration: 'none',
    letterSpacing: '0.04em',
    textTransform: 'lowercase',
    fontWeight: '400',
    transition: 'color 0.2s ease',
  },
  navLinkActive: {
    color: '#16140F',
    fontWeight: '500',
  },
  cartButton: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(22, 20, 15, 0.13)',
    padding: '10px 14px',
    cursor: 'pointer',
    borderRadius: '2px',
    color: '#16140F',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
    transition: 'border-color 0.2s ease',
  },
  cartBadge: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    backgroundColor: '#16140F',
    color: '#FCFBF7',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '600',
  },
};
