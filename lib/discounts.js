// Checkout discount codes. Add or edit entries here, same workflow as
// lib/products.js — codes aren't secret, so validation happens client-side
// in pages/checkout.jsx rather than through an API route.
// type: 'percent' (value = percent off) or 'fixed' (value = dollars off).

export const DISCOUNTS = [
  { code: 'WELCOME10', type: 'percent', value: 10 },
  { code: 'VEIL5', type: 'fixed', value: 5 },
];
