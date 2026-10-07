// Homepage newsletter form. Handled in-store by the email system in
// lib/email/ (see pages/api/email/subscribe.js), which replaced the
// separate email app this used to forward to.
import { subscribeEmail } from './email/subscribe';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { status, body } = await subscribeEmail(req.body?.email);
  return res.status(status).json(status === 200 ? { ok: true, alreadySubscribed: body.alreadySubscribed === true } : body);
}
