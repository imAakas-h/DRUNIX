import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, CircleHelp, Globe2, Layers3, Network as NetworkIcon, Plus, Server, TicketCheck, X } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Button, Card, ErrorBox, Field, Loading, PageHeader } from '../components/Ui';

const STORAGE_KEY = 'drunix.demo.networks';
const NETWORK_OPTIONS = [
  { name: 'Hyperledger Besu', type: 'Permissioned', description: 'An Ethereum-compatible client for private, permissioned networks.', icon: Layers3 },
  { name: 'Hyperledger Fabric', type: 'Permissioned', description: 'A modular permissioned ledger, shown here as a local configuration demo.', icon: NetworkIcon },
  { name: 'Polygon Edge', type: 'Permissioned', description: 'A modular framework for EVM-compatible private networks.', icon: Layers3 },
  { name: 'Quorum', type: 'Permissioned', description: 'A permissioned Ethereum client choice for a simulated setup.', icon: NetworkIcon },
  { name: 'Join by Invitation Code', type: 'Permissioned', description: 'Preview an invitation-based join flow. No code is verified or transmitted.', icon: TicketCheck },
  { name: 'Ethereum', type: 'Public', description: 'Public Ethereum protocol selection. No RPC endpoint or live connection is configured.', icon: Globe2 },
  { name: 'Avalanche', type: 'Public', description: 'Public Avalanche protocol selection. No RPC endpoint or live connection is configured.', icon: Globe2 },
  { name: 'Binance Smart Chain', type: 'Public', description: 'Public BNB Smart Chain protocol selection. No RPC endpoint or live connection is configured.', icon: Globe2 },
  { name: 'Polygon', type: 'Public', description: 'Public Polygon protocol selection. No RPC endpoint or live connection is configured.', icon: Globe2 },
  { name: 'Vennidium', type: 'Public', description: 'Public network option available for demonstration; no endpoint is configured.', icon: Globe2 },
];

const DEFAULT_NETWORKS = [
  { id: 'drunix-fabric', name: 'DRUNIX Fabric Network', protocol: 'Hyperledger Fabric', deployment: 'Local demo', status: 'configured', description: 'Illustrative Fabric configuration for the DRUNIX local demo. No live Fabric connection is represented.' },
  { id: 'rasid-network', name: 'RASID Network', protocol: 'RASID simulation', deployment: 'Local simulation', status: 'configured', description: 'Receivables workflow and RASID rule simulation backed by the local demo ledger.' },
  { id: 'drunix-local', name: 'DRUNIX Local Simulation', protocol: 'Fabric model · RASID', deployment: 'Local demo', status: 'simulation', description: 'The application’s local blockchain simulation and persistent demo ledger.' },
  { id: 'demo-permissioned', name: 'Demo Permissioned Network', protocol: 'Hyperledger Besu', deployment: 'Not deployed', status: 'not-connected', description: 'A sample configuration entry. No nodes or external network have been deployed.' },
];

const RELATED_ACTIONS = [
  { title: 'Add nodes to your blockchain network', description: 'Review simulated participants and their organization roles.', to: '/nodes', icon: Server, action: 'Explore nodes' },
  { title: 'Create a smart contract set', description: 'Inspect the RASID receivables contract and available operations.', to: '/contracts', icon: Layers3, action: 'View contract sets' },
  { title: 'Configure middleware', description: 'See how local demo services connect to the application API.', to: '/middleware', icon: NetworkIcon, action: 'Explore middleware' },
  { title: 'Explore transaction history', description: 'Inspect simulated transactions, blocks, and hash relationships.', to: '/explorer', icon: ArrowRight, action: 'Open explorer' },
];

function readSavedNetworks() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { networks: [], error: null };
    const value = JSON.parse(stored);
    if (!Array.isArray(value) || value.some((entry) => !entry || typeof entry.id !== 'string' || typeof entry.name !== 'string')) {
      return { networks: [], error: 'Saved demo network entries are invalid. Existing browser data was left untouched.' };
    }
    return { networks: value, error: null };
  } catch (error) {
    return { networks: [], error: `Unable to load saved demo networks: ${error.message}` };
  }
}

function StatusBadge({ status }) {
  const content = {
    simulation: ['Simulation Running', 'status-pill status-simulation'],
    configured: ['Configured', 'status-pill status-configured'],
    'not-connected': ['Not Connected', 'status-pill status-muted'],
  }[status] || ['Configured', 'status-pill status-configured'];
  return <span className={content[1]}><span className="status-dot" />{content[0]}</span>;
}

function NetworkDialog({ onClose, onCreate, initialNetwork }) {
  const [step, setStep] = useState(initialNetwork ? 'details' : 'select');
  const [selected, setSelected] = useState(null);
  const [networkName, setNetworkName] = useState(initialNetwork?.name || '');
  const [description, setDescription] = useState(initialNetwork?.description || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const choose = (option) => {
    setSelected(option);
    setNetworkName(option.name === 'Join by Invitation Code' ? 'Invitation Demo Network' : `${option.name} Demo Network`);
    setDescription(option.description);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!selected || !networkName.trim()) {
      setError('Choose a protocol and enter a network name.');
      return;
    }
    if (networkName.trim().length < 3) {
      setError('Network name must contain at least 3 characters.');
      return;
    }
    setBusy(true);
    setError('');
    const network = {
      id: `demo-${Date.now().toString(36)}`,
      name: networkName.trim(),
      protocol: selected.name,
      deployment: selected.type === 'Public' ? 'Not connected' : 'Local demo setup',
      status: selected.type === 'Public' || selected.name === 'Join by Invitation Code' ? 'not-connected' : 'configured',
      description: `${description.trim() || selected.description} This entry is a local UI demonstration only.`,
      createdAt: new Date().toISOString(),
    };
    try {
      onCreate(network);
      onClose();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`network-dialog${step === 'details' ? ' details-dialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby="network-dialog-title">
      <header className="dialog-header">
        <div>
          <div className="dialog-eyebrow">{step === 'details' ? 'NETWORK OVERVIEW' : 'NETWORK SETUP · DEMO MODE'}</div>
          <h2 id="network-dialog-title">{step === 'details' ? initialNetwork?.name : step === 'configure' ? 'Configure your demo network' : 'Select your network preference'}</h2>
          <p>{step === 'details' ? 'This overview describes a local demo configuration. It does not indicate a live network deployment.' : step === 'configure' ? 'Set a display name for your saved local demonstration entry. This will not deploy or connect a blockchain network.' : 'You can choose to configure a permissioned blockchain network or explore a public blockchain network. Supported network types are available for demonstration.'}</p>
        </div>
        <button className="dialog-close" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
      </header>

      {step === 'details' ? <div className="network-detail-content">
        <div className="detail-emblem"><NetworkIcon size={24} /></div>
        <dl className="network-detail-grid">
          <div><dt>Protocol</dt><dd>{initialNetwork?.protocol}</dd></div>
          <div><dt>Deployment</dt><dd>{initialNetwork?.deployment}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge status={initialNetwork?.status} /></dd></div>
          <div><dt>Network ID</dt><dd className="mono-detail">{initialNetwork?.id}</dd></div>
        </dl>
        <div className="demo-notice"><CircleHelp size={17} /><span>{initialNetwork?.description || 'No live network deployment or external connectivity is represented.'}</span></div>
        <div className="dialog-footer"><Button variant="alt" onClick={onClose}>Close</Button></div>
      </div> : step === 'configure' ? <form onSubmit={submit} className="configure-network">
        <div className="selected-protocol">
          <div className="selected-protocol-icon">{selected && <selected.icon size={22} />}</div>
          <div><span className="dialog-eyebrow">{selected?.type} NETWORK · LOCAL DEMO</span><strong>{selected?.name}</strong></div>
          <button type="button" className="text-button" onClick={() => setStep('select')}>Change</button>
        </div>
        <Field label="Display name"><input autoFocus value={networkName} onChange={(event) => setNetworkName(event.target.value)} maxLength={70} /></Field>
        <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={240} /></Field>
        <div className="demo-notice"><CircleHelp size={17} /><span>Continue creates a saved demonstration entry in this browser only. It will not deploy nodes, verify invitations, store credentials, or connect to a blockchain.</span></div>
        {error && <p role="alert" className="dialog-error">{error}</p>}
        <div className="dialog-footer">
          <Button type="button" variant="alt" onClick={() => setStep('select')}>Back</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create demo network'}</Button>
        </div>
      </form> : <div className="network-chooser">
        <div className="network-options">
          {['Permissioned', 'Public'].map((type) => <section key={type} className="option-group">
            <div className="option-group-heading"><h3>{type} networks</h3><span>{type === 'Permissioned' ? 'Private and organization-managed' : 'Public protocol selection'}</span></div>
            <div className="option-grid">
              {NETWORK_OPTIONS.filter((option) => option.type === type).map((option) => {
                const Icon = option.icon;
                return <button type="button" key={option.name} onClick={() => choose(option)} aria-pressed={selected?.name === option.name} className={`network-option${selected?.name === option.name ? ' selected' : ''}`}>
                  <span className="option-icon"><Icon size={19} /></span><span className="option-label">{option.name}</span>
                  {selected?.name === option.name && <span className="option-check"><Check size={14} /></span>}
                </button>;
              })}
            </div>
          </section>)}
        </div>
        <aside className="network-preview">
          {selected ? <>
            <div className="preview-icon">{(() => { const Icon = selected.icon; return <Icon size={23} />; })()}</div>
            <span className="dialog-eyebrow">SELECTED PREFERENCE</span>
            <h3>{selected.name}</h3>
            <p>{selected.description}</p>
            <span className={`status-pill ${selected.type === 'Public' ? 'status-muted' : 'status-configured'}`}>
              <span className="status-dot" />{selected.type === 'Public' ? 'Not Connected' : 'Demo configuration'}
            </span>
            <Button className="preview-continue" onClick={() => { setError(''); setStep('configure'); }}>Continue <ChevronRight size={16} /></Button>
          </> : <>
            <div className="preview-placeholder"><NetworkIcon size={24} /></div>
            <h3>Choose a network type</h3>
            <p>Select any option to see its details and continue to a local demonstration setup.</p>
          </>}
        </aside>
        {error && <p role="alert" className="dialog-error">{error}</p>}
        <footer className="dialog-footer chooser-footer"><span>Protocol choices are for demonstration; no real-world connectivity is implied.</span>
          {selected && <Button className="mobile-continue" onClick={() => { setError(''); setStep('configure'); }}>Continue <ChevronRight size={16} /></Button>}
          <Button variant="alt" onClick={onClose}>Cancel</Button>
        </footer>
      </div>}
    </section>
  </div>;
}

function NetworkEnvironment() {
  const { role } = useAuth();
  const h = useAsync(() => api.health(), []);
  const m = useAsync(() => api.metrics(), []);
  const modes = useAsync(() => api.networkModes(), []);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const [requestedMode, setRequestedMode] = useState('');
  const canSelect = role === 'OPERATOR';

  const selectMode = async (mode) => {
    if (!mode || mode === h.data?.mode || switching) return;
    setSwitching(true);
    setRequestedMode(mode);
    setSwitchError('');
    try {
      const result = await api.selectNetworkMode(mode);
      if (!result.ok) setSwitchError(result.data?.message || result.data?.error || `HTTP ${result.status}`);
      h.reload();
      modes.reload();
      m.reload();
    } catch (error) {
      setSwitchError(`Network error: ${error.message}`);
    } finally {
      setSwitching(false);
      setRequestedMode('');
    }
  };

  if ((h.loading && !h.data) || (m.loading && !m.data) || (modes.loading && !modes.data)) {
    return <Card><Loading what="simulation environment" /></Card>;
  }
  if (h.error || m.error || modes.error) {
    return <Card><h2 className="section-title">Simulation environment</h2><ErrorBox error={h.error || m.error || modes.error} onRetry={() => { h.reload(); m.reload(); modes.reload(); }} /></Card>;
  }
  const data = h.data;
  const ms = (value) => (value == null ? 'n/a' : `${value} ms`);
  const fields = [
    ['Network', data.networkName || 'Local demo ledger'],
    ['Channel', data.channelName || 'Not applicable in this demo mode'],
    ['Chaincode', data.chaincodeName || 'RASID simulation'],
    ['Peer connection', data.peerConnectionStatus || 'Simulated locally'],
    ['Identity authentication', data.identityAuthenticationStatus || 'Demo identity'],
    ['Latest observed block', data.latestBlockNumber ?? 'No committed transaction reported'],
  ];

  return <Card className="environment-card">
    <div className="environment-heading"><div><div className="section-kicker">EXISTING LEDGER STATUS</div><h2 className="section-title">Simulation environment</h2>
      <p className="section-description">Backend mode and measured activity from the existing receivables ledger.</p></div>
      <span className="status-pill status-configured" data-testid="net-mode"><span className="status-dot" />{data.mode === 'simulation' ? 'Local simulation' : data.mode === 'dev' ? 'dev' : data.mode}</span>
    </div>
    {canSelect && modes.data.allowed?.length > 0 && <Field label="Server ledger environment">
      <select aria-label="Select server ledger environment" value={switching ? requestedMode : data.mode} onChange={(event) => selectMode(event.target.value)} disabled={switching}>
        {modes.data.allowed.map((mode) => <option key={mode} value={mode}>{mode === 'dev' ? 'Development Mode' : mode === 'simulation' ? 'Local Demo Simulation' : 'Drunix Blockchain Mode'}</option>)}
      </select>
    </Field>}
    {switchError && <p role="alert" className="dialog-error">{switchError}</p>}
    <dl className="environment-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="environment-measurements">Successful transactions measured: <b>{m.data.samples}</b><span>p50 <b>{ms(m.data.p50Ms)}</b></span><span>p95 <b>{ms(m.data.p95Ms)}</b></span></div>
    {data.lastError && <div role="alert" className="network-banner network-banner-error">{data.lastError}</div>}
  </Card>;
}

export default function Network() {
  const initialSaved = readSavedNetworks();
  const [savedNetworks, setSavedNetworks] = useState(initialSaved.networks);
  const [storageError, setStorageError] = useState(initialSaved.error);
  const [dialog, setDialog] = useState(null);
  const health = useAsync(() => api.health(), []);
  const baseNetworks = DEFAULT_NETWORKS.map((network) => ({
    ...network,
    status: network.status === 'simulation' && health.data?.mode === 'simulation' ? 'simulation' : network.status === 'simulation' ? 'configured' : network.status,
  }));
  const networks = [...baseNetworks, ...savedNetworks];

  const saveNetwork = (network) => {
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      const latest = current ? JSON.parse(current) : [];
      if (!Array.isArray(latest) || latest.some((entry) => !entry || typeof entry.id !== 'string' || typeof entry.name !== 'string')) {
        throw new Error('Existing saved network data is invalid and was not changed.');
      }
      const next = [...latest.filter((entry) => entry.id !== network.id), network];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedNetworks(next);
      setStorageError('');
    } catch (error) {
      setStorageError(`Unable to save this network in browser storage: ${error.message}. No entry was created.`);
      throw new Error('Could not save this demo network. Check browser storage and try again.');
    }
  };

  return <>
    <PageHeader title="Blockchain Networks" sub="Configure and explore network preferences in the DRUNIX demo environment.">
      <Button className="add-network-button" onClick={() => setDialog({ mode: 'create' })}><Plus size={17} />Add a Blockchain Network</Button>
    </PageHeader>
    <Card className="network-table-card">
      <div className="network-card-heading"><div><h2 className="section-title">Your networks</h2><p className="section-description">Network entries are local demonstration configurations, not live deployments.</p></div><span className="network-count">{networks.length} networks</span></div>
      {storageError && <div role="alert" className="network-storage-error">{storageError}</div>}
      {health.error && <div role="alert" className="network-storage-error">Unable to confirm backend simulation mode: {health.error}</div>}
      <div className="network-table-scroll"><table className="network-table">
        <thead><tr><th>Network</th><th>Protocol</th><th>Deployment</th><th>Status</th><th className="network-details-heading">Details</th></tr></thead>
        <tbody>
          {networks.map((network) => <tr key={network.id}>
            <td><div className="network-name-cell"><span className="network-row-icon"><NetworkIcon size={17} /></span><strong>{network.name}</strong></div></td>
            <td>{network.protocol}</td><td>{network.deployment}</td><td><StatusBadge status={network.status} /></td>
            <td><button className="network-details-button" onClick={() => setDialog({ mode: 'details', network })}>View details <ChevronRight size={15} /></button></td>
          </tr>)}
          {!networks.length && <tr><td colSpan="5" className="network-empty">No demo networks have been configured yet.</td></tr>}
        </tbody>
      </table></div>
      {health.loading && !health.data && <div role="status" className="network-table-footnote"><Loading what="network status" /></div>}
      <div className="network-table-footnote">All statuses are scoped to this local demo. No public chain or external node is contacted.</div>
    </Card>

    <section className="related-actions-section">
      <div className="section-heading-row"><div><div className="section-kicker">CONTINUE BUILDING</div><h2 className="section-title">Related Actions</h2></div></div>
      <div className="related-actions-grid">
        {RELATED_ACTIONS.map(({ title, description, to, icon: Icon, action }) => <Card key={title} className="related-action-card">
          <span className="related-action-icon"><Icon size={19} /></span><h3>{title}</h3><p>{description}</p><Link to={to}>{action}<ArrowRight size={15} /></Link>
        </Card>)}
      </div>
    </section>
    <NetworkEnvironment />
    {dialog?.mode === 'create' && <NetworkDialog onClose={() => setDialog(null)} onCreate={saveNetwork} />}
    {dialog?.mode === 'details' && <NetworkDialog initialNetwork={dialog.network} onClose={() => setDialog(null)} />}
  </>;
}
