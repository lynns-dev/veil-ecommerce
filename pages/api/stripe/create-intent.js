// Creates a PaymentIntent as soon as checkout is ready to show payment
// options — Payment Element needs a client_secret up front to know which
// methods are actually eligible for this amount/currency/customer.
//
// Stripe has no "automatic, except these types" option — automatic_payment_
// methods is all-or-nothing, and an explicit payment_method_types list
// fails PaymentIntent creation outright if even one listed type isn't
// enabled in the Dashboard (this has already broken the whole section once
// — see git history). So this tries the curated list first (excludes
// 'card', which the QuickBooks form above handles, and 'us_bank_account'/
// ACH direct debit, which isn't offered here at all) and falls back to
// automatic_payment_methods if that fails for any reason, so a single
// not-yet-enabled method can never take out the entire section again.
//
// The tradeoff: in that fallback path, Cards or Direct debit could show up
// as extra options if they're enabled in the Dashboard, since automatic
// mode can't exclude them. For a guaranteed, code-independent way to keep
// them off regardless of which path runs, turn off "Cards" and "US bank
// account" under Settings > Payment methods in the Stripe Dashboard.
//
// Only amount is known this early — items/email/shipping aren't filled in
// yet. Those get attached later via /api/stripe/update-intent, right before
// the shopper actually submits.

import { getStripe } from '../../../lib/stripeServer';

const CURATED_PAYMENT_METHOD_TYPES = ['klarna', 'afterpay_clearpay', 'link', 'amazon_pay', 'paypal', 'cashapp'];

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

    const amountInCents = Math.round(Number(amount) * 100);
    let intent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        payment_method_types: CURATED_PAYMENT_METHOD_TYPES,
      });
    } catch (curatedErr) {
      console.error('Curated payment_method_types failed, falling back to automatic:', curatedErr.message);
      intent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
      });
    }

    return res.status(200).json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    console.error('Stripe create-intent error:', err);
    return res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
}
