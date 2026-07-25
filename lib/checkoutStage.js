// Lets the multi-step checkout pages (checkout.jsx, checkout-qb.jsx) report
// which step a visitor is currently on, without those pages needing to know
// anything about analytics — pages/_app.jsx's heartbeat effect reads this
// value on its next tick to fill in the 'stage' it sends to
// /api/track/heartbeat. Plain module-scoped state, same lightweight
// pattern as lib/session.js, since this only ever needs to live for the
// current tab's lifetime.

let step = null;

export function setCheckoutStep(n) {
  step = n;
}

export function getCheckoutStage() {
  if (step === 1) return 'checkout_shipping';
  if (step === 2) return 'checkout_payment';
  return null;
}
