import React from 'react';
import { CartProvider } from '../lib/useCart';

export default function App({ Component, pageProps }) {
  return (
    <CartProvider>
      <Component {...pageProps} />
    </CartProvider>
  );
}
