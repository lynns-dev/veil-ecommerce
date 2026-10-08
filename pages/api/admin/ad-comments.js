// Admin → Ad comments (pages/admin/ad-comments.jsx). See lib/adComments.js.
import {
  getAdComments, getRules, updateRules, getSyncStatus, moderationConfig, moderateComment, syncAdComments,
} from '../../../lib/adComments';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [comments, rules, lastSync] = await Promise.all([getAdComments(), getRules(), getSyncStatus()]);
      return res.status(200).json({ comments, rules, lastSync, config: moderationConfig() });
    }

    if (req.method === 'POST') {
      const { action, id, message } = req.body || {};
      if (action === 'sync') {
        const result = await syncAdComments();
        return res.status(200).json({ result });
      }
      if (!id) return res.status(400).json({ error: 'Missing comment id.' });
      const comment = await moderateComment(id, action, { message });
      return res.status(200).json({ comment });
    }

    if (req.method === 'PUT') {
      const rules = await updateRules(req.body || {});
      return res.status(200).json({ rules });
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
