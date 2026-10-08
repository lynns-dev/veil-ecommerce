// The site's signup forms (components/SignupPopup.jsx and
// components/NewsletterSignup.jsx, both through lib/useSignup.js): email AND
// mobile, both required. The email joins the marketing list with the welcome
// email; the mobile number is saved as an SMS opt-in with its consent record
// (lib/email/smsStore.js). The response carries the welcome code so the form
// can show it on screen straight away.

import { subscribeEmail } from './subscribe';
import { addSubscriberManually } from '../../../lib/email/subscribersStore';
import { addSmsSubscriber, normalizeUsPhone, SMS_CONSENT_TEXT } from '../../../lib/email/smsStore';
import { getDiscounts } from '../../../lib/discountsStore';

// The code the welcome email hands out (lib/email/automationsStore.js). It is
// looked up in the live discount list rather than returned blindly, so a code
// that has been removed from /admin's Discounts tab is never shown to a
// shopper as if it still worked — the form falls back to "check your inbox".
const WELCOME_CODE = 'WELCOME10';

const SOURCES = new Set(['popup', 'newsletter']);

async function welcomeDiscount() {
  try {
    const match = (await getDiscounts()).find((d) => d.code.toLowerCase() === WELCOME_CODE.toLowerCase());
    return match ? { code: match.code, type: match.type, value: match.value } : null;
  } catch (err) {
    console.error('Welcome code lookup failed:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phoneRaw = String(req.body?.phone || '').trim();
  const source = SOURCES.has(req.body?.source) ? req.body.source : 'popup';
  if (!email || !phoneRaw) return res.status(400).json({ error: 'Enter both your email and mobile number to get your code.' });

  const phone = normalizeUsPhone(phoneRaw);
  if (!phone) return res.status(400).json({ error: 'Enter a valid US mobile number.' });

  const { status, body } = await subscribeEmail(email, source);
  if (status !== 200) return res.status(status).json(body);
  const result = {
    ok: true,
    emailSubscribed: true,
    alreadySubscribed: body.alreadySubscribed === true,
    // False when the welcome series is switched off in admin (or its send
    // failed and is queued) — the form only says "we've emailed it to you"
    // when that is actually true.
    welcomeSent: body.welcomeSent === true,
  };
  await addSubscriberManually(email, source, { phone }).catch((err) => console.error(`Subscriber phone update failed (${source}):`, err.message));

  try {
    await addSmsSubscriber({
      phone, email, source, consentText: SMS_CONSENT_TEXT,
      ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
      userAgent: req.headers['user-agent'] || null,
    });
    result.smsSubscribed = true;
  } catch (err) {
    // The email signup already went through, so this isn't surfaced as a
    // failure — they still get their code.
    console.error('SMS opt-in failed:', err.message);
  }

  const discount = await welcomeDiscount();
  if (discount) result.discount = discount;
  return res.status(200).json(result);
}
