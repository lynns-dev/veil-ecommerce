# Veil embedded Stripe Checkout

Production has a dedicated restricted Checkout Sessions write key and signed checkout completion webhook. Existing Stripe refund credentials are preserved.

Stage server STRIPE_CHECKOUT_ENABLED=true with STRIPE_CHECKOUT_MODE=live and STRIPE_CHECKOUT_ORIGIN=https://veilpuff.com, keeping NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED=false and STRIPE_ONLY_ENABLED=false. Verify the unpaid embedded payment form mounts in the existing checkout and signature rejection, with no charge.

After readiness verification, activate NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED=true (Stripe-only UI) and STRIPE_ONLY_ENABLED=true (block new legacy payment initiation), then redeploy. Main checkout and offer3 retain shipping, discount, product choices; backup payment pages redirect to main. Legacy paid-payment reconciliation/refunds remain. No new payment may use a test-mode Session in live mode.

Publishable key: NEXT_PUBLIC_STRIPE_CHECKOUT_PUBLISHABLE_KEY must belong to the same account and mode as the dedicated secret. The embedded form keeps payment on-site; no hosted checkout redirect is used.

Secrets: STRIPE_CHECKOUT_SECRET_KEY and STRIPE_CHECKOUT_WEBHOOK_SECRET, production-only secret values. Endpoint /api/stripe/webhook listens to checkout.session.completed and checkout.session.async_payment_succeeded.

Tests: npm run build, node tests/stripe-checkout.mjs. A successful real payment has not been performed by this implementation task.
