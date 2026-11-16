import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { Card, Empty, ErrorBox, Loading, PageHeader } from '../components/Ui';
import { OutcomeChip, StatusChip } from '../components/Chips';
import { inr } from '../lib/money';
import { NAME } from '../lib/labels';
import { SimChip } from '../components/Chips';
export default function Overview() {
  const units = useAsync(() => api.receivables(), []); const recent = useAsync(() => api.recent(), []);
  const blockchain = useAsync(() => api.ledgerSummary(), []);
  if (units.loading && !units.data) return <Loading />;
  if (units.error) return <ErrorBox error={units.error} onRetry={units.reload} />;
  const list = units.data; const by = {};
  const activity = blockchain.data?.latestTransactions || recent.data || [];
  for (const r of list) { const k = r.fu.status; by[k] ||= { n: 0, outstanding: 0, allocated: 0 }; by[k].n++; by[k].outstanding += r.fu.outstandingPaise; by[k].allocated += r.allocatedPaise; }
  const live = list.filter((r) => r.fu.status !== 'SETTLED');
  return (
    <>
      <PageHeader title="Overview" sub="Receivables and positions in the local DRUNIX financing simulation. This is not a live Fabric network."><SimChip>DEMO MODE · SIMULATION</SimChip></PageHeader>
      {blockchain.data && <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Local Demo Ledger</h2><p className="text-xs text-mute">Simulated Fabric Network · Simulated RASID Execution · Simulated Commit</p></div>
          <Link className="rounded-md border border-line px-3 py-2 text-sm underline" to="/explorer">Open Blockchain Explorer</Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-mute">Total simulated transactions</p><b>{blockchain.data.totalTransactions}</b></div>
          <div><p className="text-xs text-mute">Latest simulated block</p><b>#{blockchain.data.latestBlock?.blockNumber || 0}</b></div>
          <div><p className="text-xs text-mute">Total receivables</p><b>{blockchain.data.totalReceivables}</b></div>
          <div><p className="text-xs text-mute">Latest block hash</p><code className="text-xs">{blockchain.data.latestBlock?.hash?.slice(0, 18) || '—'}…</code></div>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs text-mute">Simulated organization activity</p>
          <p className="mt-1 text-sm">{Object.entries(blockchain.data.organizationActivity || {}).map(([identity, count]) => `${NAME[identity] || identity}: ${count}`).join(' · ') || 'No activity yet'}</p>
        </div>
      </Card>}
      <Card>
        <p className="text-sm"><b data-testid="live-count">{live.length}</b> open factoring unit{live.length === 1 ? '' : 's'} · outstanding <b>{inr(live.reduce((s, r) => s + r.fu.outstandingPaise, 0))}</b> · financed <b>{inr(live.reduce((s, r) => s + r.allocatedPaise, 0))}</b> · {list.length - live.length} settled</p>
        {list.length === 0 ? <Empty>No factoring units yet. The operator registers units on the Receivables page, or run the six steps in the Attack lab.</Empty> : (
          <table className="mt-3"><thead><tr><th>Lifecycle status</th><th>Units</th><th className="text-right">Outstanding</th><th className="text-right">Currently allocated</th></tr></thead>
            <tbody>{Object.entries(by).map(([s, v]) => <tr key={s}><td><StatusChip status={s} /></td><td>{v.n}</td><td className="text-right">{inr(v.outstanding)}</td><td className="text-right">{inr(v.allocated)}</td></tr>)}</tbody></table>)}
      </Card>
      <Card><h2 className="font-semibold text-sm mb-2">Recent transactions</h2>
        {recent.loading && !recent.data && !blockchain.data ? <Loading what="activity" /> : recent.error && !blockchain.data ? <ErrorBox error={recent.error} /> : !activity.length ? <Empty>No activity recorded yet.</Empty> : (
          <div className="overflow-x-auto"><table><thead><tr><th>Time</th><th>Actor</th><th>Unit</th><th>Action</th><th>Outcome</th></tr></thead><tbody>
            {activity.slice(0, 8).map((r, index) => <tr key={r.txId || r.seq || index}><td className="font-mono text-xs">{new Date(r.ts).toLocaleTimeString([], { hour12: false })}</td><td>{NAME[r.actor] || r.actor}</td><td><Link className="underline" to={`/receivables/${r.fuId}`}>{r.fuId}</Link></td><td>{r.action}</td><td><OutcomeChip outcome={r.outcome} simulated={r.simulated} code={r.reasonCode} /></td></tr>)}</tbody></table></div>)}
      </Card>
    </>
  );
}
