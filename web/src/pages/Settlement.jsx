import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Button, Card, Empty, ErrorBox, Field, Loading, Mono, PageHeader } from '../components/Ui';
import { SimChip, StatusChip } from '../components/Chips';
import { PositionBar, PositionLegend } from '../components/PositionBar';
import { TxResult } from '../components/TxResult';
import { inr } from '../lib/money';
import { MOVABLE } from '../lib/labels';
export default function Settlement() {
  const { role } = useAuth(); const [sp, setSp] = useSearchParams();
  const list = useAsync(() => api.receivables(), []); const [res, setRes] = useState(null); const [payment, setPayment] = useState(null); const [busy, setBusy] = useState(false); const [cersai, setCersai] = useState(null);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const cur = list.data.find((r) => r.fu.fuId === sp.get('fu')) || list.data[0];
  const go = async (paymentRef) => { setBusy(true); const r = await api.settle(cur.fu.fuId, paymentRef); setBusy(false); setRes(r); if (r.data.payment) setPayment(r.data.payment); list.reload(); };
  return (
    <>
      <PageHeader title="Settlement & release" sub="The payment and ledger commit are simulated locally. Settlement is allowed once per unit and once per settlement reference." />
      {!cur ? <Empty>No factoring units yet.</Empty> : (
        <>
          <Card><div className="flex flex-wrap items-end gap-4"><Field label="Factoring unit"><select value={cur.fu.fuId} onChange={(e) => { setSp({ fu: e.target.value }); setRes(null); setPayment(null); setCersai(null); }}>{list.data.map((r) => <option key={r.fu.fuId}>{r.fu.fuId}</option>)}</select></Field>
            <p className="text-sm pb-1">{inr(cur.fu.outstandingPaise)} · <StatusChip status={cur.fu.status} /></p></div>
            <div className="mt-3"><PositionBar positions={cur.positions} outstanding={cur.fu.outstandingPaise} /><PositionLegend positions={cur.positions} outstanding={cur.fu.outstandingPaise} /></div></Card>
          <Card>
            {role !== 'OPERATOR' ? <p className="text-sm text-mute">Read-only for your role. Only the platform operator triggers settlement.</p> : (
              <div className="flex flex-wrap gap-2">
                <Button variant="go" disabled={busy || !MOVABLE.includes(cur.fu.status)} onClick={() => go()}>{busy ? 'Waiting for commit…' : 'Settle (simulated payment) and release all'}</Button>
                <Button variant="alt" disabled={busy || !payment} onClick={() => go(payment.paymentRef)}>Replay last settlement reference</Button>
              </div>)}
            {!MOVABLE.includes(cur.fu.status) && role === 'OPERATOR' && <p className="text-sm text-mute mt-2">This unit is {cur.fu.status.toLowerCase().replaceAll('_', ' ')}: it cannot be settled now.</p>}
            {payment && <p className="text-sm mt-3"><SimChip /> payment event <Mono>{payment.paymentRef}</Mono></p>}
            <div className="mt-3"><TxResult result={res} /></div>
          </Card>
          <Card><div className="flex items-center gap-3"><h2 className="font-semibold text-sm">CERSAI filing-ready record <SimChip>SIMULATED · not filed</SimChip></h2>
            <Button variant="alt" onClick={async () => { const r = await api.cersai(cur.fu.fuId); setCersai(r.ok ? r.data : { error: r.data.message || r.data.error }); }}>Generate</Button></div>
            {cersai && <pre className="bg-navy text-slate-200 text-xs rounded-md p-3 overflow-auto max-h-72 mt-3">{JSON.stringify(cersai, null, 2)}</pre>}</Card>
        </>)}
    </>
  );
}
