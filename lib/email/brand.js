// Which store this email setup belongs to. Everything else in lib/email/
// is shared, unmodified, between the veil-ecommerce and anese repos — only
// this file (and automationsStore.js's starter flows) differ per store.
export const BRAND = {
  id: 'veil',
  name: 'VEIL',
  siteUrl: 'https://veilpuff.com',
  logoUrl: 'https://veilpuff.com/images/veil-logo-black.png',
  // The other store's branding — see lib/email/brandRepair.js.
  foreignMarkers: [/aneseskin/i, /\bANESE\b/],
};
