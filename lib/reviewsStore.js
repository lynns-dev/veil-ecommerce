// Product reviews persisted in the same Upstash KV store used elsewhere
// (admin sessions, analytics, discounts). One key per product:
// reviews:<productId> -> JSON array of review objects, newest last.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

export async function getReviews(productId) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/reviews:${productId}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

export async function addReview(productId, review) {
  const existing = await getReviews(productId);
  const updated = [...existing, review];
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to save review.');
  return updated;
}

export async function deleteReview(productId, reviewId) {
  const existing = await getReviews(productId);
  const updated = existing.filter((r) => r.id !== reviewId);
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to delete review.');
  return updated;
}

export async function approveReview(productId, reviewId) {
  const existing = await getReviews(productId);
  const updated = existing.map((r) => (r.id === reviewId ? { ...r, status: 'approved' } : r));
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to approve review.');
  return updated;
}

// Two reviews count as the same review if they have the same author and
// the same text, once whitespace/case differences are normalized away —
// exactly what happens when the same CSV gets imported twice, or a
// customer's submission gets double-posted. A rating difference alone
// doesn't make them distinct (nothing legitimately re-submits the same
// review text with a different star count), so it's deliberately left out
// of the key.
export function reviewDedupeKey(review) {
  const author = String(review.author || '').trim().toLowerCase();
  const text = String(review.text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${author}|${text}`;
}

// Within a group of duplicates, keeps the one most worth keeping rather
// than just the first one seen: an approved/published review over a
// pending one (dropping it would un-publish something a customer can
// currently see), then whichever was created first — the earlier entry is
// more likely the real submission, with later ones being the accidental
// re-import/re-submit.
function pickCanonical(group) {
  return [...group].sort((a, b) => {
    const statusRank = (r) => (r.status === 'approved' ? 0 : 1);
    if (statusRank(a) !== statusRank(b)) return statusRank(a) - statusRank(b);
    return new Date(a.createdAt) - new Date(b.createdAt);
  })[0];
}

// Removes duplicate reviews for one product, keeping one canonical copy of
// each (see pickCanonical). Returns which reviews were dropped so a caller
// can report exactly what changed rather than a bare count. A no-op write
// is skipped entirely when nothing was actually a duplicate.
export async function removeDuplicateReviews(productId) {
  const existing = await getReviews(productId);
  const groups = new Map();
  for (const review of existing) {
    const key = reviewDedupeKey(review);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(review);
  }

  const keep = new Set();
  for (const group of groups.values()) {
    keep.add(pickCanonical(group).id);
  }

  const removed = existing.filter((r) => !keep.has(r.id));
  if (removed.length === 0) {
    return { before: existing.length, after: existing.length, removed: [] };
  }

  const updated = existing.filter((r) => keep.has(r.id));
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to remove duplicate reviews.');
  return { before: existing.length, after: updated.length, removed };
}
