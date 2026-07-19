// Creates a PaymentIntent as soon as checkout is ready to show payment
// options — Payment Element needs a client_secret up front to know which
// methods are actually eligible for this amount/currency/customer.
//
// 'card' is deliberately excluded: checkout.jsx has its own QuickBooks card
// form for that, so Stripe here only needs to cover everything else
// (Klarna, Afterpay, Link, Amazon Pay, PayPal, Cash App Pay, ...). That
// means this can't use automatic_payment_methods (all-or-nothing — no way
// to exclude just one type) and has to list payment_method_types
// explicitly instead. The tradeoff: every type listed here must actually
// be enabled in the Stripe Dashboard (Settings > Payment methods) or this
// call fails outright, instead of automatic_payment_methods' graceful
// per-method skip — trim this list to match whatever's actually turned on.
//
// Only amount is known this early — items/email/shipping aren't filled in
// yet. Those get attached later via /api/stripe/update-intent, right before
// the shopper actually submits.

import { getStripe } from '../../../lib/stripeServer';

const NON_CARD_PAYMENT_METHOD_TYPES = ['klarna', 'afterpay_clearpay', 'link', 'amazon_pay', 'paypal', 'cashapp'];

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
      payment_method_types: NON_CARD_PAYMENT_METHOD_TYPES,
    });

    return res.status(200).json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    console.error('Stripe create-intent error:', err);
    return res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
}
