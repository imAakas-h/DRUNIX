'use strict';
// Runs the API against the DEV ENGINE. These prove API wiring, validation, classification and the
// scenario logic. They do NOT prove Drunix behaviour: run test/drunix.smoke.md against a real network.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { createApp, makeLedger } = require('../server/index');
const { seedParticipants } = require('../server/seed');

const MODE = process.env.LEDGER_MODE || 'dev'; // LEDGER_MODE=drunix runs this same suite against the real network
const RUN = MODE === 'dev' ? '' : '-' + Date.now().toString(36); // on-chain references persist, so ids must be unique per run
const TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
let server, base, ledger; const tok = {};
const api = async (who, method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(who ? { authorization: 'Bearer ' + tok[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
test.before(async () => {
  if (MODE === 'drunix') {
    for (const id of ['OPERATOR', 'FINANCIER_A', 'FINANCIER_B', 'INSURER', 'AUDITOR']) process.env[`RASID_PASSWORD_${id}`] = TEST_PASSWORD;
  }
  process.env.LEDGER_MODE = MODE; ledger = makeLedger(); await seedParticipants(ledger);
  server = createApp({ ledger, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rasid-')), password: TEST_PASSWORD, secret: crypto.randomBytes(32).toString('hex'), allowedModes: ['dev', 'drunix'] }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  for (const id of ['OPERATOR', 'FINANCIER_A', 'FINANCIER_B', 'INSURER', 'AUDITOR']) tok[id] = (await api(null, 'POST', '/api/login', { identity: id, password: TEST_PASSWORD })).body.token;
});
test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await ledger?.close?.();
});

test('authentication is required and bad password is refused', async () => {
  assert.equal((await api(null, 'GET', '/api/receivables')).status, 401);
  assert.equal((await api(null, 'POST', '/api/login', { identity: 'OPERATOR', password: 'x' })).status, 401);
});

test('environment selection is server-authorised and constrained by its allowlist', async () => {
  const otherMode = MODE === 'dev' ? 'drunix' : 'dev';
  assert.equal((await api('FINANCIER_A', 'POST', '/api/network/mode', { mode: otherMode })).status, 403);
  const switched = await api('OPERATOR', 'POST', '/api/network/mode', { mode: otherMode });
  assert.equal(switched.status, 200);
  assert.equal(switched.body.mode, otherMode);
  if (otherMode === 'drunix') assert.equal(switched.body.status, 'CONFIGURATION REQUIRED');
  const restored = await api('OPERATOR', 'POST', '/api/network/mode', { mode: MODE });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.mode, MODE);
  const modes = await api('OPERATOR', 'GET', '/api/network/modes');
  assert.equal(modes.body.active, MODE);
  assert.deepEqual(modes.body.allowed, ['dev', 'drunix']);
});

test('manual flow: register, duplicate, accept, discount, transfer, rule failures', async () => {
  const reg = { fuId: 'FU-T1' + RUN, buyer: 'Buyer Ltd', invoiceNo: 'INV-1', amountPaise: 48000000, requestRef: 'T1:reg' + RUN };
  const T = '/api/receivables/FU-T1' + RUN; const r_ = (x) => 'T1:' + x + RUN;
  assert.equal((await api('OPERATOR', 'POST', '/api/receivables', reg)).body.outcome, 'ACCEPTED');
  const dup = await api('OPERATOR', 'POST', '/api/receivables', { ...reg, requestRef: r_('reg2') });
  assert.equal(dup.body.reasonCode, 'FU_EXISTS');
  assert.equal((await api('OPERATOR', 'POST', '/api/receivables', { ...reg, fuId: 'FU-T2' + RUN, invoiceNo: 'DUP-9', requestRef: 'T2:reg' + RUN })).body.reasonCode, 'SIMULATED_VERIFICATION_FAILED');
  assert.equal((await api('FINANCIER_A', 'POST', T + '/discount', { requestRef: r_('disc0') })).body.reasonCode, 'INVALID_LIFECYCLE');
  assert.equal((await api('OPERATOR', 'POST', T + '/accept', { requestRef: r_('acc') })).body.outcome, 'ACCEPTED');
  assert.equal((await api('FINANCIER_A', 'POST', T + '/discount', { requestRef: r_('disc') })).body.outcome, 'ACCEPTED');
  const t = { toHolderId: 'FINANCIER_B', amountPaise: 28800000, requestRef: r_('x1') };
  assert.equal((await api('FINANCIER_A', 'POST', T + '/transfers', t)).body.outcome, 'ACCEPTED');
  const s = (await api('AUDITOR', 'GET', T)).body;
  assert.deepEqual(s.positions.map((p) => [p.holderId, p.amountPaise]), [['FINANCIER_A', 19200000], ['FINANCIER_B', 28800000]]);
  assert.equal(s.unallocatedPaise, 0);
  assert.equal((await api('FINANCIER_A', 'POST', T + '/transfers', t)).body.reasonCode, 'REPLAYED_REFERENCE');
  assert.equal((await api('FINANCIER_A', 'POST', T + '/transfers', { ...t, amountPaise: 19200001, requestRef: r_('x2') })).body.reasonCode, 'INSUFFICIENT_POSITION');
  assert.equal((await api('FINANCIER_B', 'POST', T + '/transfers', { toHolderId: 'FINANCIER_A', amountPaise: 1.5, requestRef: r_('x3') })).body.reasonCode, 'INVALID_REQUEST');
  assert.equal((await api('INSURER', 'POST', T + '/transfers', { ...t, requestRef: r_('x4') })).body.reasonCode, 'ROLE_NOT_AUTHORISED');
  const audit = (await api('AUDITOR', 'GET', T + '/audit')).body;
  assert.ok(audit.onChain.length >= 4 && audit.attempts.some((a) => a.outcome === 'REJECTED_CHAINCODE'));
});

test('six-step demo: exactly one of two same-state sales commits; rules reject; settlement replay refused', async () => {
  const DFU = 'FU-2041' + RUN; const run = async (n) => (await api('OPERATOR', 'POST', `/api/demo/step/${n}`, { fuId: DFU })).body;
  await run(1); await run(2);
  const s3 = await run(3);
  assert.equal(s3.final.positions.find((p) => p.holderId === 'FINANCIER_B').amountPaise, 28800000);
  const s4 = await run(4);
  assert.equal(s4.exactlyOne, true);
  assert.deepEqual(s4.outcomes.map((o) => o.outcome).sort(), ['ACCEPTED', 'REJECTED_COMMIT']);
  assert.equal(s4.outcomes.find((o) => o.outcome === 'REJECTED_COMMIT').reasonCode, 'MVCC_READ_CONFLICT');
  assert.equal(s4.final.positions.reduce((a, p) => a + p.amountPaise, 0), 48000000);
  const s5 = await run(5);
  assert.deepEqual(s5.outcomes.map((o) => o.reasonCode), ['INSUFFICIENT_POSITION', 'NOT_A_HOLDER', 'INVALID_LIFECYCLE', 'REPLAYED_REFERENCE', 'ROLE_NOT_AUTHORISED']);
  const s6 = await run(6);
  assert.deepEqual(s6.outcomes.map((o) => o.outcome), ['ACCEPTED', 'REJECTED_CHAINCODE']);
  assert.equal(s6.outcomes[1].reasonCode, 'REPLAYED_REFERENCE');
  assert.ok(s6.final.positions.every((p) => p.amountPaise === 0) && s6.simulated.cersai.simulated);
  const ex = (await api('INSURER', 'GET', `/api/receivables/${DFU}/exposure`)).body;
  assert.equal(ex.simulated, true);
  // settlement after positions were already released: a NEW reference must still be refused (lifecycle), not just replays
  const late = (await api('OPERATOR', 'POST', `/api/receivables/${DFU}/settle`, {})).body;
  assert.equal(late.outcome, 'REJECTED_CHAINCODE'); assert.equal(late.reasonCode, 'INVALID_LIFECYCLE');
  // release after settlement is refused too
  assert.equal((await api('FINANCIER_B', 'POST', `/api/receivables/${DFU}/release`, { amountPaise: 100, requestRef: 'rel:' + DFU })).body.reasonCode, 'INVALID_LIFECYCLE');
  // application audit log is intact (hash chain)
  assert.equal((await api('AUDITOR', 'GET', '/api/audit/verify')).body.ok, true);
  assert.equal((await api('FINANCIER_A', 'GET', '/api/audit/verify')).status, 403);
  assert.equal((await api('FINANCIER_A', 'POST', '/api/demo/step/1', {})).status, 403);
  const m = (await api('AUDITOR', 'GET', '/api/metrics')).body; assert.ok(m.samples > 0 && m.mode === 'dev');
});
