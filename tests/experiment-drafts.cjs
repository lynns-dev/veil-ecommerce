const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = new Map();
let requests = 0;
const context = vm.createContext({
  URLSearchParams, console, process: { env: {} }, React: {}, getSessionId: () => 'test-session',
  fetch: () => { requests++; throw new Error('Draft must not send tracking'); },
  window: { location: { search: '' }, localStorage: { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) } },
});
function source(path) { return fs.readFileSync(path, 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, ''); }
vm.runInContext(source('lib/experiments.js') + '\nthis.api = { EXPERIMENTS, getVariant, exposeExperiment, exposedExperiments, trackExpStep };', context);
const { api } = context;
const drafts = ['cart_checkout_cta_v1', 'cart_shipping_clarity_v1', 'cart_discount_confirmation_v1'];
for (const id of drafts) {
  assert.equal(api.EXPERIMENTS[id].status, 'running');
  assert.equal(api.EXPERIMENTS[id].started, '2026-11-07');
  const variant = api.getVariant(id);
  assert.ok(api.EXPERIMENTS[id].variants.includes(variant));
  assert.equal(api.getVariant(id), variant, 'Running tests retain assignments');
  api.EXPERIMENTS[id].status = 'draft';
}
assert.equal(drafts.length, 3);
for (const id of drafts) {
  const treatment = api.EXPERIMENTS[id].variants[1];
  data.set(`veil-exp:${id}`, treatment);
  assert.equal(api.getVariant(id), 'control', 'Draft ignores persisted assignments');
  context.window.location.search = `?exp_${id}=${treatment}`;
  data.delete(`veil-exp:${id}`);
  assert.equal(api.getVariant(id), treatment, 'Explicit URL previews the treatment');
  assert.equal(data.has(`veil-exp:${id}`), false, 'Preview is not persisted');
  api.exposeExperiment(id);
  data.set(`veil-exp-seen:${id}`, treatment);
  assert.equal(api.exposedExperiments()[id], undefined, 'Draft excluded from outcome attribution');
}
api.trackExpStep('purchased', { subtotal: 45 });
assert.equal(requests, 0);
context.window.location.search = '';
assert.equal(api.getVariant('unknown'), 'control');
const firstActive = api.getVariant('pdp_proof');
assert.equal(api.getVariant('pdp_proof'), firstActive, 'Existing tests retain sticky assignment');
vm.runInContext(source('lib/experimentsStore.js') + '\nthis.server = { recordExposure, recordExperimentStep };', context);
(async () => {
  for (const id of drafts) {
    const variant = api.EXPERIMENTS[id].variants[1];
    await context.server.recordExposure(id, variant, 'visitor-123');
    await context.server.recordExperimentStep({ [id]: variant }, 'purchased', 'visitor-123', { subtotal: 45 });
  }
  assert.equal(requests, 0, 'Server rejects draft tracking before contacting KV');
  console.log('Passed: 3 draft tests, control defaults, explicit previews, no sticky previews, client/server tracking exclusion, existing sticky assignment.');
})().catch(err => { console.error(err); process.exitCode = 1; });
