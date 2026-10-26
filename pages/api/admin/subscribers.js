// Admin's Subscribers tab: everyone who has given an email or phone, one row
// per person — the email list (lib/email/subscribersStore.js), checkout
// leads (lib/checkoutLeadsStore.js), text-alert opt-ins
// (lib/email/smsStore.js) and the last 45 days of orders, matched by email
// (or phone, for a text opt-in with no email), plus every automation email
// each person has been sent (the per-step send logs in
// lib/email/automationsStore.js, written by every automation send). Read-only; adding, suppressing
// and sending emails stay on the Email page.
import { getSubscribers } from '../../../lib/email/subscribersStore';
import { getLeads } from '../../../lib/checkoutLeadsStore';
import { getSmsSubscribers } from '../../../lib/email/smsStore';
import { getOrders, dateKeysForRange } from '../../../lib/analyticsStore';
import { getAutomations, getAutomationSendLog } from '../../../lib/email/automationsStore';

const iso = (v) => (v == null || v === '' ? null : new Date(v).toISOString());
const earliest = (...v) => v.filter(Boolean).sort()[0] || null;
const latest = (...v) => v.filter(Boolean).sort().pop() || null;
const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    // Each source is optional: one failing (or not set up yet) still shows the rest.
    const [subscribers, leads, sms, perDay, sends] = await Promise.all([
      getSubscribers().catch(() => []),
      getLeads().catch(() => []),
      getSmsSubscribers().catch(() => []),
      Promise.all(dateKeysForRange('45d').map((key) => getOrders(key).catch(() => []))),
      automationSendsByEmail().catch(() => ({})),
    ]);

    const people = new Map();
    const byPhone = new Map();
    const person = (email, phone) => {
      const e = String(email || '').trim().toLowerCase();
      const d = digits(phone);
      let p = (e && people.get(e)) || (d && byPhone.get(d)) || null;
      if (!p) {
        p = { key: e || `tel:${d}`, email: e || null, phone: null, name: null, city: null, state: null, sources: [], cart: [], firstSeen: null, lastSeen: null };
        people.set(p.key, p);
      }
      if (e && !p.email) { p.email = e; people.set(e, p); }
      if (phone && !p.phone) p.phone = phone;
      if (d) byPhone.set(d, p);
      return p;
    };
    const addSource = (p, s) => { if (s && !p.sources.includes(s)) p.sources.push(s); };
    const seen = (p, at) => { p.firstSeen = earliest(p.firstSeen, at); p.lastSeen = latest(p.lastSeen, at); };

    for (const s of subscribers) {
      if (!s.email) continue;
      const p = person(s.email, s.phone);
      p.status = s.status;
      p.consent = s.status === 'subscribed';
      addSource(p, s.source || 'newsletter');
      seen(p, iso(s.createdAt));
      seen(p, iso(s.lastClickAt));
      if (s.checkoutStartedAt) {
        seen(p, iso(s.checkoutStartedAt));
        p.lastCheckoutAt = latest(p.lastCheckoutAt, iso(s.checkoutStartedAt));
        if (s.checkoutItems?.length) p.cart = s.checkoutItems;
        if (s.checkoutValue != null) p.cartValue = Number(s.checkoutValue);
      }
    }
    for (const l of leads) {
      const p = person(l.email, l.phone);
      addSource(p, 'checkout');
      seen(p, l.firstSeenAt);
      seen(p, l.lastSeenAt);
      if (l.status === 'abandoned') {
        p.lastCheckoutAt = latest(p.lastCheckoutAt, l.lastSeenAt);
        if (l.cart?.length && !p.cart.length) p.cart = l.cart;
      }
    }
    for (const s of sms) {
      if (!s.phone) continue;
      const p = person(s.email, s.phone);
      addSource(p, 'texts');
      p.textsOk = s.status !== 'unsubscribed' && s.status !== 'stopped';
      seen(p, iso(s.consentAt));
    }
    for (const o of perDay.flat()) {
      if (!o.email && !o.shipping?.phone) continue;
      const p = person(o.email, o.shipping?.phone);
      addSource(p, 'order');
      seen(p, o.createdAt);
      const sh = o.shipping || {};
      p.name = p.name || sh.name || `${sh.firstName || ''} ${sh.lastName || ''}`.trim() || null;
      p.city = p.city || sh.city || null;
      p.state = p.state || sh.state || sh.province || null;
      if (['refunded', 'cancelled'].includes(o.status)) continue;
      const entry = p.orders || (p.orders = { count: 0, spent: 0, lastOrderAt: null });
      entry.count += 1;
      entry.spent += Number(o.amount || 0);
      entry.lastOrderAt = latest(entry.lastOrderAt, o.createdAt);
    }

    const list = [...new Set(people.values())].map((p) => {
      p.automations = (p.email && sends[p.email]) || [];
      // A checkout only counts as abandoned if no order came after it.
      if (p.lastCheckoutAt && p.orders?.lastOrderAt && p.orders.lastOrderAt >= p.lastCheckoutAt) p.lastCheckoutAt = null;
      return p;
    }).sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
    return res.status(200).json({ subscribers: list });
  } catch (err) {
    console.error('Subscribers fetch failed:', err);
    return res.status(500).json({ error: err.message });
  }
}

// email -> [{ flowId, flow, step, subject, sentAt }], newest first, from
// every step's send log of every automation flow.
async function automationSendsByEmail() {
  const flows = await getAutomations();
  const steps = flows.flatMap((f) => (f.steps || []).map((step, i) => ({ f, step, i })));
  const logs = await Promise.all(steps.map(({ f, i }) => getAutomationSendLog(f.id, i).catch(() => [])));
  const byEmail = {};
  steps.forEach(({ f, step, i }, n) => {
    for (const entry of logs[n]) {
      const e = String(entry.email || '').trim().toLowerCase();
      if (!e) continue;
      (byEmail[e] || (byEmail[e] = [])).push({ flowId: f.id, flow: f.name || f.id, step: i + 1, steps: f.steps.length, subject: step.subject || null, sentAt: iso(entry.sentAt) });
    }
  });
  for (const list of Object.values(byEmail)) list.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  return byEmail;
}
