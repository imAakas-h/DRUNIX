import { OutcomeChip, SimChip } from './Chips';
import { Mono } from './Ui';
// Shows a ledger outcome record exactly as the API reported it (after the commit verdict). Never optimistic.
export function TxResult({ result }) {
  if (!result) return null;
  const r = result.data || {};
  if (!r.outcome) return <p role="alert" className="text-alert text-sm">{r.message || r.error || `HTTP ${result.status}`}</p>;
  return (
    <div className="rounded-md border border-line p-3 text-sm" data-testid="tx-result">
      <div className="flex items-center gap-2"><OutcomeChip outcome={r.outcome} code={r.reasonCode} simulated={r.simulationMode} />{r.simulationMode && <span className="rounded-full border border-amber px-2 py-px text-xs text-amber">SIMULATED</span>}<span className="text-mute">{r.action}</span></div>
      <p className="mt-1">{r.message}</p>
      {r.txId && <p className="mt-1 text-mute">{r.simulationMode ? 'simulated tx' : 'tx'} <Mono>{r.txId}</Mono>{r.blockNumber != null && <> · {r.simulationMode ? 'simulated block' : 'block'} {r.blockNumber}</>}</p>}
      <p className="mt-1 text-mute text-xs">actor {r.actor} · ref <Mono>{r.requestRef}</Mono> · {new Date(r.ts).toLocaleTimeString()}</p>
      {r.execution && <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">Simulated execution stages</summary>
        <ol className="mt-2 grid gap-1">{r.execution.map((stage, index) => <li key={`${stage.stage}-${index}`} className="text-xs"><SimChip /> {stage.stage}{stage.status ? ` · ${stage.status}` : ''}{stage.blockNumber ? ` · block ${stage.blockNumber}` : ''}</li>)}</ol>
      </details>}
    </div>
  );
}
