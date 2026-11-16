'use strict';
// Repeats the double-sale scenario N times on fresh factoring units and writes an evidence report.
// Run against Drunix:  LEDGER_MODE=drunix node scripts/verify-concurrency.js 20
// The report records the ledger mode; a report from the dev engine is NOT Drunix evidence.
const fs = require('fs');
const { makeLedger } = require('../server/index');
const { seedParticipants } = require('../server/seed');
const N = Number(process.argv[2] || 10); const RUN = Date.now().toString(36);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : null; };

(async () => {
  const L = makeLedger();
  await seedParticipants(L);
  const send = async (who, fn, args) => { const p = await L.propose(who, fn, args); return L.commit(p); };
  const runs = []; const lat = [];
  for (let i = 1; i <= N; i++) {
    const fu = `FU-V${RUN}-${i}`; const R = (s) => `${fu}:${s}`; const rec = { fu, ok: false };
    try {
      for (const [who, fn, args] of [['OPERATOR', 'RegisterFactoringUnit', [fu, 'Acme Retail Ltd (illustrative)', 48000000, 'evidence', R('reg')]], ['OPERATOR', 'AcceptFactoringUnit', [fu, R('acc')]], ['FINANCIER_A', 'DiscountFactoringUnit', [fu, R('disc')]], ['FINANCIER_A', 'TransferPosition', [fu, 'FINANCIER_B', 28800000, R('xB')]]]) {
        const c = await send(who, fn, args); if (c.status !== 'COMMITTED') throw new Error(`${fn}: ${c.status}`);
      }
      const t0 = performance.now();
      const p1 = await L.propose('FINANCIER_A', 'TransferPosition', [fu, 'FINANCIER_C', 19200000, R('atk-C')]); // both endorsed on the same state
      const p2 = await L.propose('FINANCIER_A', 'TransferPosition', [fu, 'FINANCIER_D', 19200000, R('atk-D')]); // before either is submitted
      const [c1, c2] = await Promise.all([L.commit(p1), L.commit(p2)]); lat.push(Math.round(performance.now() - t0));
      const pos = await L.query('OPERATOR', 'GetPositions', [fu]); const total = pos.reduce((a, p) => a + p.amountPaise, 0);
      const winners = [c1, c2].filter((c) => c.status === 'COMMITTED'); const losers = [c1, c2].filter((c) => c.status !== 'COMMITTED');
      const bal = Object.fromEntries(pos.map((p) => [p.holderId, p.amountPaise]));
      Object.assign(rec, { tx: [{ to: 'FINANCIER_C', txId: p1.txId, status: c1.status, block: c1.blockNumber }, { to: 'FINANCIER_D', txId: p2.txId, status: c2.status, block: c2.blockNumber }], finalPositions: bal, totalPaise: total });
      rec.ok = winners.length === 1 && losers.length === 1 && total === 48000000 && bal.FINANCIER_A === 0 && bal.FINANCIER_B === 28800000 && (bal.FINANCIER_C || 0) + (bal.FINANCIER_D || 0) === 19200000;
    } catch (e) { rec.error = `${e.code || ''} ${e.message}`; }
    runs.push(rec); process.stdout.write(rec.ok ? '.' : 'F');
  }
  const out = { generatedAt: new Date().toISOString(), ledgerMode: L.mode, drunixEvidence: L.mode === 'drunix', runs: N, passed: runs.filter((r) => r.ok).length, attackLatencyMs: { p50: pct(lat, 0.5), p95: pct(lat, 0.95) }, environment: `${L.mode} · node ${process.version} · ${process.platform}`, details: runs };
  fs.mkdirSync('reports', { recursive: true }); const f = `reports/concurrency-${L.mode}-${RUN}.json`; fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log(`\n${out.passed}/${N} runs satisfied "exactly one commit, totals conserved" on ${L.mode.toUpperCase()}${L.mode === 'dev' ? ' (NOT Drunix evidence)' : ''} → ${f}`);
  await L.close?.();
  process.exitCode = out.passed === N ? 0 : 1;
})().catch((e) => { console.error('verification could not run:', e.code || '', e.message); process.exit(2); });
