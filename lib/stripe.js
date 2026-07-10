// Server-side Stripe client. STRIPE_SECRET_KEY comes from the Stripe
// Dashboard (Developers > API keys) — test mode key while building,
// live mode key once ready to take real charges.

import Stripe from 'stripe';

let stripe = null;

export function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set.');
    }
    stripe = new Stripe(key);
  }
  return stripe;
}
