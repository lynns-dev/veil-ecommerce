// Creates a PaymentIntent as soon as checkout is ready to show payment
// options — Payment Element needs a client_secret up front to know which
// methods are actually eligible for this amount/currency/customer.
// automatic_payment_methods lets Stripe decide based on what's actually
// enabled in the Dashboard, silently skipping anything that isn't —
// unlike an explicit payment_method_types list, this can't fail outright
// just because one method (Klarna, Afterpay, Amazon Pay, ...) hasn't been
// turned on yet. A previous version of this file passed an explicit list
// excluding 'card' (since checkout.jsx has its own QuickBooks card form),
// but that meant the *entire* PaymentIntent creation — and with it every
// non-card method — failed the moment any single listed type wasn't
// enabled, which is exactly what happened here. If 'card' ends up enabled
// too and shows up as a redundant option in the Payment Element below the
// QuickBooks form, turn it off in the Stripe Dashboard (Settings > Payment
// methods > Cards) rather than hardcoding an exclusion list here again.
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
