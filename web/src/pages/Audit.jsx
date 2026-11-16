import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Card, Empty, ErrorBox, Field, Loading, Mono, PageHeader } from '../components/Ui';
import { OutcomeChip } from '../components/Chips';
import { NAME } from '../lib/labels';
export default function Audit() {
  const { role } = useAuth(); const [sp, setSp] = useSearchParams(); const list = useAsync(() => api.receivables(), []);
  const id = sp.get('fu') || list.data?.[0]?.fu.fuId;
  const a = useAsync(() => (id ? api.audit(id) : Promise.resolve({ ok: true, data: { onChain: [], attempts: [] } })), [id]);
  const chain = useAsync(() => (['AUDITOR', 'OPERATOR'].includes(role) ? api.auditVerify() : Promise.resolve({ ok: true, data: null })), [role]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data.length) return <><PageHeader title="Audit timeline" /><Empty>No factoring units yet.</Empty></>;
  const onChain = new Set((a.data?.onChain || []).map((e) => e.txId));
  return (
    <>
      <PageHeader title="Audit timeline" sub="Every attempt with actor, time, reference and reason. Accepted actions appear in ledger state; rejected attempts remain in the application audit log. In Demo Mode, the ledger records are local simulations.">
        {chain.data && <span data-testid="chain-status" className={`text-xs rounded-full border px-2 py-px ${chain.data.ok ? 'border-teal text-teal bg-teal-bg' : 'border-alert text-alert bg-alert-bg'}`}>Audit log hash chain {chain.data.ok ? 'intact' : 'BROKEN'} · {chain.data.records} records</span>}
      </PageHeader>
      <Card><Field label="Factoring unit"><select value={id} onChange={(e) => setSp({ fu: e.target.value })}>{list.data.map((r) => <option key={r.fu.fuId}>{r.fu.fuId}</option>)}</select></Field></Card>
      <Card className="overflow-x-auto">
        {a.loading && !a.data ? <Loading what="audit trail" /> : a.error ? <ErrorBox error={a.error} onRetry={a.reload} /> : !a.data.attempts.length ? <Empty>No attempts recorded.</Empty> : (
          <table data-testid="audit-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Outcome</th><th>Reference / tx</th></tr></thead><tbody>
            {a.data.attempts.map((x) => <tr key={x.seq}><td className="font-mono text-xs">{new Date(x.ts).toLocaleTimeString([], { hour12: false })}.{String(new Date(x.ts).getMilliseconds()).padStart(3, '0')}</td><td>{NAME[x.actor] || x.actor}</td><td>{x.action}</td>
              <td><OutcomeChip outcome={x.outcome} code={x.reasonCode} /><div className="text-xs text-mute">{x.message}</div></td>
              <td><Mono>{x.requestRef}</Mono>{x.txId && <div><Mono>tx {x.txId}</Mono> {onChain.has(x.txId) && <span className="text-xs rounded-full border border-teal text-teal bg-teal-bg px-1.5">{x.simulated ? 'simulated ledger' : 'on-chain'}</span>}</div>}</td></tr>)}</tbody></table>)}
      </Card>
    </>
  );
}
