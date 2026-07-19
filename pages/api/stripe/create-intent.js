// Creates a PaymentIntent as soon as checkout is ready to show payment
// options — Payment Element needs a client_secret up front to know which
// methods are actually eligible for this amount/currency/customer.
// automatic_payment_methods lets Stripe decide based on what's actually
// enabled in the Dashboard — the simplest, most reliable option, and the
// only one confirmed to actually render something. Two more elaborate
// versions of this call (an explicit payment_method_types list, then that
// same list with a fallback to this) both regressed the payment section in
// production, for reasons not yet root-caused against the real Stripe
// account — see git history before reintroducing either. Logging
// intent.payment_method_types below so the actual eligible set is visible
// in Vercel's function logs if this needs debugging again.
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
    console.log('Stripe create-intent eligible payment_method_types:', intent.payment_method_types);

    return res.status(200).json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    console.error('Stripe create-intent error:', err);
    return res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
}
