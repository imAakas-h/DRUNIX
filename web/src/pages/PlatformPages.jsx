import { Link, useLocation } from 'react-router-dom';
import { Activity, ArrowRight, Blocks, CheckCircle2, Database, KeyRound, Plug, Server, ShieldCheck } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { Card, ErrorBox, Loading, PageHeader } from '../components/Ui';
import { SimChip } from '../components/Chips';
import { NAME } from '../lib/labels';
import { inr } from '../lib/money';

const PAGE_META = {
  '/nodes': { title: 'Blockchain Nodes', subtitle: 'Organizations and nodes participating in the local DRUNIX simulation.' },
  '/contracts': { title: 'Smart Contract Sets', subtitle: 'Review the RASID contract rules and receivables operations used by this demo.' },
  '/middleware': { title: 'Middleware', subtitle: 'Local demo adapters and service boundaries. No external integrations are implied.' },
  '/integrations': { title: 'Integration Tools', subtitle: 'Application APIs and integration entry points for the DRUNIX demonstration.' },
  '/storage': { title: 'Storage', subtitle: 'Inspect local ledger persistence and browser-side demo configuration.' },
  '/keys': { title: 'Private Keys', subtitle: 'Identity configuration is shown safely; secret material is never displayed.' },
  '/insights': { title: 'Insights', subtitle: 'Receivable lifecycle and transaction activity from the existing demo ledger.' },
  '/costs': { title: 'Resource Costs', subtitle: 'Illustrative local demo usage. No cloud billing data is available or reported.' },
};

function InfoCard({ icon: Icon, title, children, className = '' }) {
  return <Card className={`platform-info-card ${className}`}><div className="platform-info-heading"><span className="platform-info-icon"><Icon size={18} /></span><h2>{title}</h2></div>{children}</Card>;
}

function NodesPage() {
  const summary = useAsync(() => api.ledgerSummary(), []);
  if (summary.loading && !summary.data) return <Card><Loading what="simulated participants" /></Card>;
  if (summary.error) return <Card><ErrorBox error={summary.error} onRetry={summary.reload} /></Card>;
  const participants = summary.data.participants || [];
  return <>
    <InfoCard icon={Server} title="Simulated participants">
      <p className="platform-copy">These organization identities represent the participants in the local simulation; they are not connected to deployed peers.</p>
      {participants.length ? <div className="platform-table-scroll"><table className="platform-table"><thead><tr><th>Organization</th><th>Simulation role</th><th>Recorded activity</th><th>Connection</th></tr></thead><tbody>
        {participants.map((participant) => <tr key={participant.id}><td><strong>{participant.name}</strong><span className="platform-subcell">{NAME[participant.id] || participant.id}</span></td><td>{participant.role}</td><td>{summary.data.organizationActivity?.[participant.id] || 0} transactions</td><td><span className="status-pill status-configured"><span className="status-dot" />Simulated identity</span></td></tr>)}
      </tbody></table></div> : <p className="platform-empty">No participating organizations have been reported.</p>}
    </InfoCard>
    <div className="platform-callout"><SimChip>SIMULATION</SimChip><span>Endorsements and ordering are simulated locally. No peer or ordering service is contacted.</span></div>
  </>;
}

function ContractsPage() {
  const summary = useAsync(() => api.ledgerSummary(), []);
  const executions = summary.data?.latestTransactions || [];
  return <>
    <InfoCard icon={Blocks} title="RASID Receivables Contract">
      <div className="contract-summary"><span className="contract-mark">R</span><div><h3>RASID · Position Ledger</h3><p>Receivable registration, financing positions, transfers, releases, and settlement rules.</p></div><SimChip>DEMO RULE MIRROR</SimChip></div>
      <div className="contract-metrics"><div><span>Execution</span><strong>Local simulation</strong></div><div><span>Data model</span><strong>Receivables & positions</strong></div><div><span>Deployment</span><strong>Not deployed by this UI</strong></div></div>
    </InfoCard>
    <InfoCard icon={CheckCircle2} title="Available operations">
      <div className="operation-list">{[
        ['RegisterFactoringUnit', 'Register and validate a receivable using the simulated verification adapter.'],
        ['AcceptFactoringUnit', 'Record buyer acceptance under the existing RASID lifecycle rules.'],
        ['DiscountFactoringUnit', 'Create the initial financier position against an accepted receivable.'],
        ['TransferPosition', 'Transfer part of a position while enforcing balance and replay rules.'],
        ['ReleasePosition · SettleReceivable', 'Release positions or close the receivable using simulated payment references.'],
      ].map(([name, description]) => <div key={name}><code>{name}</code><span>{description}</span></div>)}</div>
      <Link className="platform-action-link" to="/receivables">Open receivables <ArrowRight size={15} /></Link>
    </InfoCard>
    <InfoCard icon={Activity} title="Recent execution history">
      {summary.loading && !summary.data ? <Loading what="contract activity" /> : summary.error ? <ErrorBox error={summary.error} onRetry={summary.reload} /> : executions.length ? <div className="platform-table-scroll"><table className="platform-table"><thead><tr><th>Operation</th><th>Initiated by</th><th>Outcome</th><th>Time</th></tr></thead><tbody>
        {executions.slice(0, 6).map((execution, index) => <tr key={execution.txId || execution.seq || index}><td>{execution.action}</td><td>{NAME[execution.actor] || execution.actor}</td><td>{execution.outcome}</td><td>{execution.ts ? new Date(execution.ts).toLocaleString() : '—'}</td></tr>)}
      </tbody></table></div> : <p className="platform-empty">No contract execution has been recorded yet.</p>}
      <Link className="platform-action-link" to="/explorer">Open transaction explorer <ArrowRight size={15} /></Link>
    </InfoCard>
  </>;
}

function MiddlewarePage() {
  const health = useAsync(() => api.health(), []);
  if (health.loading && !health.data) return <Card><Loading what="integration status" /></Card>;
  if (health.error) return <Card><ErrorBox error={health.error} onRetry={health.reload} /></Card>;
  const components = [
    ['RASID rule engine', 'Validates receivable lifecycle and position operations through the existing API.', 'Simulation active'],
    ['Ledger adapter', 'Routes application ledger reads and writes to the configured local demo backend.', health.data.mode === 'simulation' ? 'Local simulation' : 'Development mode'],
    ['Invoice verification', 'Illustrative verification checks used during receivable registration.', 'Simulated adapter'],
  ];
  return <div className="platform-card-grid">{components.map(([title, detail, state]) => <InfoCard key={title} icon={Plug} title={title}><p className="platform-copy">{detail}</p><span className="status-pill status-configured"><span className="status-dot" />{state}</span>{title === 'Ledger adapter' && <p className="platform-copy middleware-health">Backend API health check: responding.</p>}</InfoCard>)}
    <div className="platform-callout"><span>External middleware, webhooks, and production API credentials are not configured in this demonstration.</span></div>
  </div>;
}

function IntegrationsPage() {
  return <>
    <InfoCard icon={Plug} title="Application API">
      <p className="platform-copy">The React application uses the existing authenticated Express API. Requests are routed through the configured backend; no real-world partner connection is created by these screens.</p>
      <div className="integration-endpoints">{[
        ['Ledger status & metrics', 'GET /api/network/health · /api/metrics'],
        ['Receivables workflow', 'GET /api/receivables · POST /api/receivables'],
        ['Blockchain explorer', 'GET /api/ledger/summary · /api/ledger/blocks'],
        ['Demo simulation controls', 'POST /api/demo/guided-run · POST /api/demo/reset'],
      ].map(([label, endpoints]) => <div key={label}><span>{label}</span><code>{endpoints}</code></div>)}</div>
      <Link className="platform-action-link" to="/explorer">View simulated transactions <ArrowRight size={15} /></Link>
    </InfoCard>
    <div className="platform-callout"><SimChip>AUTHENTICATED API</SimChip><span>Existing identity and role authorization remain in place for receivables operations.</span></div>
  </>;
}

function StoragePage() {
  const summary = useAsync(() => api.ledgerSummary(), []);
  const health = useAsync(() => api.health(), []);
  if ((summary.loading && !summary.data) || (health.loading && !health.data)) return <Card><Loading what="ledger storage status" /></Card>;
  if (summary.error || health.error) return <Card><ErrorBox error={summary.error || health.error} onRetry={() => { summary.reload(); health.reload(); }} /></Card>;
  const simulated = health.data.mode === 'simulation';
  return <>
    <InfoCard icon={Database} title="Ledger persistence">
      <dl className="storage-facts"><div><dt>Backend mode</dt><dd>{simulated ? 'Local demo simulation' : health.data.mode === 'dev' ? 'Development ledger' : 'Configured network mode'}</dd></div>
        <div><dt>Persistence</dt><dd>{simulated ? 'Persistent local demo ledger' : 'Existing backend ledger'}</dd></div>
        <div><dt>Latest simulated block</dt><dd>{summary.data.latestBlock?.blockNumber ?? 'No blocks reported'}</dd></div>
        <div><dt>Transactions recorded</dt><dd>{summary.data.totalTransactions ?? 0}</dd></div>
        <div><dt>Network entries</dt><dd>Saved in this browser’s local storage</dd></div></dl>
    </InfoCard>
    <div className="platform-callout"><ShieldCheck size={17} /><span>Network preference entries are browser-local demo configuration; they do not modify the ledger or existing data.</span></div>
  </>;
}

function KeysPage() {
  return <>
    <InfoCard icon={KeyRound} title="Identity and key handling">
      <dl className="storage-facts"><div><dt>Identity access</dt><dd>Authenticated through the existing DRUNIX API session</dd></div><div><dt>Private key material</dt><dd>Not returned to or displayed by this interface</dd></div><div><dt>Browser storage</dt><dd>Session token only; no key values are shown on this page</dd></div><div><dt>Network connections</dt><dd>No live protocol connection is initiated here</dd></div></dl>
    </InfoCard>
    <div className="security-note"><ShieldCheck size={19} /><div><strong>Secret values are protected</strong><span>This page contains identity-safety information only. It never reads, renders, or requests private keys or credentials.</span></div></div>
  </>;
}

function InsightsPage() {
  const summary = useAsync(() => api.ledgerSummary(), []);
  const receivables = useAsync(() => api.receivables(), []);
  if ((summary.loading && !summary.data) || (receivables.loading && !receivables.data)) return <Card><Loading what="ledger insights" /></Card>;
  if (summary.error || receivables.error) return <Card><ErrorBox error={summary.error || receivables.error} onRetry={() => { summary.reload(); receivables.reload(); }} /></Card>;
  const list = receivables.data || [];
  const active = list.filter((item) => item.fu.status !== 'SETTLED');
  const outstanding = active.reduce((total, item) => total + item.fu.outstandingPaise, 0);
  const statusCounts = list.reduce((counts, item) => ({ ...counts, [item.fu.status]: (counts[item.fu.status] || 0) + 1 }), {});
  return <>
    <div className="insight-metrics">
      <div><span>Total simulated transactions</span><strong>{summary.data.totalTransactions ?? 0}</strong></div>
      <div><span>Receivables</span><strong>{summary.data.totalReceivables ?? list.length}</strong></div>
      <div><span>Open receivables</span><strong>{active.length}</strong></div>
      <div><span>Open balance</span><strong>{inr(outstanding)}</strong></div>
    </div>
    <InfoCard icon={Activity} title="Receivable lifecycle activity">
      {Object.keys(statusCounts).length ? <div className="operation-list">{Object.entries(statusCounts).map(([status, count]) => <div key={status}><strong>{status.replaceAll('_', ' ')}</strong><span>{count} {count === 1 ? 'receivable' : 'receivables'}</span></div>)}</div> : <p className="platform-empty">No receivable activity is available yet.</p>}
      <Link className="platform-action-link" to="/receivables">Open receivables <ArrowRight size={15} /></Link>
    </InfoCard>
    <InfoCard icon={Server} title="Organization activity">
      {Object.entries(summary.data.organizationActivity || {}).length ? <div className="operation-list">{Object.entries(summary.data.organizationActivity).map(([identity, count]) => <div key={identity}><strong>{NAME[identity] || identity}</strong><span>{count} simulated transactions</span></div>)}</div> : <p className="platform-empty">No organization activity has been recorded yet.</p>}
    </InfoCard>
    <div className="platform-callout"><SimChip>DEMO METRICS</SimChip><span>Counts and amounts come from the local application ledger; they are not production network analytics.</span></div>
  </>;
}

function CostsPage() {
  return <>
    <InfoCard icon={Activity} title="Demo resource usage">
      <div className="resource-cost-notice"><strong>No cloud billing connection</strong><span>This environment does not report cloud invoices, deployed node usage, or third-party service charges.</span></div>
      <div className="contract-metrics"><div><span>Blockchain deployment</span><strong>Not performed by this UI</strong></div><div><span>External network usage</span><strong>None reported</strong></div><div><span>Demo compute estimate</span><strong>Local machine · not measured</strong></div></div>
      <p className="platform-copy">Any local CPU, memory, or storage consumption is illustrative only and is not an actual cloud cost estimate.</p>
    </InfoCard>
  </>;
}

export default function PlatformPages() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname];
  if (!meta) return null;
  const Content = {
    '/nodes': NodesPage,
    '/contracts': ContractsPage,
    '/middleware': MiddlewarePage,
    '/integrations': IntegrationsPage,
    '/storage': StoragePage,
    '/keys': KeysPage,
    '/insights': InsightsPage,
    '/costs': CostsPage,
  }[pathname];
  return <><PageHeader title={meta.title} sub={meta.subtitle} /><Content /></>;
}
