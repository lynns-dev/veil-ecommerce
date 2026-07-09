import React, { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { PRODUCTS, getFeaturedProducts } from '../lib/products';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function HomePage() {
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const featured = getFeaturedProducts();

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

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

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h2 style={styles.heroHeading}>Wear it <em style={{ fontStyle: 'italic' }}>for yourself</em> first.</h2>
          <p style={styles.heroSubtitle}>A featherlight perfume powder that melts into skin with a soft-focus finish — and a veil of scent noticed only by those who lean in close.</p>
          <Link href="/shop">
            <button style={styles.heroButton}>Shop the collection</button>
          </Link>
        </div>
        <div style={styles.heroDivider}></div>
      </section>

      {/* Main Content with Cart Sidebar */}
      <div style={styles.mainWrapper}>
        <main style={styles.main}>
          {/* Why VEIL Section */}
          <section style={styles.whySection}>
            <div style={styles.whyContent}>
              <h3 style={styles.sectionTitle}>Why VEIL</h3>
              <div style={styles.whyDivider}></div>
              <p style={styles.whyText}>Perfume, <em style={{ fontStyle: 'italic' }}>reimagined</em> as a ritual.</p>
              <p style={styles.whyDescription}>VEIL is a modern take on fragrance: a weightless powder infused with scent, designed to be applied directly to the skin. One jar equals the wear of a full perfume bottle — without the projection, without the heaviness, without the price.</p>
            </div>
          </section>

          {/* Featured Products */}
          <section style={styles.featuredSection}>
            <h3 style={styles.sectionTitle}>The collection</h3>
            <div style={styles.whyDivider}></div>
            <div style={styles.productGrid}>
              {featured.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`} style={{ textDecoration: 'none' }}>
                  <article style={styles.productCard}>
                    <div style={styles.productImage}>
                      <img
                        src={product.image}
                        alt={product.name}
                        style={{ width: '100%', height: '280px', objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/280?text=' + product.name;
                        }}
                      />
                    </div>
                    <div style={styles.productInfo}>
                      <h4 style={styles.productName}>{product.name}</h4>
                      <p style={styles.productPrice}>${product.price}</p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
            <div style={styles.viewAllContainer}>
              <Link href="/shop">
                <button style={styles.viewAllButton}>View all products</button>
              </Link>
            </div>
          </section>

          {/* Value Proposition */}
          <section style={styles.valueSection}>
            <h3 style={styles.sectionTitle}>The honest math</h3>
            <div style={styles.whyDivider}></div>
            <div style={styles.comparisonTable}>
              <div style={styles.comparisonRow}>
                <div style={styles.comparisonCol}>
                  <p style={styles.comparisonLabel}>Luxury perfume</p>
                  <p style={styles.comparisonPrice}>$150–300</p>
                  <ul style={styles.comparisonList}>
                    <li>One bottle</li>
                    <li>Scents you and the whole room</li>
                    <li>Fades by afternoon</li>
                    <li>Sits on top of the skin</li>
                  </ul>
                </div>
                <div style={styles.comparisonCol}>
                  <p style={styles.comparisonLabel}>One jar of VEIL</p>
                  <p style={styles.comparisonPrice}>$45</p>
                  <ul style={styles.comparisonList}>
                    <li>The wear of a full bottle</li>
                    <li>Intimate, close-to-skin</li>
                    <li>Pressed in — holds all day</li>
                    <li>Melts in, soft-focus finish</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
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

      {/* Footer */}
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
  hero: {
    padding: '80px 40px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(22, 20, 15, 0.08)',
  },
  heroContent: {
    maxWidth: '800px',
    margin: '0 auto 40px',
  },
  heroHeading: {
    fontFamily: '"Fraunces", serif',
    fontSize: '56px',
    fontWeight: '300',
    margin: '0 0 20px 0',
    lineHeight: '1.2',
  },
  heroSubtitle: {
    fontSize: '16px',
    color: '#544E46',
    margin: '0 0 40px 0',
    lineHeight: '1.6',
  },
  heroButton: {
    padding: '14px 40px',
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
  heroDivider: {
    width: '40px',
    height: '1px',
    backgroundColor: 'rgba(22, 20, 15, 0.13)',
    margin: '0 auto',
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
  whySection: {
    marginBottom: '80px',
  },
  sectionTitle: {
    fontFamily: '"Fraunces", serif',
    fontSize: '32px',
    fontWeight: '300',
    margin: '0 0 16px 0',
  },
  whyDivider: {
    width: '40px',
    height: '1px',
    backgroundColor: 'rgba(22, 20, 15, 0.13)',
    marginBottom: '24px',
  },
  whyText: {
    fontFamily: '"Fraunces", serif',
    fontSize: '24px',
    fontWeight: '300',
    margin: '0 0 20px 0',
    color: '#16140F',
  },
  whyDescription: {
    fontSize: '14px',
    color: '#544E46',
    lineHeight: '1.7',
    margin: '0',
  },
  featuredSection: {
    marginBottom: '80px',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '40px',
    marginBottom: '40px',
  },
  productCard: {
    cursor: 'pointer',
  },
  productImage: {
    width: '100%',
    height: '280px',
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
  viewAllContainer: {
    textAlign: 'center',
  },
  viewAllButton: {
    padding: '14px 40px',
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
  valueSection: {
    marginBottom: '80px',
  },
  comparisonTable: {
    marginTop: '40px',
  },
  comparisonRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '60px',
  },
  comparisonCol: {
    padding: '28px',
    backgroundColor: '#FBF8F2',
    borderRadius: '2px',
  },
  comparisonLabel: {
    fontFamily: '"Fraunces", serif',
    fontSize: '16px',
    fontWeight: '300',
    margin: '0 0 8px 0',
    color: '#16140F',
  },
  comparisonPrice: {
    fontFamily: '"Fraunces", serif',
    fontSize: '20px',
    fontWeight: '400',
    margin: '0 0 20px 0',
    color: '#16140F',
  },
  comparisonList: {
    fontSize: '13px',
    color: '#544E46',
    margin: '0',
    paddingLeft: '20px',
    lineHeight: '1.8',
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
