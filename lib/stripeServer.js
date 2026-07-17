// Server-side Stripe SDK singleton. STRIPE_SECRET_KEY's own prefix
// (sk_test_ vs sk_live_) tells Stripe which mode to charge in — unlike the
// QuickBooks integration this replaces, there's no separate environment
// flag that can drift out of sync with the credentials.

import Stripe from 'stripe';

let stripeInstance = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
  if (!stripeInstance) stripeInstance = new Stripe(key);
  return stripeInstance;
}
