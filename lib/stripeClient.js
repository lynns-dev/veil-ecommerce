// Loads Stripe.js once and reuses the same promise across renders.
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY comes from the Stripe Dashboard
// (Developers > API keys) — safe to expose in the browser.

import { loadStripe } from '@stripe/stripe-js';

let stripePromise;

export function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}
