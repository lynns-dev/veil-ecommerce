#!/usr/bin/env node
// Registers/verifies a domain for Apple Pay on Square via the API — the
// same action as clicking "Verify" next to a domain under Apple Pay in the
// Square Developer Dashboard, for when that button doesn't work.
//
// Square's own account of what this does (from the Node SDK's docs on
// applePay.registerDomain): it asks Apple to fetch and check the domain
// verification file Square already gave you, which must already be hosted
// at https://<domain>/.well-known/apple-developer-merchantid-domain-association
// (this repo hosts it at public/.well-known/apple-developer-merchantid-domain-association).
// That file can go stale — Square's docs warn it changes over time — so if
// this keeps failing, re-download the current version from
// https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association
// and replace the hosted copy before retrying.
//
// Uses the same SQUARE_ACCESS_TOKEN / SQUARE_ENVIRONMENT env vars as
// lib/squareServer.js — run this with your production credentials loaded
// (e.g. `vercel env pull` first, or export them inline) since Apple Pay
// only ever verifies against your live domain.
//
// Usage:
//   SQUARE_ACCESS_TOKEN=xxx SQUARE_ENVIRONMENT=production node scripts/register-apple-pay-domain.js veilpuff.com

const { SquareClient, SquareEnvironment } = require('square');

const domainName = process.argv[2];
if (!domainName) {
  console.error('Usage: node scripts/register-apple-pay-domain.js <domain>');
  process.exit(1);
}

const token = process.env.SQUARE_ACCESS_TOKEN;
if (!token) {
  console.error('SQUARE_ACCESS_TOKEN is not set.');
  process.exit(1);
}

const client = new SquareClient({
  environment: process.env.SQUARE_ENVIRONMENT === 'sandbox' ? SquareEnvironment.Sandbox : SquareEnvironment.Production,
  token,
});

(async () => {
  try {
    const response = await client.applePay.registerDomain({ domainName });
    console.log(JSON.stringify(response, null, 2));
    if (response.status !== 'VERIFIED') {
      console.error(`\nDomain not verified (status: ${response.status || 'unknown'}). Most likely cause: the domain verification file hosted at https://${domainName}/.well-known/apple-developer-merchantid-domain-association is missing, stale, or not reachable from the public internet — re-download it from https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association and redeploy before retrying.`);
      process.exit(1);
    }
    console.log(`\n${domainName} verified for Apple Pay.`);
  } catch (err) {
    console.error('Register domain failed:', JSON.stringify(err?.errors || err?.message || err, null, 2));
    process.exit(1);
  }
})();
