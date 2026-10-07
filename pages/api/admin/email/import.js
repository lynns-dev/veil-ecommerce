// Admin's Email → Import tab (lib/email/importFromEmailApp.js). POST
// { action: 'preview' | 'import', emailAppUrl, password, ...options }.
// Admin-only via middleware.js; the email app password is used for this
// one request and never stored.
import { previewImport, runImport } from '../../../../lib/email/importFromEmailApp';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { action, emailAppUrl, password, includeUnmatched, includeContent, includeSettings } = req.body || {};
  if (!emailAppUrl || !password) return res.status(400).json({ error: 'Enter the email app address and its admin password.' });
  try {
    if (action === 'preview') return res.status(200).json({ preview: await previewImport({ emailAppUrl, password }) });
    if (action === 'import') {
      return res.status(200).json({
        result: await runImport({
          emailAppUrl, password,
          includeUnmatched: Boolean(includeUnmatched),
          includeContent: Boolean(includeContent),
          includeSettings: Boolean(includeSettings),
        }),
      });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('Email import failed:', err.message);
    const status = /password/i.test(err.message) ? 401 : /address|https|Could not sign in|did not return/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ error: err.message });
  }
}
