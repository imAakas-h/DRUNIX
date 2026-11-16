'use strict';
// Registers the demo participants on the ledger. Safe to re-run.
const ROLES = { OPERATOR: 'OPERATOR', FINANCIER_A: 'FINANCIER', FINANCIER_B: 'FINANCIER', FINANCIER_C: 'FINANCIER', FINANCIER_D: 'FINANCIER', INSURER: 'INSURER', AUDITOR: 'AUDITOR' };

async function seedParticipants(ledger, log = () => {}) {
  try {
    const result = await ledger.commit(await ledger.propose('OPERATOR', 'BootstrapOperator', ['OPERATOR']));
    if (result.status !== 'COMMITTED') throw Object.assign(new Error(`operator bootstrap was not committed (${result.status})`), { code: result.status });
    log('operator bound');
  }
  catch (e) { if (e.code !== 'ALREADY_BOOTSTRAPPED') throw e; log('operator already bound'); }
  for (const [name, role] of Object.entries(ROLES)) {
    if (name === 'OPERATOR') continue;
    try {
      await ledger.query(name, 'WhoAmI', []);
      log(`${name} already registered`);
      continue;
    } catch (e) {
      if (e.code !== 'UNKNOWN_IDENTITY') throw e;
    }
    const msp = ledger.mode === 'dev' ? 'DevMSP'
      : ledger.mode === 'simulation' ? ledger.organizationFor(name).mspId
        : ledger.ids[name]?.mspId;
    if (!msp) throw new Error(`${name} MSP ID is required before registering participants`);
    const r = await ledger.commit(await ledger.propose('OPERATOR', 'RegisterParticipant', [ledger.cnOf(name), name, role, msp]));
    if (r.status !== 'COMMITTED') throw Object.assign(new Error(`${name} registration was not committed (${r.status})`), { code: r.status });
    log(`${name} (${role}): ${r.status}`);
  }
}
module.exports = { seedParticipants, ROLES };
