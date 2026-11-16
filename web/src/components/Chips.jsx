const base = 'inline-block rounded-full border px-2 py-px text-xs';
export const SimChip = ({ children = 'SIMULATED' }) => <span className={`${base} bg-amber-bg text-amber border-amber`}>{children}</span>;
export const StatusChip = ({ status }) => <span className={`${base} ${status === 'SETTLED' ? 'border-line text-mute' : 'bg-teal-bg text-teal border-teal'}`}>{status.replaceAll('_', ' ').toLowerCase()}</span>;
const OUT = { ACCEPTED: ['bg-teal-bg text-teal border-teal', 'Committed'], REJECTED_CHAINCODE: ['bg-alert-bg text-alert border-alert', 'Rejected by chaincode'], REJECTED_COMMIT: ['bg-alert-bg text-alert border-alert border-dashed', 'Rejected at commit'], REJECTED_API: ['bg-alert-bg text-alert border-alert', 'Rejected by API'], REJECTED_PRECHECK: ['bg-amber-bg text-amber border-amber', 'Failed simulated check'], ERROR: ['bg-alert-bg text-alert border-alert', 'Error'] };
export function OutcomeChip({ outcome, code, simulated = false }) {
  const [cls, defaultLabel] = OUT[outcome] || ['border-line', outcome];
  const label = simulated && outcome === 'ACCEPTED' ? 'Simulated commit' : defaultLabel;
  return <span><span className={`${base} ${cls}`}>{label}</span>{code && <span className="font-mono text-xs ml-1.5">{code}</span>}</span>;
}
