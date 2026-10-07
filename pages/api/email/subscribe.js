// Newsletter signup (the site's own forms, via /api/newsletter): adds the
// subscriber and sends welcome step 1 immediately. If the welcome series is
// switched off (or has no first email), the subscriber is still saved — the
// signup itself never fails just because no welcome is configured.

import { findSubscriber, addSubscriberManually, updateAutomationState } from '../../../lib/email/subscribersStore';
import { getAutomation } from '../../../lib/email/automationsStore';
import { getSettings } from '../../../lib/email/settingsStore';
import { prepareStepTemplate, sendStepToSubscriber } from '../../../lib/email/automationSend';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeEmail(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { status: 400, body: { error: 'Enter a valid email address.' } };

  let subscriber = null;
  try {
    const existing = await findSubscriber(email);
    if (existing?.status === 'suppressed') {
      return { status: 400, body: { error: 'This address cannot receive emails. Please use another email address.' } };
    }
    if (existing?.status === 'subscribed') return { status: 200, body: { ok: true, alreadySubscribed: true } };

    const flow = await getAutomation('welcome_series');
    if (!flow?.enabled || !flow.steps?.[0]?.subject) {
      await addSubscriberManually(email, 'newsletter');
      return { status: 200, body: { ok: true, welcomeSent: false } };
    }
    const settings = await getSettings();
    const step = flow.steps[0];
    const template = await prepareStepTemplate(flow.id, step, 0, settings);
    // Reserve step zero at creation, keeping it out of the scheduled sender.
    subscriber = await addSubscriberManually(email, 'newsletter', { reserveWelcome: true });
    await sendStepToSubscriber(flow.id, 0, template, step.subject, subscriber);
    return { status: 200, body: { ok: true, welcomeSent: true } };
  } catch (err) {
    // Delivery failed: leave the welcome queued for the scheduled sender.
    if (subscriber) await updateAutomationState(subscriber.email, 'welcome_series', { step: 0 }).catch(() => {});
    console.error('Newsletter signup failed', { message: err.message });
    if (subscriber) return { status: 200, body: { ok: true, welcomeSent: false } };
    return { status: 500, body: { error: 'We could not sign you up right now. Please try again.' } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { status, body } = await subscribeEmail(req.body?.email);
  return res.status(status).json(body);
}
