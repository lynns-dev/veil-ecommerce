// Persists the shopper's in-progress checkout (which step they're on, plus
// the contact/shipping fields) to sessionStorage, so refreshing the tab
// mid-checkout resumes where they left off instead of dropping back to
// Step 1 with a blank form. sessionStorage (not localStorage, unlike
// lib/useCart.js's cart/discount persistence) is deliberate — this should
// survive a refresh within the same tab, not linger indefinitely across
// visits. Payment fields (card number, etc.) are never included here.

const STORAGE_KEY = 'veil-checkout-progress';

export function loadCheckoutProgress() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

export function saveCheckoutProgress(progress) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    // ignore storage write failures (e.g. private browsing quota)
  }
}

export function clearCheckoutProgress() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}
