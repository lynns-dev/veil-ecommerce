# Veil cart conversion test drafts

These three tests are implemented but inactive (`status: 'draft'`). No production deployment, setting change, sale activation, email, or message is part of this change. Existing tests remain unchanged. Drafts never randomly assign visitors and are excluded from client and server tracking. URL overrides preview a draft only for that page load and do not persist it.

## Variants

| Priority / test ID | A | B | Eligibility |
| --- | --- | --- | --- |
| 1 / cart_shipping_clarity_v1 | Existing shipping note and merchandise total | Explicit existing shipping charge + estimated total including shipping; taxes caveat | Open, nonempty cart |
| 2 / cart_checkout_cta_v1 | Checkout | Continue to secure checkout | Open, nonempty cart |
| 3 / cart_discount_confirmation_v1 | Existing savings row and discount feedback | Additional applied-code confirmation immediately above checkout, showing actual code savings | Open cart with valid applied code and positive code discount, in both arms |

No price, free-shipping threshold, discount validity, payment method, or charge calculation changes. Shipping uses `shippingFor(total)` and total uses the existing `grandTotal`.

## Review previews

On a local or branch preview, add one query string to a storefront page, add an item, and open the cart:

- `?exp_cart_shipping_clarity_v1=shipping`
- `?exp_cart_checkout_cta_v1=secure`
- `?exp_cart_discount_confirmation_v1=confirmation` (requires a real valid code; do not create a production promotion for testing)

Replace the treatment value with `control` to compare A. Remove the query and reload to restore the draft's control. Existing live experiments can be held constant with `&exp_cart_trust=control`; use a disposable local browser profile to avoid persisting changes to existing assignments.

## Test protocol before activation

Run one new test at a time, freeze other changes on that surface, and review overlap with the existing cart_trust experiment. Record baseline, minimum detectable effect, sample size, analysis date, and guardrails before starting. Do not treat the existing admin's 100-visitors/90%-confidence guidance as sufficient for a decision.

Primary metric: unique exposed visitors reaching checkout / unique exposed visitors, with purchase conversion and revenue per visitor as guardrails. Check purchase event accuracy across card and express-wallet routes before trusting revenue results. Current tracking is browser-reported, not verified payment attribution; current aggregate results do not segment mobile vs desktop. Device analysis and server-verified purchase attribution are unresolved measurement risks.

Before activation, verify desktop and mobile at 375px and 390px, including short viewport height: empty cart, one item below $45, cart at/above $45, quantity changes crossing $45, applied/invalid/removed code, gift-only and gift-plus-product carts, and existing wallet layout. Check that the CTA remains visible and the displayed estimate matches checkout. No live payment or outbound email is required for this review.

Activation requires a separate explicit production decision: change just the selected test's status to `running`, set its actual `started` date, deploy through the existing storefront workflow, verify exposure/outcome counts, and keep other drafts inactive. Roll back to `draft` or select `winner: 'control'`. Retire preview traffic before collecting results. A material variant change needs a new versioned test ID.

## Validation

- `node tests/experiment-drafts.cjs`: verifies inactive defaults, explicit nonpersistent preview, client/server tracking exclusion, and preservation of sticky assignment for existing tests.
- `npm run build`: compilation and static generation (see PR for actual outcome).
- Browser layout and live tracking smoke tests remain required before activation.
