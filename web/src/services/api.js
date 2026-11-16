// All HTTP lives here. Every function resolves to { status, ok, data } and only rejects on network failure.
let token = sessionStorage.getItem('rasid.token');
export const session = {
  get token() { return token; },
  get identity() { return sessionStorage.getItem('rasid.identity'); },
  set(t, id) { token = t; sessionStorage.setItem('rasid.token', t); sessionStorage.setItem('rasid.identity', id); },
  clear() { token = null; sessionStorage.removeItem('rasid.token'); sessionStorage.removeItem('rasid.identity'); },
};
async function request(method, url, body) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && url !== '/api/login') { session.clear(); window.dispatchEvent(new Event('rasid:logout')); }
  return { status: res.status, ok: res.ok, data };
}
const get = (u) => request('GET', u);
const post = (u, b) => request('POST', u, b ?? {});
export const api = {
  login: (identity, password) => post('/api/login', { identity, password }),
  health: () => get('/api/network/health'),
  networkModes: () => get('/api/network/modes'),
  selectNetworkMode: (mode) => post('/api/network/mode', { mode }),
  metrics: () => get('/api/metrics'),
  ledgerSummary: () => get('/api/ledger/summary'),
  blocks: (limit = 50) => get(`/api/ledger/blocks?limit=${limit}`),
  block: (number) => get(`/api/ledger/blocks/${number}`),
  transaction: (txId) => get(`/api/ledger/transactions/${encodeURIComponent(txId)}`),
  ledgerVerify: () => get('/api/ledger/verify'),
  demoGuide: () => get('/api/demo/guide'),
  runGuidedDemo: () => post('/api/demo/guided-run'),
  resetDemo: () => post('/api/demo/reset'),
  auditVerify: () => get('/api/audit/verify'),
  recent: () => get('/api/audit/recent'),
  receivables: () => get('/api/receivables'),
  receivable: (id) => get(`/api/receivables/${id}`),
  register: (b) => post('/api/receivables', b),
  accept: (id, requestRef) => post(`/api/receivables/${id}/accept`, { requestRef }),
  discount: (id, requestRef) => post(`/api/receivables/${id}/discount`, { requestRef }),
  transfer: (id, b) => post(`/api/receivables/${id}/transfers`, b),
  release: (id, b) => post(`/api/receivables/${id}/release`, b),
  settle: (id, paymentRef) => post(`/api/receivables/${id}/settle`, paymentRef ? { paymentRef } : {}),
  audit: (id) => get(`/api/receivables/${id}/audit`),
  cersai: (id) => get(`/api/receivables/${id}/cersai`),
  exposure: (id) => get(`/api/receivables/${id}/exposure`),
  demoStep: (n, fuId) => post(`/api/demo/step/${n}`, { fuId }),
};
