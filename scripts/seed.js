'use strict';
const { makeLedger } = require('../server/index');
const { seedParticipants } = require('../server/seed');
(async () => {
  const ledger = makeLedger();
  try { await seedParticipants(ledger, console.log); }
  finally { await ledger.close?.(); }
})().catch((e) => {
  console.error('Seed failed:', e.code || '', e.message);
  process.exitCode = 1;
});
