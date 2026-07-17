// Creates a PaymentIntent as soon as checkout is ready to show payment
// options — Payment Element needs a client_secret up front to know which
// methods (card, Afterpay, Amazon Pay, Apple Pay, Link, ...) are actually
// eligible for this amount/currency/customer. automatic_payment_methods
// lets Stripe decide which of those to show based on what's enabled in the
// Dashboard, rather than us hardcoding a method list here.
//
// Only amount is known this early — items/email/shipping aren't filled in
// yet. Those get attached later via /api/stripe/update-intent, right before
// the shopper actually submits.

import { getStripe } from '../../../lib/stripeServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    const { amount } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    console.error('Stripe create-intent error:', err);
    return res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
}
