#!/usr/bin/env node
// Bulk-duplicates one Meta ad set, swapping in a different creative on each
// copy — for launching several creative variants off the same targeting/
// budget/schedule without rebuilding the ad set by hand each time.
//
// This is a standalone script (not part of the deployed site) that talks
// directly to Meta's Marketing API using a Marketing-API-scoped access
// token (ads_management permission) — a different token from the
// META_CAPI_ACCESS_TOKEN used elsewhere in this repo, which only has
// conversions-event permission and can't manage ads at all.
//
// Safety defaults, because this spends real money if misused:
//   - Every duplicate is always created PAUSED, regardless of --publish.
//   - --publish only flips existing, already-verified-good duplicates to
//     ACTIVE, as a separate explicit step, and asks for a y/n confirmation
//     naming exactly which ad sets are about to go live before doing it.
//   - Any single creative failing (bad ID, API error) is logged and
//     skipped — it does not abort the rest of the batch or leave a
//     half-configured ad set active.
//
// Usage:
//   META_MARKETING_ACCESS_TOKEN=xxx node scripts/duplicate-adset.js config.json
//   META_MARKETING_ACCESS_TOKEN=xxx node scripts/duplicate-adset.js config.json --publish
//
// config.json shape — see scripts/duplicate-adset.example.json:
//   {
//     "adAccountId": "act_1234567890",
//     "sourceAdSetId": "23851XXXXXXXXXX",
//     "creatives": [
//       { "creativeId": "23851YYYYYYYYYY", "label": "hook-a" },
//       { "creativeId": "23851ZZZZZZZZZZ", "label": "hook-b" }
//     ]
//   }
//
// API version: pinned below as GRAPH_VERSION. Meta deprecates old Marketing
// API versions on a rolling schedule — if calls start failing with a
// version-related error, bump this to whatever's current at
// developers.facebook.com/docs/graph-api/changelog before assuming
// anything else is wrong.

const fs = require('fs');
const readline = require('readline');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphRequest(path, { method = 'GET', token, body } = {}) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const isForm = method !== 'GET';
  if (!isForm) url.searchParams.set('access_token', token);

  const res = await fetch(url, {
    method,
    headers: isForm ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    body: isForm ? new URLSearchParams({ ...body, access_token: token }) : undefined,
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const message = data.error?.message || `Graph API request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// Duplicates the source ad set (and its ads, via deep_copy) as PAUSED,
// tagging the name with the creative's label so it's identifiable in Ads
// Manager. Returns the new ad set id.
async function copyAdSet({ sourceAdSetId, token, label }) {
  const data = await graphRequest(`/${sourceAdSetId}/copies`, {
    method: 'POST',
    token,
    body: {
      deep_copy: 'true',
      status_option: 'PAUSED',
      rename_options: JSON.stringify({
        rename_suffix: ` — ${label}`,
        rename_strategy: 'DEEP_RENAME',
      }),
    },
  });
  return data.ad_set_id || data.copied_ad_set_id;
}

async function getAdsInAdSet({ adSetId, token }) {
  const data = await graphRequest(`/${adSetId}/ads?fields=id,name`, { token });
  return data.data || [];
}

async function setAdCreative({ adId, creativeId, token }) {
  await graphRequest(`/${adId}`, {
    method: 'POST',
    token,
    body: { creative: JSON.stringify({ creative_id: creativeId }) },
  });
}

async function setStatus({ id, status, token }) {
  await graphRequest(`/${id}`, { method: 'POST', token, body: { status } });
}

async function confirmPublish(adSetIds) {
  console.log('\nAbout to set these ad sets to ACTIVE (real ad spend starts immediately):');
  adSetIds.forEach((id) => console.log(`  - ${id}`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question('Type "yes" to continue: ', resolve));
  rl.close();
  return answer.trim().toLowerCase() === 'yes';
}

async function main() {
  const configPath = process.argv[2];
  const publish = process.argv.includes('--publish');

  if (!configPath) {
    console.error('Usage: node scripts/duplicate-adset.js <config.json> [--publish]');
    process.exit(1);
  }

  const token = process.env.META_MARKETING_ACCESS_TOKEN;
  if (!token) {
    console.error('META_MARKETING_ACCESS_TOKEN is not set.');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { sourceAdSetId, creatives } = config;
  if (!sourceAdSetId) throw new Error('config.sourceAdSetId is required.');
  if (!Array.isArray(creatives) || creatives.length === 0) {
    throw new Error('config.creatives must be a non-empty array of { creativeId, label }.');
  }

  const results = [];

  for (const { creativeId, label } of creatives) {
    console.log(`\n--- ${label} (creative ${creativeId}) ---`);
    try {
      const newAdSetId = await copyAdSet({ sourceAdSetId, token, label });
      console.log(`  Duplicated ad set -> ${newAdSetId} (paused)`);

      const ads = await getAdsInAdSet({ adSetId: newAdSetId, token });
      if (ads.length === 0) {
        console.warn('  No ads found in the duplicated ad set — nothing to swap creative on.');
      }
      for (const ad of ads) {
        await setAdCreative({ adId: ad.id, creativeId, token });
        console.log(`  Set creative on ad ${ad.id} (${ad.name})`);
      }

      results.push({ label, adSetId: newAdSetId, ok: true });
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
      results.push({ label, ok: false, error: err.message });
    }
    // Small gap between iterations to stay well clear of rate limits.
    await sleep(500);
  }

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(r.ok ? `✓ ${r.label} -> ${r.adSetId} (paused)` : `✗ ${r.label} -> FAILED: ${r.error}`);
  }

  const succeeded = results.filter((r) => r.ok);
  if (succeeded.length === 0) {
    console.log('\nNothing succeeded — nothing to publish.');
    return;
  }

  if (!publish) {
    console.log('\nAll duplicates left PAUSED. Re-run with --publish once you\'ve reviewed them in Ads Manager to make them live.');
    return;
  }

  const confirmed = await confirmPublish(succeeded.map((r) => r.adSetId));
  if (!confirmed) {
    console.log('Not confirmed — leaving all duplicates paused.');
    return;
  }

  for (const r of succeeded) {
    try {
      await setStatus({ id: r.adSetId, status: 'ACTIVE', token });
      console.log(`  Published ${r.label} (${r.adSetId})`);
    } catch (err) {
      console.error(`  Failed to publish ${r.label} (${r.adSetId}): ${err.message}`);
    }
    await sleep(500);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
