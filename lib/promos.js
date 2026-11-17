// Black Friday 2026: November 16 through Cyber Monday, Pacific time.
// Shared by storefront announcements, coupon validation and payment quotes.
const START = Date.parse('2026-11-16T00:00:00-08:00');
const END = Date.parse('2026-12-01T00:00:00-08:00');
const PROMO = { code: 'BLACKFRIDAY20', type: 'percent', value: 20,
  banner: 'Black Friday Sale — 20% off sitewide with code BLACKFRIDAY20' };
export function activePromos(now = Date.now()) {
  return Number(now) >= START && Number(now) < END ? [{ ...PROMO }] : [];
}
export function activePromo(now = Date.now()) { return activePromos(now)[0] || null; }
export function findPromo(code, now = Date.now()) {
  return typeof code === 'string' && code.trim().toUpperCase() === PROMO.code ? activePromo(now) : null;
}
