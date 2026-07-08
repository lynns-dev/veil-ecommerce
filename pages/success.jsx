import React from 'react';
import Link from 'next/link';

export default function Success() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.wordmark}>VEIL</h1>
      </header>

      <main style={styles.content}>
        <div style={styles.divider}></div>
        <h1 style={styles.title}>Thank you</h1>
        <p style={styles.message}>Your order has been confirmed.</p>
        <p style={styles.subtitle}>You'll receive an email confirmation shortly with your order details and tracking information.</p>
        <div style={styles.divider}></div>

        <Link href="/" style={styles.linkStyle}>
          <button style={styles.button}>Continue shopping</button>
        </Link>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerText}>Powered by Stripe</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#FCFBF7',
    color: '#16140F',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '60px 40px 40px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(22, 20, 15, 0.08)',
  },
  wordmark: {
    fontFamily: '"Fraunces", serif',
    fontSize: '48px',
    fontWeight: '300',
    margin: '0',
    letterSpacing: '0.02em',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 40px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  divider: {
    width: '40px',
    height: '1px',
    backgroundColor: 'rgba(22, 20, 15, 0.13)',
    margin: '0 0 40px 0',
  },
  title: {
    fontFamily: '"Fraunces", serif',
    fontSize: '48px',
    fontWeight: '300',
    margin: '0 0 20px 0',
    textAlign: 'center',
  },
  message: {
    fontSize: '16px',
    margin: '0 0 12px 0',
    color: '#544E46',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8A7E6E',
    margin: '0 0 40px 0',
    lineHeight: '1.6',
    textAlign: 'center',
  },
  linkStyle: {
    textDecoration: 'none',
  },
  button: {
    padding: '14px 32px',
    backgroundColor: '#16140F',
    color: '#FCFBF7',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    letterSpacing: '0.04em',
    textTransform: 'lowercase',
    transition: 'background-color 0.2s ease',
  },
  footer: {
    backgroundColor: '#16140F',
    color: '#EFEAE1',
    padding: '40px',
    textAlign: 'center',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  footerText: {
    fontSize: '12px',
    margin: '0',
    letterSpacing: '0.04em',
  },
};
