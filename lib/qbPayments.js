// QuickBooks Payments client-side card tokenization.
//
// Calls Intuit's Payments "tokens" REST endpoint directly from the browser
// with the raw card details, so the card number never touches our own
// server (keeps the site out of full PCI card-data scope). This endpoint
// takes no Authorization header by design — it's meant to be called
// client-side. The resulting one-time token is then sent to
// /api/qb-checkout, which charges it server-side via the QuickBooks
// Payments Charges API.
//
// Endpoint version: /v5/payments/tokens, not the /v4/... path used
// elsewhere in this codebase's git history. This came from a summary the
// user pasted whose provenance is uncertain (it reads like an AI-generated
// answer, not a scraped doc page — no attribute tables, ends with "tell me
// your language and I'll write a snippet") and conflicts with /v4, which
// has been creating valid tokens all day without error. If charges start
// failing at the tokenize step specifically (not the risk-engine auto-void
// that's a separate, already-known account issue), revert this one line
// back to /v4/payments/tokens first before looking anywhere else.
//
// This is the same integration that hit an unresolved 403 on the Charges
// API in an earlier attempt on this site (see git history) — restored here
// alongside Stripe rather than replacing it, but treat it as unverified
// until a real sandbox charge has gone through end-to-end.

const API_BASE = {
  sandbox: 'https://sandbox.api.intuit.com',
  production: 'https://api.intuit.com',
};

// card: { number, expMonth, expYear, cvc, name, postalCode, street, city, region, country }
// Resolves to a single-use card token string.
export async function tokenizeCard(card, environment = 'sandbox') {
  const base = API_BASE[environment] || API_BASE.sandbox;

  const res = await fetch(`${base}/quickbooks/v5/payments/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Request-Id': `veil-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    },
    body: JSON.stringify({
      card: {
        number: card.number.replace(/\s+/g, ''),
        expMonth: card.expMonth,
        expYear: card.expYear,
        cvc: card.cvc,
        name: card.name,
        address: {
          streetAddress: card.street,
          city: card.city,
          region: card.region,
          postalCode: card.postalCode,
          country: card.country || 'US',
        },
      },
    }),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Card tokenization failed (${res.status}): ${raw.slice(0, 200) || 'empty response'}`);
  }
  if (!res.ok || !data.value) {
    throw new Error(data?.errors?.[0]?.detail || data?.error || `Card tokenization failed (${res.status})`);
  }
  return data.value;
}
