// Machine-to-machine export for a separate app (e.g. an email/subscriber
// tool) to pull captured checkout leads from. Deliberately NOT under
// /api/admin — that path is gated by the admin browser-session cookie
// (see middleware.js), which only works for a logged-in person in this
// site's own /admin, not a service calling in from elsewhere. This route
// checks its own bearer token instead (LEADS_API_KEY) so it can be called
// directly, e.g.:
//
//   curl -H "Authorization: Bearer $LEADS_API_KEY" https://your-site/api/leads/export
//
// Returns every captured lead (both 'abandoned' and 'purchased') — the
// consuming app can filter by status itself if it only wants one or the other.

import { getLeads } from '../../../lib/checkoutLeadsStore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.LEADS_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'LEADS_API_KEY is not set.' });
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${key}`) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const leads = await getLeads();
    return res.status(200).json({ leads });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
