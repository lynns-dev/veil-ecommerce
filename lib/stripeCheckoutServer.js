import Stripe from 'stripe';
let client;
export function getCheckoutStripe() {
 const key = process.env.STRIPE_CHECKOUT_SECRET_KEY;
 if (!key) throw new Error('Stripe Checkout is not configured.');
 if (!client) client = new Stripe(key);
 return client;
}
