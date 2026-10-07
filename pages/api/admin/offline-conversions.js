// Admin's "Send offline sales to Meta" panel (lib/offlineConversions.js).
// GET: recently sent offline sales. POST { sales: [...] }: sends each row
// and reports per-row results. Admin-only via middleware.js.

import { sendOfflineSale, recentOfflineSales } from '../../../lib/offlineConversions';

const MAX_ROWS = 500;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ recent: await recentOfflineSales() });
    }
    if (req.method === 'POST') {
      const sales = Array.isArray(req.body?.sales) ? req.body.sales.slice(0, MAX_ROWS) : [];
      if (sales.length === 0) return res.status(400).json({ error: 'No sales to send.' });
      const results = [];
      for (const sale of sales) results.push(await sendOfflineSale(sale));
      return res.status(200).json({ results });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Offline conversions error:', err);
    return res.status(500).json({ error: err.message });
  }
}
