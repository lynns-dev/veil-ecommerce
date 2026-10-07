// The site signup popup (components/SignupPopup.jsx): email and/or mobile.
// Email joins the marketing list with the welcome email (same as the
// newsletter form); a mobile number is saved as an SMS opt-in with its
// consent record (lib/email/smsStore.js). Either one alone is enough.

import { subscribeEmail } from './subscribe';
import { addSubscriberManually } from '../../../lib/email/subscribersStore';
import { addSmsSubscriber, normalizeUsPhone, SMS_CONSENT_TEXT } from '../../../lib/email/smsStore';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phoneRaw = String(req.body?.phone || '').trim();
  if (!email && !phoneRaw) return res.status(400).json({ error: 'Enter your email and/or mobile number.' });

  const phone = phoneRaw ? normalizeUsPhone(phoneRaw) : null;
  if (phoneRaw && !phone) return res.status(400).json({ error: 'Enter a valid US mobile number.' });

  const result = { ok: true };
  if (email) {
    const { status, body } = await subscribeEmail(email, 'popup');
    if (status !== 200) return res.status(status).json(body);
    result.emailSubscribed = true;
    result.alreadySubscribed = body.alreadySubscribed === true;
    if (phone) await addSubscriberManually(email, 'popup', { phone }).catch(() => {});
  }
  if (phone) {
    try {
      await addSmsSubscriber({
        phone, email: email || null, source: 'popup', consentText: SMS_CONSENT_TEXT,
        ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
        userAgent: req.headers['user-agent'] || null,
      });
      result.smsSubscribed = true;
    } catch (err) {
      console.error('SMS opt-in failed:', err.message);
      if (!email) return res.status(500).json({ error: 'We could not sign you up right now. Please try again.' });
    }
  }
  return res.status(200).json(result);
}
