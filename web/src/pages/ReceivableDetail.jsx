import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Button, Card, Empty, ErrorBox, Loading, Mono, PageHeader } from '../components/Ui';
import { OutcomeChip, SimChip, StatusChip } from '../components/Chips';
import { PositionBar, PositionLegend } from '../components/PositionBar';
import { TxResult } from '../components/TxResult';
import { inr, uid } from '../lib/money';
import { NAME } from '../lib/labels';
export default function ReceivableDetail() {
  const { id } = useParams(); const { role } = useAuth(); const [result, setResult] = useState(null); const [busy, setBusy] = useState(false);
  const st = useAsync(() => api.receivable(id), [id]); const au = useAsync(() => (role === 'INSURER' ? Promise.resolve({ ok: true, data: { onChain: [], attempts: [] } }) : api.audit(id)), [id, role]);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const { fu, positions } = st.data;
  const accept = async () => { setBusy(true); const r = await api.accept(id, uid(`${id}:acc`)); setBusy(false); setResult(r); st.reload(); au.reload(); };
  return (
    <>
      <PageHeader title={`${fu.fuId} · ${inr(fu.outstandingPaise)}`} sub={`${fu.buyer}`}><Link to="/receivables" className="text-sm underline">← All receivables</Link></PageHeader>
      <Card>
        <p className="text-sm text-mute mb-2"><StatusChip status={fu.status} /> · {fu.status === 'SETTLED' ? 'all positions released at settlement' : `allocated ${inr(st.data.allocatedPaise)} · unallocated ${inr(st.data.unallocatedPaise)}`}</p>
        <PositionBar positions={positions} outstanding={fu.outstandingPaise} /><PositionLegend positions={positions} outstanding={fu.outstandingPaise} />
        <p className="text-xs text-mute mt-3">Evidence hash <Mono>{fu.evidenceHash}</Mono> <SimChip>SIMULATED verifier</SimChip></p>
        <div className="flex flex-wrap gap-2 mt-3">
          {role === 'OPERATOR' && fu.status === 'REGISTERED' && <Button variant="go" onClick={accept} disabled={busy}>Record buyer acceptance</Button>}
          {['OPERATOR', 'FINANCIER'].includes(role) && fu.status !== 'SETTLED' && <Link to={`/transfer?fu=${fu.fuId}`} className="rounded-md border border-line px-3.5 py-2 text-sm hover:bg-canvas">Discount / transfer</Link>}
          {['OPERATOR', 'AUDITOR'].includes(role) && <Link to={`/settlement?fu=${fu.fuId}`} className="rounded-md border border-line px-3.5 py-2 text-sm hover:bg-canvas">Settlement</Link>}
        </div>
        <div className="mt-3"><TxResult result={result} /></div>
      </Card>
      <Card className="overflow-x-auto"><h2 className="font-semibold text-sm mb-2">Position ledger</h2>
        {!positions.length ? <Empty>No positions yet (not discounted).</Empty> : <table><thead><tr><th>Holder</th><th className="text-right">Active position</th><th className="text-right">Released</th></tr></thead><tbody>{positions.map((p) => <tr key={p.holderId}><td>{NAME[p.holderId] || p.holderId}</td><td className="text-right">{inr(p.amountPaise)}</td><td className="text-right">{inr(p.releasedPaise)}</td></tr>)}</tbody></table>}
      </Card>
      <Card className="overflow-x-auto"><h2 className="font-semibold text-sm mb-2">Ledger event history</h2>
        {au.loading && !au.data ? <Loading what="history" /> : au.error ? <ErrorBox error={au.error} /> : !au.data.onChain.length ? <Empty>No committed events.</Empty> : (
          <table><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Details</th><th>Tx</th></tr></thead><tbody>{au.data.onChain.map((e) => <tr key={e.txId}><td className="font-mono text-xs">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</td><td><OutcomeChip outcome="ACCEPTED" /> {e.action}</td><td>{e.actor}</td><td>{e.details}</td><td><Mono>{e.txId}</Mono></td></tr>)}</tbody></table>)}
      </Card>
    </>
  );
}
