import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const storage = new Map();
const orders = [];
let fulfills = 0;
const origin = 'https://veilpuff.com';
const pending = { origin, stripeSessionId: 'cs_test_ok', amount: 42, items: [{ id: 'item', quantity: 1, price: 42 }], eventId: 'evt' };
const session = { id: 'cs_test_ok', livemode: false, metadata: { origin }, payment_status: 'paid', client_reference_id: 'ref', currency: 'usd', amount_total: 4200, payment_intent: 'pi_test' };
const context = vm.createContext({ process: { env: { STRIPE_CHECKOUT_ORIGIN: origin, STRIPE_CHECKOUT_MODE: 'test' } }, URL, Intl, Date, console,
  getCheckoutStripe: () => ({ checkout: { sessions: { retrieve: async () => session } } }),
  fulfillOrder: async order => { fulfills++; orders.push(order); }, getOrders: async () => orders,
  fetch: async (_, options) => { const [cmd, key, value, ...args] = JSON.parse(options.body); let result;
    if (cmd === 'GET') result = storage.get(key) || null;
    if (cmd === 'SET') { if (args.includes('NX') && storage.has(key)) result = null; else { storage.set(key, value); result = 'OK'; } }
    if (cmd === 'DEL') { storage.delete(key); result = 1; }
    return { ok: true, json: async () => ({ result }) };
  }
});
const source = fs.readFileSync(new URL('../lib/stripeCheckout.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', '');
vm.runInContext(source + '\nglobalThis.complete = completeStripeSession;', context);
storage.set('stripe:pending:ref', JSON.stringify(pending));
assert.equal(await context.complete({ ...session, payment_status: 'unpaid' }, {}), null);
assert.equal(fulfills, 0);
await assert.rejects(context.complete({ ...session, metadata: { origin: 'https://other.com' } }, {}), /another store/);
await assert.rejects(context.complete({ ...session, amount_total: 1 }, {}), /total mismatch/);
await assert.rejects(context.complete({ ...session, id: 'cs_test_other' }, {}), /identity mismatch/);
const purchase = await context.complete(session, {});
assert.equal(purchase.orderId, 'pi_test');
assert.equal(fulfills, 1);
await context.complete(session, {});
assert.equal(fulfills, 1, 'Replay must not fulfill twice');
console.log('Stripe fulfillment guards and replay tests passed. No external services called.');
