// Loads Stripe.js once and reuses it across mounts.
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY's own prefix
// (pk_test_ vs pk_live_) determines test/live mode client-side — it must
// come from the same Stripe account/mode as STRIPE_SECRET_KEY or card
// tokenization will succeed while the server-side charge fails.

import { loadStripe } from '@stripe/stripe-js';

let stripePromise = null;

export function getStripeClient() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe can only load in the browser.'));
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.reject(new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.'));
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}
