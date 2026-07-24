// Client-side address-suggestion lookup via Radar's Autocomplete API
// (https://radar.com) — as a shopper types into the checkout Address
// field, this returns candidate full addresses; selecting one fills
// address/city/state/ZIP automatically instead of typing every field by
// hand. Requires NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY — Radar's client-safe
// "publishable" key, meant to be exposed in the browser (same pattern as a
// Stripe publishable key), not the secret key.
//
// Endpoint/response shape (Authorization header takes the raw publishable
// key, no "Bearer" prefix; response is { addresses: [...] } with
// formattedAddress/number/street/city/stateCode/postalCode per result) is
// Radar's long-stable, publicly documented Autocomplete API contract —
// unverified against a real key from this session, so treat as unverified
// until tested with a real NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY end-to-end.
//
// Fails silently (returns an empty list) on any error — missing key,
// network failure, non-OK response — so a slow or unavailable autocomplete
// service never blocks manual address entry, which always still works
// regardless of whether this succeeds.
const MIN_QUERY_LENGTH = 4;

export async function fetchAddressSuggestions(query) {
  const apiKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY;
  if (!apiKey || !query || query.trim().length < MIN_QUERY_LENGTH) return [];

  try {
    const params = new URLSearchParams({
      query,
      countryCode: 'US',
      limit: '5',
      layers: 'address',
    });
    const res = await fetch(`https://api.radar.io/v1/search/autocomplete?${params}`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.addresses || []).map((a) => ({
      label: a.formattedAddress || [a.addressLabel, a.city, a.stateCode].filter(Boolean).join(', '),
      address: [a.number, a.street].filter(Boolean).join(' ').trim() || a.addressLabel || '',
      city: a.city || '',
      state: a.stateCode || a.state || '',
      zip: a.postalCode || '',
    }));
  } catch {
    return [];
  }
}
