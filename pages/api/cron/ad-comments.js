// Pulls new comments on the store's active Meta ads and auto-hides the ones
// that break the rules set in admin → Ad comments (lib/adComments.js).
import { moderationConfig, syncAdComments } from '../../../lib/adComments';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Not authorized.' });
  }

  const c = moderationConfig();
  if (!c.adAccount || !c.marketingToken || !c.pageToken) {
    return res.status(200).json({ ok: true, skipped: 'Ad comment moderation is not configured.' });
  }

  try {
    const result = await syncAdComments();
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
