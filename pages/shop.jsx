import React, { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { PRODUCTS } from '../lib/products';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function ShopPage() {
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });

      const { sessionId } = await response.json();
      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error('Redirect error:', error);
        alert('Checkout failed. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <Header cartCount={cart.length} onCartClick={() => setShowCart(!showCart)} />

      <section style={styles.header}>
        <h1 style={styles.title}>The collection</h1>
        <div style={styles.divider}></div>
        <p style={styles.subtitle}>Explore our curated selection of fragrance powders and accessories</p>
      </section>

      <div style={styles.mainWrapper}>
        <main style={styles.main}>
          <div style={styles.productGrid}>
            {PRODUCTS.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`} style={{ textDecoration: 'none' }}>
                <article style={styles.productCard}>
                  <div style={styles.productImage}>
                    <img
                      src={product.image}
                      alt={product.name}
                      style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }}
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/320?text=' + product.name;
                      }}
                    />
                  </div>
                  <div style={styles.productInfo}>
                    <h3 style={styles.productName}>{product.name}</h3>
                    <p style={styles.productPrice}>${product.price}</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </main>

        {/* Cart Sidebar */}
        {showCart && (
          <aside style={styles.cartSidebar}>
            <div style={styles.cartHeader}>
              <h2 style={styles.cartTitle}>Your cart</h2>
              <button onClick={() => setShowCart(false)} style={styles.closeCart}>✕</button>
            </div>
            <div style={styles.sidebarDivider}></div>

            {cart.length === 0 ? (
              <p style={styles.emptyCart}>Your cart is empty</p>
            ) : (
              <>
                <div style={styles.cartItems}>
                  {cart.map((item) => (
                    <div key={item.id} style={styles.cartItem}>
                      <div style={styles.cartItemInfo}>
                        <p style={styles.cartItemName}>{item.name}</p>
                        <p style={styles.cartItemMeta}>${item.price} × {item.quantity}</p>
                      </div>
                      <div style={styles.cartItemControls}>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          style={styles.quantityButton}
                        >
                          −
                        </button>
                        <span style={styles.quantity}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          style={styles.quantityButton}
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={styles.removeButton}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.cartSummary}>
                  <div style={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    style={styles.checkoutButton}
                  >
                    {loading ? 'Processing...' : 'Checkout'}
                  </button>
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      <footer style={styles.footer}>
        <p style={styles.footerText}>Complimentary shipping over $50 · Powered by Stripe</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#FCFBF7',
    color: '#16140F',
    fontFamily: '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '60px 40px 40px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(22, 20, 15, 0.08)',
  },
  title: {
    fontFamily: '"Fraunces", serif',
    fontSize: '48px',
    fontWeight: '300',
    margin: '0 0 16px 0',
  },
  divider: {
    width: '40px',
    height: '1px',
    backgroundColor: 'rgba(22, 20, 15, 0.13)',
    margin: '0 auto 20px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8A7E6E',
    margin: '0',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    padding: '60px 40px',
    gap: '60px',
  },
  main: {
    flex: 1,
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '40px',
  },
  productCard: {
    cursor: 'pointer',
  },
  productImage: {
    width: '100%',
    height: '320px',
    backgroundColor: '#EFEAE1',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  productInfo: {
    textAlign: 'center',
  },
  productName: {
    fontFamily: '"Fraunces", serif',
    fontSize: '16px',
    fontWeight: '300',
    margin: '0 0 8px 0',
    color: '#16140F',
  },
  productPrice: {
    fontSize: '14px',
    color: '#8A7E6E',
    margin: '0',
  },
  cartSidebar: {
    width: '320px',
    backgroundColor: '#FBF8F2',
    padding: '32px 28px',
    borderRadius: '2px',
    height: 'fit-content',
    position: 'sticky',
    top: '100px',
    border: '1px solid rgba(22, 20, 15, 0.08)',
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartTitle: {
    fontFamily: '"Fraunces", serif',
    fontSize: '18px',
    fontWeight: '300',
    margin: '0',
    color: '#16140F',
  },
  closeCart: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#16140F',
    padding: '0',
  },
  sidebarDivider: {
    width: '100%',
    height: '1px',
    backgroundColor: 'rgba(22, 20, 15, 0.08)',
    margin: '16px 0 20px 0',
  },
  emptyCart: {
    color: '#8A7E6E',
    fontSize: '13px',
    textAlign: 'center',
    padding: '40px 0',
  },
  cartItems: {
    marginBottom: '28px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: '16px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(22, 20, 15, 0.08)',
  },
  cartItemInfo: {
    flex: 1,
    marginRight: '12px',
  },
  cartItemName: {
    fontFamily: '"Fraunces", serif',
    margin: '0',
    fontWeight: '300',
    color: '#16140F',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  cartItemMeta: {
    margin: '8px 0 0 0',
    color: '#8A7E6E',
    fontSize: '12px',
  },
  cartItemControls: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  quantityButton: {
    width: '28px',
    height: '28px',
    border: '1px solid rgba(22, 20, 15, 0.13)',
    backgroundColor: 'transparent',
    color: '#16140F',
    cursor: 'pointer',
    borderRadius: '2px',
    fontSize: '13px',
  },
  quantity: {
    width: '28px',
    textAlign: 'center',
    fontSize: '12px',
  },
  removeButton: {
    width: '28px',
    height: '28px',
    border: '1px solid rgba(22, 20, 15, 0.13)',
    backgroundColor: 'transparent',
    color: '#16140F',
    cursor: 'pointer',
    fontSize: '12px',
    borderRadius: '2px',
  },
  cartSummary: {
    paddingTop: '20px',
    borderTop: '1px solid rgba(22, 20, 15, 0.08)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    fontSize: '13px',
  },
  checkoutButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#16140F',
    color: '#FCFBF7',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    letterSpacing: '0.04em',
    textTransform: 'lowercase',
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
