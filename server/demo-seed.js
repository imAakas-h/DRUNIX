'use strict';

const crypto = require('crypto');

async function commit(ledger, identity, operation, args) {
  const proposal = await ledger.propose(identity, operation, args);
  const result = await ledger.commit(proposal);
  if (result.status !== 'COMMITTED') {
    throw new Error(`Could not seed simulation transaction ${operation}: ${result.status}`);
  }
}

async function register(ledger, fuId, amountPaise, status) {
  const ref = `seed:${fuId}`;
  const evidenceHash = crypto.createHash('sha256')
    .update(JSON.stringify({ fuId, invoiceNo: `INV-${fuId}`, buyer: 'Northstar Components Ltd', amountPaise }))
    .digest('hex');
  await commit(ledger, 'OPERATOR', 'RegisterFactoringUnit', [fuId, 'Northstar Components Ltd', amountPaise, evidenceHash, ref]);
  if (status === 'REGISTERED') return;
  await commit(ledger, 'OPERATOR', 'AcceptFactoringUnit', [fuId, `${ref}:accept`]);
  if (['DISCOUNTED', 'PARTIALLY_TRANSFERRED', 'SETTLED'].includes(status)) {
    await commit(ledger, 'FINANCIER_A', 'DiscountFactoringUnit', [fuId, `${ref}:discount`]);
  }
  if (status === 'PARTIALLY_TRANSFERRED') {
    await commit(ledger, 'FINANCIER_A', 'TransferPosition', [fuId, 'FINANCIER_B', Math.floor(amountPaise * 40 / 100), `${ref}:transfer`]);
  }
  if (status === 'SETTLED') {
    await commit(ledger, 'OPERATOR', 'SettleReceivable', [fuId, `${ref}:payment`]);
  }
}

async function seedDemoReceivables(ledger) {
  const existing = await ledger.query('OPERATOR', 'ListFactoringUnits', []);
  if (existing.length) return false;
  await register(ledger, 'FU-DEMO-1000', 64000000, 'REGISTERED');
  await register(ledger, 'FU-DEMO-1001', 125000000, 'ACCEPTED');
  await register(ledger, 'FU-DEMO-1002', 48000000, 'DISCOUNTED');
  await register(ledger, 'FU-DEMO-1003', 82500000, 'PARTIALLY_TRANSFERRED');
  await register(ledger, 'FU-DEMO-1004', 36000000, 'SETTLED');
  return true;
}

module.exports = { seedDemoReceivables };
