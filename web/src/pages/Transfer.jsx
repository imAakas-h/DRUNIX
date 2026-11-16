import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Button, Card, Empty, ErrorBox, Field, Loading, PageHeader } from '../components/Ui';
import { StatusChip } from '../components/Chips';
import { PositionBar, PositionLegend } from '../components/PositionBar';
import { TxResult } from '../components/TxResult';
import { inr, toPaise, uid } from '../lib/money';
import { FINANCIERS, MOVABLE, NAME } from '../lib/labels';
export default function Transfer() {
  const { identity, role } = useAuth(); const [sp, setSp] = useSearchParams();
  const list = useAsync(() => api.receivables(), []); const [result, setResult] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const units = list.data.filter((r) => r.fu.status !== 'SETTLED'); const cur = units.find((r) => r.fu.fuId === sp.get('fu')) || units[0];
  const mine = cur?.positions.find((p) => p.holderId === identity);
  const run = async (fn) => { setBusy(true); setResult(null); const r = await fn(); setBusy(false); setResult(r); list.reload(); };
  const submit = (kind) => (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); const amountPaise = toPaise(f.amt);
    if (!(amountPaise > 0)) return setErr('Enter a positive amount such as 1,92,000'); if (mine && amountPaise > mine.amountPaise) setErr(`Above your position of ${inr(mine.amountPaise)}; the ledger will reject it.`); else setErr('');
    run(() => (kind === 'transfer' ? api.transfer(cur.fu.fuId, { toHolderId: f.to, amountPaise, requestRef: uid(cur.fu.fuId) }) : api.release(cur.fu.fuId, { amountPaise, requestRef: uid(cur.fu.fuId) })));
  };
  return (
    <>
      <PageHeader title="Discount & re-discount" sub="In Demo Mode, each operation updates the local simulated ledger. The result appears only after the simulation commit; balances are never updated optimistically." />
      {!units.length ? <Empty>No open factoring units.</Empty> : (
        <>
          <Card><div className="flex flex-wrap items-end gap-4"><Field label="Factoring unit"><select value={cur.fu.fuId} onChange={(e) => { setSp({ fu: e.target.value }); setResult(null); }}>{units.map((r) => <option key={r.fu.fuId}>{r.fu.fuId}</option>)}</select></Field>
            <p className="text-sm pb-1">{inr(cur.fu.outstandingPaise)} · <StatusChip status={cur.fu.status} /></p></div>
            <div className="mt-3"><PositionBar positions={cur.positions} outstanding={cur.fu.outstandingPaise} /><PositionLegend positions={cur.positions} outstanding={cur.fu.outstandingPaise} /></div></Card>
          {role === 'OPERATOR' && <Card><p className="text-sm text-mute">Discounting, transfers and releases are performed by financiers. The operator records buyer acceptance from the unit’s detail page and settles from the Settlement page.</p></Card>}
          {role === 'FINANCIER' && (
            <Card>
              {cur.fu.status === 'ACCEPTED' && <Button variant="go" disabled={busy} onClick={() => run(() => api.discount(cur.fu.fuId, uid(`${cur.fu.fuId}:disc`)))}>Discount and take 100% ({inr(cur.fu.outstandingPaise)})</Button>}
              {['REGISTERED'].includes(cur.fu.status) && <p className="text-sm text-mute">Waiting for buyer acceptance before this unit can be discounted.</p>}
              {MOVABLE.includes(cur.fu.status) && (mine?.amountPaise > 0 ? (
                <form className="flex flex-wrap items-end gap-3" onSubmit={submit('transfer')} noValidate>
                  <p className="w-full text-sm">Your position: <b>{inr(mine.amountPaise)}</b></p>
                  <Field label="Recipient"><select name="to">{FINANCIERS.filter((x) => x !== identity).map((x) => <option key={x} value={x}>{NAME[x]}</option>)}</select></Field>
                  <Field label="Amount (₹)"><input name="amt" defaultValue={(mine.amountPaise / 100).toLocaleString('en-IN')} inputMode="decimal" /></Field>
                  <Button variant="go" disabled={busy}>{busy ? 'Waiting for commit…' : 'Transfer'}</Button>
                  <Button type="button" variant="alt" disabled={busy} onClick={(e) => submit('release')({ preventDefault() {}, currentTarget: e.currentTarget.form })}>Release this amount</Button>
                </form>) : <p className="text-sm text-mute">You hold no active position in this unit.</p>)}
              {err && <p role="alert" className="text-amber text-sm mt-2">{err}</p>}
            </Card>)}
          {busy && <p role="status" className="text-sm text-mute">Submitted to the simulation. Waiting for simulated endorsement, ordering and commit…</p>}
          <TxResult result={result} />
        </>)}
    </>
  );
}
