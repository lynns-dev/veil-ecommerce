#!/usr/bin/env node
// Bulk-duplicates one Meta ad set, uploading a batch of new images/videos
// and creating one ad-set copy per creative — for launching several visual
// variants off the same targeting/budget/schedule/ad copy without
// rebuilding anything by hand.
//
// Also includes lookup commands (--list-accounts, --list-adsets) so you
// don't have to go hunting for numeric IDs in Ads Manager — see Usage.
//
// This is a standalone script (not part of the deployed site) that talks
// directly to Meta's Marketing API using a Marketing-API-scoped access
// token (ads_management permission) — a different token from the
// META_CAPI_ACCESS_TOKEN used elsewhere in this repo, which only has
// conversions-event permission and can't manage ads at all.
//
// New creatives reuse the source ad set's existing ad copy (message,
// headline, link, call-to-action, Page) exactly — only the image/video
// changes. If you need different copy per creative too, this script
// doesn't support that; ask for it to be extended rather than hand-editing
// object_story_spec here, since a mistake in that object is easy to make
// and hard to notice until an ad's already live with the wrong link/copy.
//
// Safety defaults, because this spends real money if misused:
//   - Every duplicate is always created PAUSED, regardless of --publish.
//   - --publish only flips existing, already-verified-good duplicates to
//     ACTIVE, as a separate explicit step, and asks for a y/n confirmation
//     naming exactly which ad sets are about to go live before doing it.
//   - Any single creative failing (bad file, API error) is logged and
//     skipped — it does not abort the rest of the batch or leave a
//     half-configured ad set active.
//
// Usage:
//   META_MARKETING_ACCESS_TOKEN=xxx node scripts/duplicate-adset.js --list-accounts
//   META_MARKETING_ACCESS_TOKEN=xxx node scripts/duplicate-adset.js --list-adsets act_1234567890
//   META_MARKETING_ACCESS_TOKEN=xxx node scripts/duplicate-adset.js config.json
//   META_MARKETING_ACCESS_TOKEN=xxx node scripts/duplicate-adset.js config.json --publish
//
// config.json shape — see scripts/duplicate-adset.example.json:
//   {
//     "adAccountId": "act_1234567890",
//     "sourceAdSetId": "23851XXXXXXXXXX",
//     "creatives": [
//       { "mediaPath": "/path/to/video1.mp4", "label": "hook-a" },
//       { "mediaPath": "/path/to/image1.jpg", "label": "hook-b" }
//     ]
//   }
//
// Unverified / worth confirming before trusting on a real batch: the image
// upload (base64 `bytes` param) and video upload (multipart `source` file
// field) parameter names below are from general knowledge of the Marketing
// API, not tested against a live account or checked against current docs.
// Test with exactly ONE image first — cheapest and fastest to notice if
// something's off — before running a full batch or trusting video uploads.
// If a video's source had an auto-generated thumbnail, the new creative
// reuses that same thumbnail image, which will look mismatched against the
// new video's actual footage — check/replace it manually in Ads Manager
// after creation if that matters for how the ad looks.
//
// API version: pinned below as GRAPH_VERSION. Meta deprecates old Marketing
// API versions on a rolling schedule — if calls start failing with a
// version-related error, bump this to whatever's current at
// developers.facebook.com/docs/graph-api/changelog before assuming
// anything else is wrong.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v']);
const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphRequest(pathSuffix, { method = 'GET', token, body, formData } = {}) {
  const url = new URL(`${GRAPH_BASE}${pathSuffix}`);
  if (method === 'GET') url.searchParams.set('access_token', token);

  let fetchOptions = { method };
  if (formData) {
    formData.append('access_token', token);
    fetchOptions.body = formData;
  } else if (method !== 'GET') {
    fetchOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    fetchOptions.body = new URLSearchParams({ ...body, access_token: token });
  }

  const res = await fetch(url, fetchOptions);
  const data = await res.json();
  if (!res.ok || data.error) {
    const message = data.error?.message || `Graph API request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// --- Lookup helpers -------------------------------------------------------

async function listAccounts(token) {
  const data = await graphRequest('/me/adaccounts?fields=account_id,name,id', { token });
  console.log('\nAd accounts available to this token:');
  for (const a of data.data || []) {
    console.log(`  ${a.id}   ${a.name || '(no name)'}`);
  }
  if (!data.data?.length) console.log('  (none found — check the token has ads_management/ads_read permission)');
}

async function listAdSets(token, adAccountId) {
  const data = await graphRequest(`/${adAccountId}/adsets?fields=id,name,status&limit=100`, { token });
  console.log(`\nAd sets in ${adAccountId}:`);
  for (const s of data.data || []) {
    console.log(`  ${s.id}   [${s.status}]   ${s.name}`);
  }
  if (!data.data?.length) console.log('  (none found)');
}

// --- Media upload -----------------------------------------------------------

async function uploadImage({ adAccountId, filePath, token }) {
  const bytes = fs.readFileSync(filePath).toString('base64');
  const data = await graphRequest(`/${adAccountId}/adimages`, {
    method: 'POST',
    token,
    body: { bytes },
  });
  const firstKey = Object.keys(data.images || {})[0];
  const hash = data.images?.[firstKey]?.hash;
  if (!hash) throw new Error('Image upload succeeded but no hash came back — response shape may have changed.');
  return { type: 'image', hash };
}

async function uploadVideo({ adAccountId, filePath, token }) {
  const form = new FormData();
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  form.append('source', new Blob([buffer], { type: MIME_TYPES[ext] || 'video/mp4' }), path.basename(filePath));
  const data = await graphRequest(`/${adAccountId}/advideos`, { method: 'POST', token, formData: form });
  if (!data.id) throw new Error('Video upload succeeded but no video id came back — response shape may have changed.');
  return { type: 'video', videoId: data.id };
}

async function uploadMedia({ adAccountId, filePath, token }) {
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return uploadVideo({ adAccountId, filePath, token });
  return uploadImage({ adAccountId, filePath, token });
}

// --- Creative + ad set duplication -----------------------------------------

// Reads the source ad set's first ad's creative, so new creatives can copy
// its object_story_spec (page, message, link, CTA) exactly and just swap
// the visual.
async function getSourceCreativeSpec({ sourceAdSetId, token }) {
  const ads = await graphRequest(`/${sourceAdSetId}/ads?fields=id,creative{id}`, { token });
  const firstAd = ads.data?.[0];
  if (!firstAd?.creative?.id) throw new Error('Source ad set has no ads with a creative to copy ad copy from.');
  const creative = await graphRequest(`/${firstAd.creative.id}?fields=name,object_story_spec`, { token });
  if (!creative.object_story_spec) throw new Error('Source creative has no object_story_spec to copy.');
  return creative;
}

// Builds a new creative from the source's object_story_spec with the media
// swapped in, and creates it via the Ad Creatives API.
async function createCreativeFromMedia({ adAccountId, sourceSpec, media, label, token }) {
  const spec = JSON.parse(JSON.stringify(sourceSpec.object_story_spec));

  if (media.type === 'image') {
    if (spec.link_data) spec.link_data.image_hash = media.hash;
    else if (spec.photo_data) spec.photo_data.image_hash = media.hash;
    else throw new Error('Source creative spec has neither link_data nor photo_data — cannot swap in an image.');
  } else {
    if (!spec.video_data) throw new Error('Source creative spec has no video_data — cannot swap in a video on an image-based creative.');
    spec.video_data.video_id = media.videoId;
    // Reuses whatever thumbnail the source had, if any — see the caveat at
    // the top of this file about it likely not matching the new footage.
  }

  const data = await graphRequest(`/${adAccountId}/adcreatives`, {
    method: 'POST',
    token,
    body: {
      name: `${sourceSpec.name || 'Creative'} — ${label}`,
      object_story_spec: JSON.stringify(spec),
    },
  });
  return data.id;
}

async function copyAdSet({ sourceAdSetId, token, label }) {
  const data = await graphRequest(`/${sourceAdSetId}/copies`, {
    method: 'POST',
    token,
    body: {
      deep_copy: 'true',
      status_option: 'PAUSED',
      rename_options: JSON.stringify({ rename_suffix: ` — ${label}`, rename_strategy: 'DEEP_RENAME' }),
    },
  });
  return data.ad_set_id || data.copied_ad_set_id;
}

async function getAdsInAdSet({ adSetId, token }) {
  const data = await graphRequest(`/${adSetId}/ads?fields=id,name`, { token });
  return data.data || [];
}

async function setAdCreative({ adId, creativeId, token }) {
  await graphRequest(`/${adId}`, { method: 'POST', token, body: { creative: JSON.stringify({ creative_id: creativeId }) } });
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

// --- Main -------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const token = process.env.META_MARKETING_ACCESS_TOKEN;
  if (!token) {
    console.error('META_MARKETING_ACCESS_TOKEN is not set.');
    process.exit(1);
  }

  if (args[0] === '--list-accounts') {
    await listAccounts(token);
    return;
  }
  if (args[0] === '--list-adsets') {
    if (!args[1]) throw new Error('Usage: --list-adsets act_XXXXXXXXXX');
    await listAdSets(token, args[1]);
    return;
  }

  const configPath = args[0];
  const publish = args.includes('--publish');
  if (!configPath) {
    console.error('Usage:\n  node scripts/duplicate-adset.js --list-accounts\n  node scripts/duplicate-adset.js --list-adsets act_XXXXXXXXXX\n  node scripts/duplicate-adset.js <config.json> [--publish]');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { adAccountId, sourceAdSetId, creatives } = config;
  if (!adAccountId) throw new Error('config.adAccountId is required.');
  if (!sourceAdSetId) throw new Error('config.sourceAdSetId is required.');
  if (!Array.isArray(creatives) || creatives.length === 0) {
    throw new Error('config.creatives must be a non-empty array of { mediaPath, label }.');
  }

  console.log('Reading source ad copy to reuse on every duplicate...');
  const sourceSpec = await getSourceCreativeSpec({ sourceAdSetId, token });
  console.log(`  Using ad copy from creative "${sourceSpec.name || sourceSpec.object_story_spec ? '(unnamed)' : ''}"`);

  const results = [];

  for (const { mediaPath, label } of creatives) {
    console.log(`\n--- ${label} (${mediaPath}) ---`);
    try {
      if (!fs.existsSync(mediaPath)) throw new Error(`File not found: ${mediaPath}`);

      const media = await uploadMedia({ adAccountId, filePath: mediaPath, token });
      console.log(`  Uploaded ${media.type} -> ${media.hash || media.videoId}`);

      const creativeId = await createCreativeFromMedia({ adAccountId, sourceSpec, media, label, token });
      console.log(`  Created creative -> ${creativeId}`);

      const newAdSetId = await copyAdSet({ sourceAdSetId, token, label });
      console.log(`  Duplicated ad set -> ${newAdSetId} (paused)`);

      const ads = await getAdsInAdSet({ adSetId: newAdSetId, token });
      if (ads.length === 0) console.warn('  No ads found in the duplicated ad set — nothing to swap creative on.');
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
    await sleep(1000);
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
