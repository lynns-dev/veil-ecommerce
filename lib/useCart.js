import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'veil-cart';

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setCart(JSON.parse(saved));
    } catch (e) {
      // ignore malformed/inaccessible storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      // ignore storage write failures (e.g. private browsing quota)
    }
  }, [cart, hydrated]);

  const add = useCallback((product, quantity = 1) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === product.id);
      if (found) return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i));
      return [...prev, { ...product, quantity }];
    });
    setOpen(true);
    fetch('/api/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'addtocart', productName: product.name }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const remove = useCallback((id) => setCart((prev) => prev.filter((i) => i.id !== id)), []);

  const setQty = useCallback((id, quantity) => {
    setCart((prev) =>
      quantity <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const value = { cart, open, setOpen, add, remove, setQty, clear, count, total, hydrated };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
