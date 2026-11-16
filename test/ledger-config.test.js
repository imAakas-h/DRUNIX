'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FabricLedger } = require('../server/ledger-fabric');

test('Drunix ledger reports missing identities as configuration required without fallback', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rasid-config-'));
  const identitiesFile = path.join(dir, 'identities.json');
  fs.writeFileSync(identitiesFile, '{}');
  const ledger = new FabricLedger({ channel: 'channel-under-test', chaincode: 'rasid-under-test', identitiesFile });
  try {
    const health = await ledger.health('OPERATOR');
    assert.equal(ledger.mode, 'drunix');
    assert.equal(health.mode, 'drunix');
    assert.equal(health.status, 'CONFIGURATION REQUIRED');
    assert.equal(health.ok, false);
    assert.equal(health.peerConnectionStatus, 'NOT_CHECKED');
    assert.equal(health.identityAuthenticationStatus, 'NOT_CHECKED');
    assert.equal(health.latestBlockNumber, null);
    assert.match(health.lastError, /OPERATOR identity is not configured/);
  } finally {
    await ledger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
