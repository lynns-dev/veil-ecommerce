// Shared cart/checkout money math, so the cart drawer and all three
// checkout pages present identical numbers instead of each deriving their
// own (they previously drifted — the drawer showed a "Discount" line
// covering the gift's value while checkout folded that same value into
// "You saved", double-describing the same dollars).
//
// Presentation rules this encodes, per how the store wants the gift framed:
//   - subtotal covers the paid items only. The free Tassel is deliberately
//     NOT in it — including its $15 there and then discounting it back out
//     lower down read as if the shopper were being charged for a gift.
//   - the gift gets its own row instead: $0.00, with its $15 value struck
//     through, so the value is visible without inflating what's owed.
//   - savings is a single headline number: promo code + the gift's value +
//     any per-item markdown (e.g. the 10%-off Puff upsell).
//
// Note this makes savings a *marketing* figure rather than an arithmetic
// step: subtotal − savings does not equal total, because the gift's value
// was never added to subtotal in the first place. That's an intentional
// product decision — `total` here is always the real amount charged, taken
// straight from the cart's own discountedTotal plus shipping, never derived
// from the savings figure.

import { TASSEL_GIFT } from './products';

export function computeCartTotals({ cart = [], codeDiscountAmount = 0, shippingCost = 0, discountedTotal = 0 }) {
  const giftItems = cart.filter((i) => i.id === TASSEL_GIFT.id);
  const paidItems = cart.filter((i) => i.id !== TASSEL_GIFT.id);

  const unitOriginal = (item) => item.originalPrice ?? item.price;

  const subtotal = paidItems.reduce((sum, i) => sum + unitOriginal(i) * i.quantity, 0);

  // Falls back to the catalog price rather than assuming a hardcoded 15 —
  // the gift is added to the cart carrying its own originalPrice, but a
  // cart persisted from before that was the case may not have one.
  const giftValue = giftItems.reduce((sum, i) => sum + (i.originalPrice ?? TASSEL_GIFT.price) * i.quantity, 0);

  // Per-item markdowns on paid items (the discounted Puff upsell) — counted
  // as savings too, otherwise the gap between the struck original price
  // shown on the line item and what's actually charged goes unexplained.
  const itemSavings = paidItems.reduce((sum, i) => sum + (unitOriginal(i) - i.price) * i.quantity, 0);

  const totalSavings = codeDiscountAmount + giftValue + itemSavings;

  return {
    subtotal,
    giftValue,
    itemSavings,
    totalSavings,
    hasGift: giftItems.length > 0,
    grandTotal: discountedTotal + shippingCost,
  };
}
