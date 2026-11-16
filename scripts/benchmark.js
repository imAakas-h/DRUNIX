'use strict';
// Measures propose→commit latency of successful transfers and propose latency of rejected ones.
// LEDGER_MODE=drunix node scripts/benchmark.js 50
const fs = require('fs');
const { makeLedger } = require('../server/index');
const { seedParticipants } = require('../server/seed');
const N = Number(process.argv[2] || 30); const RUN = Date.now().toString(36); const fu = `FU-B${RUN}`;
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : null; };
(async () => {
  const L = makeLedger(); await seedParticipants(L);
  const send = async (who, fn, args) => { const p = await L.propose(who, fn, args); return L.commit(p); };
  for (const [who, fn, args] of [
    ['OPERATOR', 'RegisterFactoringUnit', [fu, 'Bench Buyer (illustrative)', 48000000, 'bench', `${fu}:reg`]],
    ['OPERATOR', 'AcceptFactoringUnit', [fu, `${fu}:acc`]],
    ['FINANCIER_A', 'DiscountFactoringUnit', [fu, `${fu}:disc`]],
  ]) {
    const result = await send(who, fn, args);
    if (result.status !== 'COMMITTED') throw new Error(`${fn} was not committed (${result.status})`);
  }
  const ok = []; const rej = []; let from = 'FINANCIER_A'; let to = 'FINANCIER_B';
  for (let i = 0; i < N; i++) { const t = performance.now(); const c = await send(from, 'TransferPosition', [fu, to, 100, `${fu}:ok${i}`]); if (c.status === 'COMMITTED') ok.push(performance.now() - t); [from, to] = [to, from]; }
  for (let i = 0; i < N; i++) { const t = performance.now(); try { await L.propose('FINANCIER_C', 'TransferPosition', [fu, 'FINANCIER_A', 100, `${fu}:bad${i}`]); } catch (e) { if (e.code === 'NOT_A_HOLDER') rej.push(performance.now() - t); } }
  const r = (a) => ({ samples: a.length, p50Ms: Math.round(pct(a, 0.5)), p95Ms: Math.round(pct(a, 0.95)) });
  const out = { generatedAt: new Date().toISOString(), ledgerMode: L.mode, drunixEvidence: L.mode === 'drunix', environment: `${L.mode} · node ${process.version} · ${process.platform}`, successfulTransfers: r(ok), rejectedAtEndorsement: r(rej) };
  fs.mkdirSync('reports', { recursive: true }); const f = `reports/benchmark-${L.mode}-${RUN}.json`; fs.writeFileSync(f, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); console.log('→', f);
  await L.close?.();
  process.exitCode = 0;
})().catch((e) => { console.error('benchmark could not run:', e.code || '', e.message); process.exit(2); });
