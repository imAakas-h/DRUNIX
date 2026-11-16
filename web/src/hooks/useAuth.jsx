import { createContext, useContext, useEffect, useState } from 'react';
import { api, session } from '../services/api';
import { roleOf } from '../lib/labels';
const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(session.token ? session.identity : null);
  useEffect(() => { const f = () => setIdentity(null); window.addEventListener('rasid:logout', f); return () => window.removeEventListener('rasid:logout', f); }, []);
  const login = async (id, pw) => {
    const r = await api.login(id, pw);
    if (!r.ok) return { ok: false, error: r.data?.error || `HTTP ${r.status}` };
    session.set(r.data.token, r.data.identity); setIdentity(r.data.identity); return { ok: true };
  };
  const logout = () => { session.clear(); setIdentity(null); };
  return <Ctx.Provider value={{ identity, role: roleOf(identity), login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
