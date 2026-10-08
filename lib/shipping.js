// Shipping rule, shared by the cart drawer, every checkout page and the
// site copy that mentions it: a flat STANDARD_SHIPPING, free once the
// merchandise subtotal (before discount codes) reaches
// FREE_SHIPPING_THRESHOLD. At $45, any single 4 oz jar ships free.
export const FREE_SHIPPING_THRESHOLD = 45;
export const STANDARD_SHIPPING = 5;

export function shippingFor(subtotal) {
  return Number(subtotal) >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
}
