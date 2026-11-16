'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SimulationLedger } = require('../server/ledger-simulation');
const { seedParticipants } = require('../server/seed');
const { seedDemoReceivables } = require('../server/demo-seed');
const { createApp } = require('../server/index');

test('simulation blocks persist, link by hash, and detect tampering', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rasid-simulation-ledger-'));
  const filePath = path.join(dir, 'ledger.json');
  try {
    const ledger = new SimulationLedger({ filePath });
    await seedParticipants(ledger);
    await seedDemoReceivables(ledger);
    const before = ledger.snapshot();
    assert.ok(before.length > 10);
    assert.equal(before[0].previousHash, '0'.repeat(64));
    assert.equal(before[1].previousHash, before[0].hash);
    assert.equal(ledger.verify().ok, true);

    const reopened = new SimulationLedger({ filePath });
    assert.equal(reopened.snapshot().length, before.length);
    assert.equal(reopened.snapshot().at(-1).hash, before.at(-1).hash);
    assert.equal((await reopened.query('AUDITOR', 'ListFactoringUnits', [])).length, 5);

    const original = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const changedState = structuredClone(original);
    changedState.state[0][1].value.cn = 'tampered';
    fs.writeFileSync(filePath, JSON.stringify(changedState));
    assert.throws(() => new SimulationLedger({ filePath }), /integrity check failed.*ledger state/);

    const corrupted = structuredClone(original);
    corrupted.blocks[0].transactions[0].data.writes += 1;
    fs.writeFileSync(filePath, JSON.stringify(corrupted));
    assert.throws(() => new SimulationLedger({ filePath }), /integrity check failed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('simulation APIs run a full guided lifecycle and reset only demo data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rasid-simulation-api-'));
  const ledger = new SimulationLedger({ filePath: path.join(dir, 'ledger.json') });
  await seedParticipants(ledger);
  await seedDemoReceivables(ledger);
  const app = createApp({
    ledger,
    dataDir: path.join(dir, 'app-data'),
    password: 'demo-password',
    secret: 'test-secret-with-more-than-thirty-two-characters',
    allowedModes: ['simulation'],
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  let token;
  const request = async (method, route, body) => {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    const login = await request('POST', '/api/login', { identity: 'OPERATOR', password: 'demo-password' });
    assert.equal(login.status, 200);
    token = login.data.token;

    const initial = await request('GET', '/api/ledger/summary');
    assert.equal(initial.data.simulated, true);
    assert.equal(initial.data.totalReceivables, 5);
    const health = await request('GET', '/api/network/health');
    assert.equal(health.data.mode, 'simulation');
    assert.equal(health.data.status, 'SIMULATION READY');
    assert.equal(health.data.networkName, 'Simulated Fabric Network');
    const invalid = await request('POST', '/api/receivables/FU-DEMO-1004/accept', { requestRef: 'simulation:invalid-accept' });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.data.reasonCode, 'INVALID_LIFECYCLE');
    assert.match(invalid.data.txId, /^SIM-/);
    assert.equal((await request('GET', '/api/ledger/summary')).data.totalTransactions, initial.data.totalTransactions);
    const run = await request('POST', '/api/demo/guided-run', {});
    assert.equal(run.status, 200);
    assert.equal(run.data.steps.length, 6);
    assert.ok(run.data.steps.every((step) => step.outcome === 'ACCEPTED' && step.simulated));
    assert.equal(run.data.finalState.fu.status, 'SETTLED');
    assert.ok(run.data.steps.every((step) => step.execution.every((stage) => stage.simulated)));
    const registration = await request('GET', `/api/ledger/transactions/${encodeURIComponent(run.data.steps[0].txId)}`);
    assert.ok(registration.data.transaction.data.changes.some((change) => change.key === 'FU~' + run.data.fuId && change.after.status === 'REGISTERED'));

    const operatorToken = token;
    token = (await request('POST', '/api/login', { identity: 'FINANCIER_A', password: 'demo-password' })).data.token;
    const transfer = { toHolderId: 'FINANCIER_C', amountPaise: 1000, requestRef: 'simulation:duplicate-transfer' };
    const firstTransfer = await request('POST', '/api/receivables/FU-DEMO-1003/transfers', transfer);
    assert.equal(firstTransfer.data.outcome, 'ACCEPTED');
    const duplicateTransfer = await request('POST', '/api/receivables/FU-DEMO-1003/transfers', transfer);
    assert.equal(duplicateTransfer.data.reasonCode, 'REPLAYED_REFERENCE');
    token = operatorToken;

    const verification = await request('GET', '/api/ledger/verify');
    assert.equal(verification.data.ok, true);
    const transaction = await request('GET', `/api/ledger/transactions/${encodeURIComponent(run.data.steps[0].txId)}`);
    assert.equal(transaction.data.transaction.operation, 'RegisterFactoringUnit');
    assert.equal(transaction.data.transaction.status, 'SIMULATED_COMMIT');
    const auditBefore = fs.readFileSync(path.join(dir, 'app-data', 'audit.jsonl'), 'utf8');
    const reset = await request('POST', '/api/demo/reset', {});
    assert.equal(reset.status, 200);
    assert.match(reset.data.message, /Fabric, YugabyteDB.*not changed/);
    assert.equal(fs.readFileSync(path.join(dir, 'app-data', 'audit.jsonl'), 'utf8'), auditBefore);
    const afterReset = await request('GET', '/api/ledger/summary');
    assert.equal(afterReset.data.totalReceivables, 5);
    assert.equal(afterReset.data.totalTransactions, initial.data.totalTransactions);
    assert.equal((await request('GET', '/api/ledger/verify')).data.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await ledger.close?.();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
