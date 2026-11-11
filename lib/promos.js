// Veterans Day 2026: November 10–12 in Pacific time. Shared by the
// storefront, coupon endpoint and authoritative payment quotes.
const START = Date.parse('2026-11-10T00:00:00-08:00');
const END = Date.parse('2026-11-13T00:00:00-08:00');
const PROMO = { code: 'VETERANS15', type: 'percent', value: 15,
  banner: 'Veterans Day Sale — 15% off with code VETERANS15' };
export function activePromos(now = Date.now()) {
  return Number(now) >= START && Number(now) < END ? [{ ...PROMO }] : [];
}
export function activePromo(now = Date.now()) { return activePromos(now)[0] || null; }
export function findPromo(code, now = Date.now()) {
  return typeof code === 'string' && code.trim().toUpperCase() === PROMO.code ? activePromo(now) : null;
}
