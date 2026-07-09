import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { T } from '../lib/theme';

export default function Header({ cartCount = 0, onCartClick }) {
  const router = useRouter();
  const active = (p) => router.pathname === p;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header style={styles.header}>
      <div style={styles.nav}>
        <div style={styles.side}>
          <div className="desktop-links" style={styles.desktopLinks}>
            <Link href="/shop" style={{ ...styles.navLink, opacity: active('/shop') ? 1 : 0.7 }}>Shop</Link>
            <a href="/#notes" style={styles.navLink}>Scent</a>
          </div>
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen((o) => !o)}
            style={styles.hamburgerBtn}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <span style={styles.hamburgerLine} />
            <span style={styles.hamburgerLine} />
            <span style={styles.hamburgerLine} />
          </button>
        </div>
        <Link href="/" style={styles.logoLink}><span style={styles.logo}>VEIL</span></Link>
        <div style={{ ...styles.side, justifyContent: 'flex-end' }}>
          <a href="/#reviews" className="reviews-link" style={styles.navLink}>Reviews</a>
          <button onClick={onCartClick} style={styles.cartBtn} aria-label="Open cart">
            Cart{cartCount > 0 ? ` (${cartCount})` : ''}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu" style={styles.mobileMenu}>
          <Link href="/shop" onClick={closeMenu} style={styles.mobileMenuLink}>Shop</Link>
          <a href="/#notes" onClick={closeMenu} style={styles.mobileMenuLink}>Scent</a>
          <a href="/#reviews" onClick={closeMenu} style={styles.mobileMenuLink}>Reviews</a>
        </div>
      )}

      <style jsx>{`
        .desktop-links { display: flex; }
        .hamburger-btn { display: none; }
        @media (max-width: 680px) {
          .desktop-links { display: none; }
          .hamburger-btn { display: flex; }
          .reviews-link { display: none; }
        }
      `}</style>
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
    maxWidth: T.maxw, margin: '0 auto', padding: '14px 40px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  side: { display: 'flex', gap: 30, flex: 1, alignItems: 'center' },
  desktopLinks: { gap: 30, alignItems: 'center' },
  navLink: {
    fontFamily: T.sans, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: T.ink,
  },
  hamburgerBtn: {
    flexDirection: 'column', justifyContent: 'center', gap: 5,
    width: 22, height: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  },
  hamburgerLine: { display: 'block', width: '100%', height: 1, background: T.ink },
  cartBtn: {
    fontFamily: T.sans, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: T.ink, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  },
  logoLink: { flex: '0 0 auto' },
  logo: {
    fontFamily: T.serif, fontWeight: 400, fontSize: 26,
    letterSpacing: '0.5em', paddingLeft: '0.5em',
  },
  mobileMenu: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: T.white, borderBottom: `1px solid ${T.line}`,
    display: 'flex', flexDirection: 'column', padding: '20px 40px', gap: 20,
  },
  mobileMenuLink: {
    fontFamily: T.sans, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.ink,
  },
};
