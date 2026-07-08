import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Header from '../../components/Header';
import { PRODUCTS, getProductById } from '../../lib/products';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function ProductPage() {
  const router = useRouter();
  const { id } = router.query;
  const product = id ? getProductById(id) : null;
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <div style={styles.container}>
        <Header cartCount={cart.length} onCartClick={() => setShowCart(!showCart)} />
        <p style={styles.loading}>Loading product...</p>
      </div>
    );
  }

  const addToCart = () => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prevCart, { ...product, quantity }];
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, qty) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

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

      <div style={styles.mainWrapper}>
        <main style={styles.main}>
          <Link href="/shop" style={styles.backLink}>
            ← Back to shop
          </Link>

          <div style={styles.productContainer}>
            <div style={styles.imageSection}>
              <img
                src={product.image}
                alt={product.name}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/500?text=' + product.name;
                }}
              />
            </div>

            <div style={styles.contentSection}>
              <div style={styles.divider}></div>
              <h1 style={styles.productTitle}>{product.name}</h1>
              <p style={styles.price}>${product.price}</p>
              <p style={styles.description}>{product.longDescription}</p>

              <div style={styles.quantityControl}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={styles.quantityButton}
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.quantityInput}
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  style={styles.quantityButton}
                >
                  +
                </button>
              </div>

              <button onClick={addToCart} style={styles.addButton}>
                {added ? 'Added to cart' : 'Add to cart'}
              </button>

              {product.notes && (
                <div style={styles.notesSection}>
                  <div style={styles.divider}></div>
                  <h3 style={styles.notesTitle}>Scent notes</h3>
                  <div style={styles.notesGrid}>
                    <div style={styles.noteColumn}>
                      <p style={styles.noteLabel}>Top</p>
                      <p style={styles.noteText}>{product.notes.top}</p>
                    </div>
                    <div style={styles.noteColumn}>
                      <p style={styles.noteLabel}>Middle</p>
                      <p style={styles.noteText}>{product.notes.middle}</p>
                    </div>
                    <div style={styles.noteColumn}>
                      <p style={styles.noteLabel}>Base</p>
                      <p style={styles.noteText}>{product.notes.base}</p>
                    </div>
                  </div>
                </div>
              )}

              <div style={styles.wearSection}>
                <div style={styles.divider}></div>
                <h3 style={styles.wearTitle}>Wear</h3>
                <p style={styles.wearText}>{product.wear}</p>
                <p style={styles.wearText}>{product.finish}</p>
              </div>
            </div>
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
                          style={styles.quantityBtn}
                        >
                          −
                        </button>
                        <span style={styles.cartQuantity}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          style={styles.quantityBtn}
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={styles.removeBtn}
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
                    <span>${cartTotal.toFixed(2)}</span>
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
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
  backLink: {
    fontSize: '12px',
    color: '#8A7E6E',
    textDecoration: 'none',
    marginBottom: '40px',
    display: 'inline-block',
  },
  productContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '60px',
  },
  imageSection: {
    width: '100%',
  },
  contentSection: {
    paddingTop: '40px',
  },
  divider: {
    width: '40px',
    height: '1px',
    backgroundColor: 'rgba(22, 20, 15, 0.13)',
    marginBottom: '24px',
  },
  productTitle: {
    fontFamily: '"Fraunces", serif',
    fontSize: '44px',
    fontWeight: '300',
    margin: '0 0 16px 0',
    color: '#16140F',
  },
  price: {
    fontFamily: '"Fraunces", serif',
    fontSize: '24px',
    fontWeight: '400',
    margin: '0 0 28px 0',
    color: '#16140F',
  },
  description: {
    fontSize: '14px',
    color: '#544E46',
    lineHeight: '1.7',
    margin: '0 0 32px 0',
  },
  quantityControl: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '32px',
  },
  quantityButton: {
    width: '36px',
    height: '36px',
    border: '1px solid rgba(22, 20, 15, 0.13)',
    backgroundColor: 'transparent',
    color: '#16140F',
    cursor: 'pointer',
    borderRadius: '2px',
    fontSize: '16px',
  },
  quantityInput: {
    width: '60px',
    padding: '8px',
    border: '1px solid rgba(22, 20, 15, 0.13)',
    borderRadius: '2px',
    fontSize: '14px',
    textAlign: 'center',
    color: '#16140F',
  },
  addButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#16140F',
    color: '#FCFBF7',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    letterSpacing: '0.04em',
    textTransform: 'lowercase',
    marginBottom: '40px',
  },
  notesSection: {
    paddingTop: '40px',
  },
  notesTitle: {
    fontFamily: '"Fraunces", serif',
    fontSize: '16px',
    fontWeight: '300',
    margin: '0 0 24px 0',
    color: '#16140F',
  },
  notesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '24px',
  },
  noteColumn: {
    paddingRight: '16px',
  },
  noteLabel: {
    fontSize: '11px',
    color: '#8A7E6E',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: '0 0 8px 0',
  },
  noteText: {
    fontSize: '13px',
    color: '#544E46',
    lineHeight: '1.6',
    margin: '0',
  },
  wearSection: {
    paddingTop: '40px',
  },
  wearTitle: {
    fontFamily: '"Fraunces", serif',
    fontSize: '16px',
    fontWeight: '300',
    margin: '0 0 12px 0',
    color: '#16140F',
  },
  wearText: {
    fontSize: '13px',
    color: '#544E46',
    lineHeight: '1.6',
    margin: '0 0 8px 0',
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
  quantityBtn: {
    width: '24px',
    height: '24px',
    border: '1px solid rgba(22, 20, 15, 0.13)',
    backgroundColor: 'transparent',
    color: '#16140F',
    cursor: 'pointer',
    borderRadius: '2px',
    fontSize: '12px',
    padding: '0',
  },
  cartQuantity: {
    width: '24px',
    textAlign: 'center',
    fontSize: '12px',
  },
  removeBtn: {
    width: '24px',
    height: '24px',
    border: '1px solid rgba(22, 20, 15, 0.13)',
    backgroundColor: 'transparent',
    color: '#16140F',
    cursor: 'pointer',
    fontSize: '12px',
    borderRadius: '2px',
    padding: '0',
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
  loading: {
    textAlign: 'center',
    padding: '60px 40px',
    color: '#8A7E6E',
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
