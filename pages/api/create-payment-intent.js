// Creates a Stripe PaymentIntent for the cart total. The client confirms
// this PaymentIntent using Stripe Elements — card details go straight from
// the browser to Stripe, never touching our server.

import { getStripe } from '../../lib/stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, items, email } = req.body;

    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in cart' });

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100), // Stripe uses cents
      currency: 'usd',
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
      metadata: {
        items: items.map((i) => `${i.name} x${i.quantity}`).join(', ').slice(0, 500),
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe PaymentIntent error:', error);
    return res.status(500).json({ error: error.message });
  }
}
