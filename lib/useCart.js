import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export function useCart() {
  const [cart, setCart] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const add = useCallback((product, quantity = 1) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === product.id);
      if (found) return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i));
      return [...prev, { ...product, quantity }];
    });
    setOpen(true);
  }, []);

  const remove = useCallback((id) => setCart((prev) => prev.filter((i) => i.id !== id)), []);

  const setQty = useCallback((id, quantity) => {
    setCart((prev) =>
      quantity <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  }, []);

  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const checkout = useCallback(async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });
      const { sessionId, error: apiError } = await res.json();
      if (apiError) throw new Error(apiError);
      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw error;
    } catch (e) {
      console.error('Checkout error:', e);
      alert('Checkout is not configured yet. Add your Stripe keys in Vercel to enable it.');
    } finally {
      setLoading(false);
    }
  }, [cart]);

  return { cart, open, setOpen, loading, add, remove, setQty, count, total, checkout };
}
