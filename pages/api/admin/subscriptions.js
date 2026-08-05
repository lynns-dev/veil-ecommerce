import { getSubscriptions } from '../../../lib/subscriptionsStore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const subs = await getSubscriptions();
    const sorted = [...subs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ subscriptions: sorted });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
