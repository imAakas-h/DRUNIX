import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AppLayout, { NAV } from './layouts/AppLayout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Receivables from './pages/Receivables';
import ReceivableDetail from './pages/ReceivableDetail';
import Transfer from './pages/Transfer';
import AttackLab from './pages/AttackLab';
import Settlement from './pages/Settlement';
import Exposure from './pages/Exposure';
import Audit from './pages/Audit';
import Network from './pages/Network';
import Explorer from './pages/Explorer';
import PlatformPages from './pages/PlatformPages';

const PAGES = {
  '/overview': Overview,
  '/explorer': Explorer,
  '/receivables': Receivables,
  '/transfer': Transfer,
  '/lab': AttackLab,
  '/settlement': Settlement,
  '/exposure': Exposure,
  '/audit': Audit,
  '/network': Network,
  '/nodes': PlatformPages,
  '/contracts': PlatformPages,
  '/middleware': PlatformPages,
  '/integrations': PlatformPages,
  '/storage': PlatformPages,
  '/keys': PlatformPages,
  '/insights': PlatformPages,
  '/costs': PlatformPages,
};
export default function App() {
  const { identity, role } = useAuth();
  if (!identity) return <Routes><Route path="*" element={<Login />} /></Routes>;
  const allowed = NAV.filter((n) => !n.roles || n.roles.includes(role));
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        {allowed.map((n, index) => {
          if (allowed.findIndex((item) => item.to === n.to) !== index) return null;
          const P = PAGES[n.to];
          return <Route key={n.to} path={n.to} element={<P />} />;
        })}
        {allowed.some((n) => n.to === '/receivables') && <Route path="/receivables/:id" element={<ReceivableDetail />} />}
        <Route path="*" element={<Navigate to={allowed[0].to} replace />} />
      </Route>
    </Routes>
  );
}
