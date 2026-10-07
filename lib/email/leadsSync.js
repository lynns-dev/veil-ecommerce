// Feeds this store's own checkout/popup leads (lib/checkoutLeadsStore.js)
// into the email list — what the separate email app used to pull over
// HTTP from /api/leads/export, now read directly. Same rules as before:
// every lead with an email becomes a subscriber (source 'lead'), and an
// abandoned lead with a cart starts the abandoned_checkout flow with that
// cart. Only leads seen since the last sync are processed, so the
// 15-minute automations cron doesn't rewrite the whole list each run.

import { getLeads } from '../checkoutLeadsStore';
import { addSubscriberManually, recordCheckoutStarted, findSubscriber } from './subscribersStore';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const CURSOR_KEY = 'email_leads_synced_at';

async function kv(path, body) {
  const res = await fetch(`${KV_URL}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    ...(body === undefined ? {} : { body }),
  });
  return res.json();
}

export async function syncStoreLeads() {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  const since = Number((await kv(`get/${CURSOR_KEY}`)).result) || 0;
  const startedAt = Date.now();
  const leads = (await getLeads()).filter((l) => l.email && new Date(l.lastSeenAt || l.firstSeenAt || 0).getTime() > since);

  let subscribersSynced = 0;
  let checkoutsBackfilled = 0;
  for (const lead of leads) {
    const before = await findSubscriber(lead.email);
    await addSubscriberManually(lead.email, 'lead', { phone: lead.phone || undefined }).catch(() => {});
    subscribersSynced += 1;

    const hasCart = Array.isArray(lead.cart) && lead.cart.length > 0;
    if (!before?.checkoutStartedAt && lead.status === 'abandoned' && hasCart) {
      const items = lead.cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price ?? null, image: i.images?.[0] || null }));
      await recordCheckoutStarted(lead.email, 0, items).catch(() => {});
      checkoutsBackfilled += 1;
    }
  }
  await kv(`set/${CURSOR_KEY}`, String(startedAt));
  return { checked: leads.length, subscribersSynced, checkoutsBackfilled };
}
