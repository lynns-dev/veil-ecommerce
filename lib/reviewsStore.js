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

// Two reviews count as the same review if they have the same text, once
// whitespace/case differences are normalized away — exactly what happens
// when the same CSV gets imported twice, or a customer's submission gets
// double-posted. Author/rating aren't part of the key: the text alone is
// what makes a review a duplicate.
export function reviewDedupeKey(review) {
  return String(review.text || '').trim().toLowerCase().replace(/\s+/g, ' ');
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
// each (see pickCanonical), and returns the resulting list. Runs
// automatically wherever reviews are read for /admin (see
// pages/api/admin/reviews.js) rather than needing a separate "clean up"
// action — a no-op write is skipped entirely when nothing was actually a
// duplicate, so this is cheap to run on every load.
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
    return { reviews: existing, removed: [] };
  }

  const updated = existing.filter((r) => keep.has(r.id));
  const res = await fetch(`${KV_URL}/set/reviews:${productId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(updated),
  });
  if (!res.ok) throw new Error('Failed to remove duplicate reviews.');
  return { reviews: updated, removed };
}
