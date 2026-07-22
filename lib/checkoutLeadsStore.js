// Emails captured at checkout before an order completes, so ad-driven
// abandons still end up somewhere useful (a subscriber list) instead of
// being lost the moment someone closes the tab. Stored as one JSON list,
// same pattern as lib/discountsStore.js — this collection is small and
// read infrequently, so it doesn't need day-bucketing like the order
// ledger in lib/analyticsStore.js does.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'checkout_leads';

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  }
}

async function saveLeads(leads) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(leads),
  });
  if (!res.ok) throw new Error('Failed to save checkout leads.');
}

export async function getLeads() {
  assertConfigured();
  const res = await fetch(`${KV_URL}/get/${KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

// Upserts by email — typing the email field twice, or entering checkout
// again through a different funnel page, updates the same entry instead of
// creating duplicates. A lead that's already 'purchased' never gets
// demoted back to 'abandoned' by a later call.
export async function recordLead({ email, cart, source, sessionId, url, status = 'abandoned' }) {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return null;

  const leads = await getLeads();
  const idx = leads.findIndex((l) => l.email === trimmed);
  const now = new Date().toISOString();

  if (idx === -1) {
    const lead = {
      email: trimmed,
      status,
      cart: cart || [],
      source: source || null,
      sessionId: sessionId || null,
      url: url || null,
      firstSeenAt: now,
      lastSeenAt: now,
      ...(status === 'purchased' ? { purchasedAt: now } : {}),
    };
    await saveLeads([...leads, lead]);
    return lead;
  }

  const existing = leads[idx];
  const nextStatus = existing.status === 'purchased' ? 'purchased' : status;
  const updated = {
    ...existing,
    status: nextStatus,
    cart: cart || existing.cart,
    source: source || existing.source,
    url: url || existing.url,
    lastSeenAt: now,
    ...(nextStatus === 'purchased' && !existing.purchasedAt ? { purchasedAt: now } : {}),
  };
  leads[idx] = updated;
  await saveLeads(leads);
  return updated;
}
