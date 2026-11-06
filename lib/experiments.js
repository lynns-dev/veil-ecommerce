import React from 'react';
import { getSessionId } from './session';

// Split tests (A/B). Each visitor is put in one variant per test, 50/50, and
// stays there (kept on this device). A test only counts a visitor once they
// have actually seen it (exposeExperiment), and from then on every cart /
// checkout / purchase step they reach is counted under their variant
// (lib/cartTracking.js → pages/api/track/cart.js → lib/experimentsStore.js).
// Results: admin → /admin/tests.
//
// To end a test: set `winner` to the variant that should show for everyone.

export const EXPERIMENTS = {
  pdp_proof: {
    name: 'Product page: top review + scent notes above Add to bag',
    variants: ['control', 'proof'],
    started: '2026-11-05',
  },
  set_offer: {
    name: 'Product page: Scent Trio (save $20) card above Add to bag',
    variants: ['control', 'set'],
    started: '2026-11-05',
  },
  cart_trust: {
    name: 'Cart: reviews + 30-day guarantee above Checkout',
    variants: ['control', 'trust'],
    started: '2026-11-05',
  },
};

const KEY = (id) => `veil-exp:${id}`;
const SEEN = (id) => `veil-exp-seen:${id}`;

function store(fn) {
  try { return fn(window.localStorage); } catch { return null; }
}

export function getVariant(id) {
  const exp = EXPERIMENTS[id];
  if (!exp || typeof window === 'undefined') return 'control';
  if (exp.winner) return exp.winner;
  // ?exp_<id>=<variant> forces a variant on this device (for checking a test).
  try {
    const forced = new URLSearchParams(window.location.search).get(`exp_${id}`);
    if (forced && exp.variants.includes(forced)) {
      store((s) => s.setItem(KEY(id), forced));
      return forced;
    }
  } catch { /* ignore */ }
  let v = store((s) => s.getItem(KEY(id)));
  if (!exp.variants.includes(v)) {
    v = exp.variants[Math.floor(Math.random() * exp.variants.length)];
    store((s) => s.setItem(KEY(id), v));
  }
  return v;
}

// 'control' on first render (matches the server), then the real variant.
export function useVariant(id) {
  const [v, setV] = React.useState('control');
  React.useEffect(() => { setV(getVariant(id)); }, [id]);
  return v;
}

export function exposeExperiment(id) {
  const exp = EXPERIMENTS[id];
  if (!exp || exp.winner || typeof window === 'undefined') return;
  const variant = getVariant(id);
  if (store((s) => s.getItem(SEEN(id))) === variant) return;
  store((s) => s.setItem(SEEN(id), variant));
  try {
    fetch('/api/track/exp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, variant, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* tracking never gets in the way */ }
}

export function exposedExperiments() {
  if (typeof window === 'undefined') return {};
  const out = {};
  for (const [id, exp] of Object.entries(EXPERIMENTS)) {
    if (exp.winner) continue;
    const seen = store((s) => s.getItem(SEEN(id)));
    if (seen && exp.variants.includes(seen)) out[id] = seen;
  }
  return out;
}

// Veil has no cart drop-off report, so the steps a test counts are sent
// here directly: 'added' (lib/useCart.js), 'checkout_view' (checkout pages)
// and 'purchased' (pages/success.jsx, with the order amount).
export function trackExpStep(step, detail = {}) {
  if (typeof window === 'undefined') return;
  const exps = exposedExperiments();
  if (!Object.keys(exps).length) return;
  try {
    fetch('/api/track/exp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, exps, subtotal: Number(detail.subtotal) || undefined, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* tracking never gets in the way */ }
}
