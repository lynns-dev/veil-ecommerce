// GET  (no productId): { [productId]: { reviews, average, count } } for every product.
// GET  ?productId=X:   { reviews, average, count } for that product.
// POST { productId, rating, text, author, source? }: appends a review
// (source: 'imported' for bulk-added reviews from elsewhere, default 'site')
// and publishes immediately — no moderation queue.

import { getReviews, addReview } from '../../lib/reviewsStore';
import { PRODUCTS } from '../../lib/products';

function aggregate(reviews) {
  const count = reviews.length;
  const average = count === 0 ? 0 : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
  return { count, average };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { productId } = req.query;

      if (productId) {
        const reviews = await getReviews(productId);
        return res.status(200).json({ reviews, ...aggregate(reviews) });
      }

      const entries = await Promise.all(
        PRODUCTS.map(async (p) => {
          const reviews = await getReviews(p.id);
          return [p.id, { reviews, ...aggregate(reviews) }];
        })
      );
      return res.status(200).json(Object.fromEntries(entries));
    }

    if (req.method === 'POST') {
      const { productId, rating, text, author, source } = req.body || {};

      if (!productId || !PRODUCTS.some((p) => p.id === productId)) {
        return res.status(400).json({ error: 'Unknown product.' });
      }
      const numericRating = Number(rating);
      if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
      }
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Review text is required.' });
      }

      const review = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rating: numericRating,
        text: text.trim().slice(0, 2000),
        author: (author || 'Anonymous').trim().slice(0, 80) || 'Anonymous',
        createdAt: new Date().toISOString(),
        source: source === 'imported' ? 'imported' : 'site',
      };

      const updated = await addReview(productId, review);
      return res.status(200).json({ review, ...aggregate(updated) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Reviews API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
