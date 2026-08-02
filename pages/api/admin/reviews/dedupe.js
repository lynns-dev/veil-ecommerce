// One-shot cleanup: removes duplicate reviews (same author + same text,
// see lib/reviewsStore.js's reviewDedupeKey) across every product, keeping
// one canonical copy of each. Admin-only (protected by middleware.js's
// session check on /api/admin/*).

import { removeDuplicateReviews } from '../../../../lib/reviewsStore';
import { PRODUCTS } from '../../../../lib/products';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const results = await Promise.all(
      PRODUCTS.map(async (p) => {
        const { before, after, removed } = await removeDuplicateReviews(p.id);
        return { productId: p.id, productName: p.name, before, after, removedCount: removed.length, removed };
      })
    );
    const totalRemoved = results.reduce((sum, r) => sum + r.removedCount, 0);
    return res.status(200).json({ totalRemoved, results: results.filter((r) => r.removedCount > 0) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
