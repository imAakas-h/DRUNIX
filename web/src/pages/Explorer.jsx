import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Button, Card, Empty, ErrorBox, Loading, Mono, PageHeader } from '../components/Ui';
import { SimChip } from '../components/Chips';
import { NAME } from '../lib/labels';

const shortHash = (hash = '') => `${hash.slice(0, 14)}…${hash.slice(-10)}`;
const timestamp = (value) => value ? new Date(value).toLocaleString() : '—';

function Metric({ label, value }) {
  return <div className="rounded-md border border-line bg-canvas p-3"><p className="text-xs text-mute">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

export default function Explorer() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedFu = searchParams.get('fu');
  const summary = useAsync(() => api.ledgerSummary(), []);
  const chain = useAsync(() => api.blocks(100), []);
  const integrity = useAsync(() => api.ledgerVerify(), []);
  const guide = useAsync(() => api.demoGuide(), []);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [selectedTxId, setSelectedTxId] = useState(null);
  const [guidedResult, setGuidedResult] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const blocks = chain.data?.blocks || [];
  const selectedBlock = useMemo(
    () => blocks.find((block) => block.blockNumber === selectedNumber)
      || (focusedFu && blocks.find((block) => block.transactions.some((tx) => tx.data.arguments?.[0] === focusedFu)))
      || blocks[0]
      || null,
    [blocks, selectedNumber, focusedFu],
  );
  const selectedTransaction = selectedBlock?.transactions.find((tx) => tx.transactionId === selectedTxId)
    || selectedBlock?.transactions[0]
    || null;
  const refresh = () => { summary.reload(); chain.reload(); integrity.reload(); };

  const runGuided = async () => {
    setBusy(true); setMessage(''); setGuidedResult(null);
    try {
      const response = await api.runGuidedDemo();
      if (!response.ok) setMessage(response.data?.message || response.data?.error || `HTTP ${response.status}`);
      else { setGuidedResult(response.data); setSelectedNumber(null); setSelectedTxId(null); refresh(); }
    } catch (error) {
      setMessage(`Request failed: ${error.message}`);
    } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm('Reset only the local simulation ledger and restore sample data? Fabric, YugabyteDB, containers, and application audit history will not be changed.')) return;
    setBusy(true); setMessage('');
    try {
      const response = await api.resetDemo();
      if (!response.ok) setMessage(response.data?.message || response.data?.error || `HTTP ${response.status}`);
      else { setGuidedResult(null); setMessage(response.data.message); setSelectedNumber(null); setSelectedTxId(null); refresh(); }
    } catch (error) { setMessage(`Request failed: ${error.message}`); }
    finally { setBusy(false); }
  };

  if ((summary.loading && !summary.data) || (chain.loading && !chain.data)) return <Loading what="simulated blockchain" />;
  if (summary.error || chain.error) return <>
    <PageHeader title="Blockchain Explorer" sub="Inspect the local SHA-256 hash-linked demo ledger. Every network, endorsement, ordering, and commit shown here is simulated."><SimChip>LOCAL DEMO LEDGER</SimChip></PageHeader>
    <Card><ErrorBox error={summary.error || chain.error} onRetry={refresh} /></Card>
  </>;
  const data = summary.data;
  const valid = integrity.data?.ok;
  return (
    <>
      <PageHeader title="Blockchain Explorer" sub="Inspect the local SHA-256 hash-linked demo ledger. Every network, endorsement, ordering, and commit shown here is simulated.">
        <SimChip>LOCAL DEMO LEDGER</SimChip>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Simulated Fabric Network</h2><p className="text-xs text-mute mt-1">Simulated RASID execution · simulated organization endorsement · simulated commit</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="alt" onClick={refresh}>Refresh</Button>
            <Button variant="alt" onClick={() => integrity.reload()} disabled={integrity.loading}>Verify ledger integrity</Button>
            {['OPERATOR', 'AUDITOR'].includes(role) && <Button onClick={runGuided} disabled={busy}>{busy ? 'Running…' : 'Run guided demo'}</Button>}
            {role === 'OPERATOR' && <Button variant="alt" onClick={reset} disabled={busy}>Reset demo data</Button>}
          </div>
        </div>
        {message && <p role="status" className="mt-3 text-sm text-teal">{message}</p>}
        {integrity.error && <ErrorBox error={integrity.error} onRetry={integrity.reload} />}
        {integrity.data && <p role="status" data-testid="ledger-integrity" className={`mt-3 rounded-md border px-3 py-2 text-sm ${valid ? 'border-teal bg-teal-bg text-teal' : 'border-alert bg-alert-bg text-alert'}`}>
          Local ledger integrity {valid ? 'verified' : 'FAILED'} · {integrity.data.records} blocks{integrity.data.brokenAt ? ` · broken at block ${integrity.data.brokenAt}: ${integrity.data.reason}` : ''}
        </p>}
        {guidedResult && <div className="mt-3 rounded-md border border-amber bg-amber-bg p-3 text-sm">
          <b>Guided simulation completed:</b> {guidedResult.fuId}. Six lifecycle transactions were simulated and appended to the local ledger.
          <ul className="mt-2 text-xs">{guidedResult.verification.checks.map((check) => <li key={check.name}><SimChip /> {check.name}: {check.passed ? 'passed' : 'failed'}</li>)}</ul>
          <div className="mt-2 flex flex-wrap gap-2">{guidedResult.steps.map((step) => <span key={step.requestRef || `${step.action}-${step.seq}`} className="rounded border border-amber px-2 py-1 text-xs">{step.action}: {step.outcome}</span>)}</div>
          <Link className="mt-2 inline-block underline" to={guidedResult.explorer}>Open guided receivable in Explorer</Link>
        </div>}
      </Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Latest simulated block" value={data.latestBlock?.blockNumber ?? '—'} />
        <Metric label="Simulated transactions" value={data.totalTransactions} />
        <Metric label="Receivables" value={data.totalReceivables} />
        <Metric label="Latest block time" value={timestamp(data.latestBlock?.timestamp)} />
      </div>
      {data.latestBlock && <Card>
        <h2 className="font-semibold mb-2">Latest hash relationship</h2>
        <dl className="grid gap-3 md:grid-cols-2">
          <div><dt className="text-xs text-mute">Current block hash · #{data.latestBlock.blockNumber}</dt><dd><Mono>{data.latestBlock.hash}</Mono></dd></div>
          <div><dt className="text-xs text-mute">Previous block hash</dt><dd><Mono>{data.latestBlock.previousHash}</Mono></dd></div>
        </dl>
      </Card>}
      <Card className="overflow-x-auto">
        <h2 className="font-semibold">Participating organizations <SimChip>SIMULATED IDENTITIES</SimChip></h2>
        <table className="mt-2"><thead><tr><th>Participant</th><th>Organization</th><th>Simulated MSP ID</th><th>Role</th><th>Recorded transactions</th></tr></thead>
          <tbody>{data.participants.map((participant) => <tr key={participant.id}>
            <td>{NAME[participant.id] || participant.id}</td><td>{participant.name}</td><td><Mono>{participant.mspId}</Mono></td><td>{participant.role}</td><td>{data.organizationActivity[participant.id] || 0}</td>
          </tr>)}</tbody></table>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Block chain</h2><span className="text-xs text-mute">Each block hash includes its data and previous-block hash.</span></div>
        {!blocks.length ? <Empty>No simulated blocks yet.</Empty> : <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {blocks.map((block, index) => <div key={block.blockNumber} className="flex shrink-0 items-center gap-3">
            <button type="button" onClick={() => { setSelectedNumber(block.blockNumber); setSelectedTxId(null); }} aria-pressed={selectedBlock?.blockNumber === block.blockNumber}
              className={`w-52 rounded-lg border p-3 text-left ${selectedBlock?.blockNumber === block.blockNumber ? 'border-teal bg-teal-bg' : 'border-line bg-canvas'}`}>
              <span className="text-xs text-mute">SIMULATED BLOCK</span><b className="block">#{block.blockNumber}</b>
              <span className="mt-1 block font-mono text-xs">{shortHash(block.hash)}</span>
              <span className="mt-1 block text-xs text-mute">{block.transactionCount} transaction · {timestamp(block.timestamp)}</span>
            </button>
            {index < blocks.length - 1 && <span aria-hidden className="text-teal text-lg">←</span>}
          </div>)}
        </div>}
      </Card>
      {selectedBlock && <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-x-auto">
          <h2 className="font-semibold">Block #{selectedBlock.blockNumber}</h2>
          <p className="text-xs text-mute mt-1">Previous block relationship: {selectedBlock.blockNumber > 1
            ? <button className="underline" onClick={() => { setSelectedNumber(selectedBlock.blockNumber - 1); setSelectedTxId(null); }}>open block #{selectedBlock.blockNumber - 1}</button>
            : 'genesis reference (all zeroes)'}</p>
          <dl className="mt-3 grid gap-3"><div><dt className="text-xs text-mute">Block hash</dt><dd><Mono>{selectedBlock.hash}</Mono></dd></div>
            <div><dt className="text-xs text-mute">Previous hash</dt><dd><Mono>{selectedBlock.previousHash}</Mono></dd></div>
            <div><dt className="text-xs text-mute">Timestamp · transactions</dt><dd className="text-sm">{timestamp(selectedBlock.timestamp)} · {selectedBlock.transactionCount}</dd></div></dl>
          <h3 className="mt-4 text-sm font-semibold">Transactions in block</h3>
          <table className="mt-2"><thead><tr><th>Transaction ID</th><th>Operation</th><th>Initiating organization</th><th>Status</th></tr></thead>
            <tbody>{selectedBlock.transactions.map((transaction) => <tr key={transaction.transactionId}>
              <td><button className="font-mono text-xs underline" onClick={() => setSelectedTxId(transaction.transactionId)}>{transaction.transactionId}</button></td>
              <td>{transaction.operation}</td><td>{transaction.initiator.organization}</td><td><SimChip>SIMULATED COMMIT</SimChip></td>
            </tr>)}</tbody></table>
        </Card>
        {selectedTransaction && <Card>
          <h2 className="font-semibold">Transaction detail <SimChip>SIMULATED</SimChip></h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-xs text-mute">Simulated transaction ID</dt><dd><Mono>{selectedTransaction.transactionId}</Mono></dd></div>
            <div><dt className="text-xs text-mute">Operation</dt><dd>{selectedTransaction.operation}</dd></div>
            <div><dt className="text-xs text-mute">Status</dt><dd>{selectedTransaction.status}</dd></div>
            <div><dt className="text-xs text-mute">Initiator</dt><dd>{NAME[selectedTransaction.initiator.id] || selectedTransaction.initiator.organization} · {selectedTransaction.initiator.mspId}</dd></div>
            <div><dt className="text-xs text-mute">Timestamp</dt><dd>{timestamp(selectedTransaction.timestamp)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-mute">Transaction hash</dt><dd><Mono>{selectedTransaction.transactionHash}</Mono></dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-mute">Simulated endorsing organizations</dt><dd className="text-sm">{selectedTransaction.endorsements.map((item) => item.name).join(' · ')}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-mute">Simulated ordering</dt><dd className="text-sm">{selectedTransaction.ordering.service} · {selectedTransaction.ordering.status}</dd></div>
          </dl>
          <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">View transaction data</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-canvas p-3 text-xs">{JSON.stringify(selectedTransaction.data, null, 2)}</pre>
          </details>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">View block hash details</summary>
            <pre className="mt-2 overflow-auto rounded bg-canvas p-3 text-xs">{JSON.stringify({ blockNumber: selectedBlock.blockNumber, previousHash: selectedBlock.previousHash, currentHash: selectedBlock.hash }, null, 2)}</pre>
          </details>
        </Card>}
      </div>}
      {guide.data && <Card>
        <h2 className="font-semibold">Guided judge demo</h2>
        <p className="mt-1 text-xs text-mute">Use the button above to create a fresh, complete sample lifecycle. This is a local simulation, not a live Fabric transaction.</p>
        <ol className="mt-3 grid gap-2 md:grid-cols-2">{guide.data.steps.map((step) => <li key={step.number} className="rounded border border-line p-3 text-sm">
          <b>{step.number}. {step.title}</b><p className="text-xs text-mute mt-1">{step.organization} · {step.detail}</p>
        </li>)}</ol>
      </Card>}
    </>
  );
}
