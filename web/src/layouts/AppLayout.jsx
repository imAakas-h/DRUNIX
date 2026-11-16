import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity, ArrowLeftRight, Blocks, BookOpen, Boxes, CircleHelp, Coins, FileKey2,
  FileText, Grid2X2, Home, Landmark, LayoutDashboard, LogOut, Network as NetworkIcon,
  Plug, ScrollText, ShieldAlert, Umbrella, Waypoints, X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';
import { NAME } from '../lib/labels';

const PLATFORM_NAV = [
  { to: '/overview', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/network', label: 'Blockchain Networks', icon: NetworkIcon },
  { to: '/nodes', label: 'Blockchain Nodes', icon: Waypoints },
  { to: '/contracts', label: 'Smart Contract Sets', icon: Blocks },
  { to: '/middleware', label: 'Middleware', icon: Plug },
  { to: '/integrations', label: 'Integration Tools', icon: Grid2X2 },
  { to: '/storage', label: 'Storage', icon: Boxes },
  { to: '/keys', label: 'Private Keys', icon: FileKey2 },
  { to: '/insights', label: 'Insights', icon: Activity },
  { to: '/costs', label: 'Resource Costs', icon: Coins },
];

const WORKSPACE_NAV = [
  { to: '/explorer', label: 'Blockchain Explorer', icon: Blocks },
  { to: '/receivables', label: 'Receivables', icon: FileText },
  { to: '/transfer', label: 'Discount & transfer', icon: ArrowLeftRight, roles: ['OPERATOR', 'FINANCIER'] },
  { to: '/lab', label: 'Attack lab', icon: ShieldAlert, roles: ['OPERATOR', 'AUDITOR'] },
  { to: '/settlement', label: 'Settlement', icon: Landmark, roles: ['OPERATOR', 'AUDITOR'] },
  { to: '/exposure', label: 'Insurer exposure', icon: Umbrella, roles: ['INSURER', 'OPERATOR', 'AUDITOR'] },
  { to: '/audit', label: 'Audit timeline', icon: ScrollText, roles: ['OPERATOR', 'AUDITOR', 'FINANCIER'] },
];

export const NAV = [
  ...PLATFORM_NAV,
  ...WORKSPACE_NAV,
  { to: '/network', label: 'Network', icon: Activity },
];

const BREADCRUMBS = Object.fromEntries([...PLATFORM_NAV, ...WORKSPACE_NAV].map(({ to, label }) => [to, label]));

function NetworkBanner() {
  const { data: h, error, loading } = useAsync(() => api.health(), []);
  if (error) return <div role="alert" className="network-banner network-banner-error">API unreachable: {error}</div>;
  if (!h) return loading ? <div role="status" className="network-banner">Checking ledger environment…</div> : null;
  if (h.mode === 'simulation') return <div role="note" data-testid="mode-banner" className="network-banner network-banner-demo"><b>DEMO MODE · SIMULATION</b><span>Local demo ledger only. No live blockchain activity.</span></div>;
  if (h.mode === 'dev') return <div role="note" data-testid="mode-banner" className="network-banner network-banner-demo"><b>DEV MODE — NOT DRUNIX</b><span>Local development ledger; results are not evidence of Drunix enforcement.</span></div>;
  const connected = h.status === 'CONNECTED';
  return <div role={connected ? 'status' : 'alert'} data-testid="mode-banner" className={`network-banner ${connected ? 'network-banner-ok' : 'network-banner-error'}`}>
    <b>DRUNIX — {h.status || 'DISCONNECTED'}.</b><span>{h.lastError || h.authenticatedIdentity || 'No verified network session.'}</span>
  </div>;
}

function SidebarLink({ item, onNavigate }) {
  const Icon = item.icon;
  return <NavLink end={item.to === '/overview'} to={item.to} onClick={onNavigate} className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
    <Icon size={17} aria-hidden="true" /><span>{item.label}</span>
  </NavLink>;
}

export default function AppLayout() {
  const { identity, role, logout } = useAuth();
  const { pathname } = useLocation();
  const toast = useToast();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const workspaceItems = WORKSPACE_NAV.filter((item) => !item.roles || item.roles.includes(role));
  const currentLabel = BREADCRUMBS[pathname] || (pathname.startsWith('/receivables/') ? 'Receivable details' : 'Platform');

  useEffect(() => setMobileOpen(false), [pathname]);

  const contactSupport = () => {
    setHelpOpen((open) => !open);
    toast('Contact your DRUNIX platform administrator for support.');
  };

  return (
    <div className="app-shell">
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`app-sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-symbol" aria-hidden="true"><Waypoints size={20} /></div>
          <div><strong>DRUNIX</strong><span>Blockchain platform</span></div>
          <button className="sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-caption">PLATFORM</div>
        <nav aria-label="Main" className="sidebar-nav">
          {PLATFORM_NAV.map((item) => <SidebarLink key={item.to} item={item} onNavigate={() => setMobileOpen(false)} />)}
        </nav>
        <details className="workspace-menu" open>
          <summary>Receivables workspace</summary>
          <nav aria-label="Receivables workspace" className="sidebar-nav">
            {workspaceItems.map((item) => <SidebarLink key={item.to} item={item} onNavigate={() => setMobileOpen(false)} />)}
          </nav>
        </details>
        <div className="sidebar-footer">
          <div className="support-card">
            <div className="support-card-top"><CircleHelp size={17} /><strong>Need help?</strong>
              <button onClick={contactSupport} aria-label="Contact support" className="support-action">{helpOpen ? '−' : '+'}</button>
            </div>
            <span>Contact support.</span>
            {helpOpen && <p>Reach out to your DRUNIX platform administrator for assistance.</p>}
          </div>
          <div className="user-profile">
            <div className="user-avatar" aria-hidden="true">{(NAME[identity] || 'U').slice(0, 1)}</div>
            <div className="user-details"><b data-testid="whoami">{NAME[identity]}</b><span>{role}</span></div>
            <button onClick={logout} className="logout-button" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Grid2X2 size={19} /></button>
          <div className="topbar-crumbs">
            <NavLink to="/overview" className="topbar-brand"><span className="topbar-brand-mark"><Waypoints size={16} /></span>DRUNIX</NavLink>
            <span className="crumb-divider">/</span><Home size={15} aria-hidden="true" className="crumb-home" />
            <span className="crumb-divider">/</span><span>Platform Demo</span>
            <span className="crumb-divider">/</span><span className="crumb-current">{currentLabel}</span>
          </div>
          <div className="topbar-actions">
            <NavLink to="/integrations" aria-label="Documentation and integrations" title="Documentation and integrations"><BookOpen size={18} /></NavLink>
            <NavLink to="/overview" aria-label="Applications" title="Applications"><Grid2X2 size={18} /></NavLink>
            <div className="org-indicator"><span className="org-dot" />Local demo</div>
          </div>
        </header>
        <main className="app-content">
          <NetworkBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
