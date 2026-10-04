// Remembers a shopper's Meta ad click (fbc, plus fbp) against their email and
// phone, so a Purchase can still carry the ClickID when the click and the
// purchase happen in different browsers.
//
// The common case: someone taps an ad inside the Instagram/Facebook app,
// lands in its in-app browser, starts checkout and types their email — then
// leaves, and buys later in Safari or Chrome (often from a reminder email).
// No cookie or localStorage survives that hop, so without this the Purchase
// goes out with no fbc and Meta can't tie it back to the ad. Their email
// does survive it.
//
// Keys are the same SHA-256 hashes Meta receives (lib/metaCapi.js), so no
// plain email or phone is stored here. Each entry expires when its click
// leaves Meta's 90-day window, after which Meta wouldn't honor it anyway.

import { hashEmail, hashPhone, validFbc, validFbp, fbcCreatedAt } from './metaCapi';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const FBC_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function keysFor({ email, phone }) {
  const em = hashEmail(email);
  const ph = hashPhone(phone);
  return [em && `meta_click:em:${em}`, ph && `meta_click:ph:${ph}`].filter(Boolean);
}

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

// The most recent click known for this email or phone, or null.
export async function lookupMetaClick({ email, phone } = {}) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const found = (await Promise.all(keysFor({ email, phone }).map(kvGet)))
      .filter((entry) => validFbc(entry?.fbc));
    found.sort((a, b) => fbcCreatedAt(b.fbc) - fbcCreatedAt(a.fbc));
    return found[0] || null;
  } catch (err) {
    console.error('Meta click lookup failed:', err.message);
    return null;
  }
}

// Saves the click for this email/phone. A newer click replaces an older one
// (the latest ad is the one that brought them back); an older one never
// overwrites a newer one. Never throws — a lost write only costs a match.
export async function rememberMetaClick({ email, phone, fbc, fbp } = {}) {
  const cleanFbc = validFbc(fbc);
  if (!KV_URL || !KV_TOKEN || !cleanFbc) return;
  const ttlSeconds = Math.floor((fbcCreatedAt(cleanFbc) + FBC_MAX_AGE_MS - Date.now()) / 1000);
  if (ttlSeconds <= 0) return;
  const cleanFbp = validFbp(fbp);
  try {
    await Promise.all(keysFor({ email, phone }).map(async (key) => {
      const existing = await kvGet(key);
      if (validFbc(existing?.fbc) && fbcCreatedAt(existing.fbc) > fbcCreatedAt(cleanFbc)) return;
      await fetch(`${KV_URL}/set/${key}?EX=${ttlSeconds}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        body: JSON.stringify({ fbc: cleanFbc, ...(cleanFbp ? { fbp: cleanFbp } : {}) }),
      });
    }));
  } catch (err) {
    console.error('Meta click save failed:', err.message);
  }
}
