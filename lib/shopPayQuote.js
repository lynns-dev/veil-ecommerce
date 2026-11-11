import { findPromo } from './promos';
import { getProductById, TASSEL_GIFT as GIFT } from './products';
import { STANDARD_SHIPPING as SHIPPING_COST, FREE_SHIPPING_THRESHOLD as FREE_SHIPPING_MIN } from './shipping';
import { getDiscounts } from './discountsStore';

export const STORE_KEY = 'veil';
const cents = n => Math.round(Number(n) * 100);

export async function quoteShopPayCart(cart, code, freeShipping = false) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 30) throw new Error('Your cart is empty or too large.');
  const seen = new Set();
  const items = cart.map(line => {
    const product = line.id === GIFT.id ? GIFT : getProductById(line.id);
    if (!product || product.archived || seen.has(line.id)) throw new Error('An item is no longer available. Refresh your cart.');
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) throw new Error('Invalid item quantity.');
    seen.add(line.id);
    if (product.id === GIFT.id && line.quantity !== 1) throw new Error('Only one free gift is available per order.');
    return { id: product.id, name: product.name, price: product.id === GIFT.id ? 0 : product.price, quantity: line.quantity };
  });
  const subtotalCents = items.reduce((n, i) => n + cents(i.price) * i.quantity, 0);
  let match = null;
  if (code != null && typeof code !== 'string') throw new Error('Use one discount code per order.');
  const cleanCode = (code || '').trim().toUpperCase();
  if (cleanCode) {
    match = findPromo(cleanCode) || (await getDiscounts()).find(d => d.code.toUpperCase() === cleanCode);
    if (!match) throw new Error('That discount code is no longer valid.');
  }
  const discountCents = match ? Math.min(subtotalCents, Math.max(0, match.type === 'percent'
    ? Math.round(subtotalCents * Number(match.value) / 100) : cents(match.value))) : 0;
  // The same publicly offered free-shipping perk as the regular checkout.
  const shippingCents = subtotalCents >= cents(FREE_SHIPPING_MIN) ? 0 : cents(SHIPPING_COST);
  const total = (subtotalCents - discountCents + shippingCents) / 100;
  if (!Number.isFinite(total) || total <= 0) throw new Error('Shop Pay requires a positive order total.');
  return { items, subtotal: subtotalCents / 100, discount: discountCents / 100, discountCode: match?.code || '', shipping: shippingCents / 100, total };
}
