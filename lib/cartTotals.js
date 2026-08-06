// Shared cart/checkout money math, so the cart drawer and all three
// checkout pages present identical numbers instead of each deriving their
// own.
//
// Presentation rules this encodes, per how the store wants the gift framed:
//   - subtotal covers the paid items only. The free Tassel is deliberately
//     NOT in it — including its $15 there and then discounting it back out
//     lower down read as if the shopper were being charged for a gift.
//   - the gift gets its own row instead: $0.00, with its $15 value struck
//     through, so the value is visible without inflating what's owed.
//   - savings is a single headline number: an applied promo code plus any
//     per-item markdown. The gift's value is deliberately excluded — it's
//     not a discount off anything the shopper is paying for, so counting
//     it as "savings" overstated the number.

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

  const totalSavings = codeDiscountAmount + itemSavings;

  return {
    subtotal,
    giftValue,
    itemSavings,
    totalSavings,
    hasGift: giftItems.length > 0,
    grandTotal: discountedTotal + shippingCost,
  };
}
