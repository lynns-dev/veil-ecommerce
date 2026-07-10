import { getOrders, getEventCounts } from '../../../lib/analyticsStore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [orders, events] = await Promise.all([getOrders(), getEventCounts()]);
    const revenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const rate = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

    return res.status(200).json({
      revenueToday: revenue,
      ordersToday: orders.length,
      funnel: {
        pageviews: events.pageview,
        addToCart: events.addtocart,
        checkoutStarts: events.checkout_start,
        purchases: events.purchase,
        addToCartRate: rate(events.addtocart, events.pageview),
        checkoutRate: rate(events.checkout_start, events.addtocart),
        conversionRate: rate(events.purchase, events.pageview),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
