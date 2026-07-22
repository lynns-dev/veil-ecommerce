// Checkout discount codes, stored in the same KV store as everything else
// so they can be managed from /admin without a code change + redeploy.
// Seeded once with the original hardcoded codes on first read if the store
// is empty. type: 'percent' (value = percent off) or 'fixed' (value = dollars off).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'discounts';

const SEED_DISCOUNTS = [
  { code: 'WELCOME10', type: 'percent', value: 10 },
  { code: 'VEIL5', type: 'fixed', value: 5 },
  // Default codes shown on the "Reveal Your Reserve" scratch-off popup
  // (components/ReserveScratchPopup.jsx) — only take effect on a store
  // that's never been written to. See the note in that popup's mount
  // point about production, which likely already has data and won't
  // pick these up automatically.
  { code: 'RESERVED15', type: 'percent', value: 15 },
  { code: 'RESERVE20', type: 'percent', value: 20 },
];

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

async function saveDiscounts(discounts) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(discounts),
  });
  if (!res.ok) throw new Error('Failed to save discount codes.');
}

export async function getDiscounts() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  if (data.result) return JSON.parse(data.result);
  await saveDiscounts(SEED_DISCOUNTS);
  return SEED_DISCOUNTS;
}

export async function addDiscount(discount) {
  const existing = await getDiscounts();
  const withoutDupe = existing.filter((d) => d.code.toLowerCase() !== discount.code.toLowerCase());
  const updated = [...withoutDupe, discount];
  await saveDiscounts(updated);
  return updated;
}

export async function removeDiscount(code) {
  const existing = await getDiscounts();
  const updated = existing.filter((d) => d.code.toLowerCase() !== code.toLowerCase());
  await saveDiscounts(updated);
  return updated;
}
