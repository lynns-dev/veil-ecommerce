// Offline sales -> Meta Purchase events, from admin's "Send offline sales
// to Meta" panel: sales that happened off the website (in person, by
// phone, over DMs/chat, by email), entered one at a time or as a CSV.
// Website orders are already reported automatically (lib/metaPurchase.js)
// and must not be entered here, or they'd count twice.
//
// action_source is the channel the sale really happened through. Meta
// accepts in-store ("physical_store") sales up to 62 days old and every
// other channel up to 7 days.
//
// Dedup: each sale's event_id is a hash of its email/phone, time and
// amount, and every accepted send is remembered in KV — re-entering the
// same sale, or re-uploading the same CSV, skips it instead of sending it
// again.

import crypto from 'crypto';
import { sendCapiEvent, buildUserData } from './metaCapi';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const LOG_KEY = 'offline_conversions:log';
const LOG_CAP = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export const CHANNELS = {
  physical_store: { label: 'In person / in store', maxAgeMs: 62 * DAY_MS },
  phone_call: { label: 'Phone call', maxAgeMs: 7 * DAY_MS },
  chat: { label: 'DM / chat', maxAgeMs: 7 * DAY_MS },
  email: { label: 'Email', maxAgeMs: 7 * DAY_MS },
  other: { label: 'Other', maxAgeMs: 7 * DAY_MS },
};

async function redis(command) {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redis command failed.');
  return data.result;
}

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const norm = (v) => String(v || '').trim().toLowerCase();

// Validates one sale and resolves to { ok, skipped?, error?, eventId? }.
// Never throws for a bad row — the caller reports it per row.
export async function sendOfflineSale(input, now = Date.now()) {
  const email = norm(input.email);
  const phone = String(input.phone || '').replace(/\D/g, '');
  const amount = Number(String(input.amount ?? '').replace(/[$,]/g, ''));
  const channel = CHANNELS[input.channel] ? input.channel : 'physical_store';
  const occurredAt = input.date ? new Date(input.date).getTime() : now;

  if (!email.includes('@') && phone.length < 10) return { ok: false, error: 'Needs an email or a phone number' };
  if (!(amount > 0)) return { ok: false, error: 'Needs an amount above $0' };
  if (Number.isNaN(occurredAt)) return { ok: false, error: 'Date not recognized' };
  if (occurredAt > now + 5 * 60 * 1000) return { ok: false, error: 'Date is in the future' };
  if (occurredAt < now - CHANNELS[channel].maxAgeMs) {
    return { ok: false, error: `Too old — Meta accepts ${CHANNELS[channel].label.toLowerCase()} sales up to ${Math.round(CHANNELS[channel].maxAgeMs / DAY_MS)} days back` };
  }

  const eventId = `offline_${sha256(`${email}|${phone}|${Math.floor(occurredAt / 60000)}|${amount.toFixed(2)}`).slice(0, 24)}`;
  if (await redis(['SISMEMBER', 'offline_conversions:sent', eventId])) return { ok: true, skipped: true, eventId };

  const firstName = norm(input.firstName);
  const lastName = norm(input.lastName);
  const zip = norm(input.zip).replace(/\s/g, '').slice(0, 5);
  const result = await sendCapiEvent({
    eventName: 'Purchase',
    eventId,
    actionSource: channel,
    eventTime: Math.floor(occurredAt / 1000),
    userData: {
      ...buildUserData(null, { email: email || undefined, phone: phone || undefined }),
      ...(firstName ? { fn: sha256(firstName) } : {}),
      ...(lastName ? { ln: sha256(lastName) } : {}),
      ...(zip ? { zp: sha256(zip) } : {}),
      country: sha256('us'),
    },
    customData: { currency: 'USD', value: amount, order_id: eventId },
  });
  if (!result.ok) return { ok: false, error: result.error || 'Meta rejected it', eventId };

  await redis(['SADD', 'offline_conversions:sent', eventId]);
  await redis(['LPUSH', LOG_KEY, JSON.stringify({
    eventId, amount, channel, occurredAt: new Date(occurredAt).toISOString(), sentAt: new Date(now).toISOString(),
    // A recognizable but partial label for admin's list, not the full contact.
    who: email ? email.replace(/^(.).*(@.*)$/, '$1•••$2') : `•••${phone.slice(-4)}`,
  })]);
  await redis(['LTRIM', LOG_KEY, '0', String(LOG_CAP - 1)]);
  return { ok: true, eventId };
}

export async function recentOfflineSales(limit = 25) {
  const raw = await redis(['LRANGE', LOG_KEY, '0', String(limit - 1)]);
  return (raw || []).map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
}
