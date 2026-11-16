'use strict';
// DEV ENGINE — NOT DRUNIX. A local mirror of the Go chaincode with Fabric-style versioned reads
// (MVCC) so the UI/API can be developed and tested without a network. Results from this engine are
// NOT evidence of Drunix behaviour. The UI shows a permanent amber banner while it is active.
const crypto = require('crypto');

class LedgerError extends Error {
  constructor(kind, code, message) { super(message); this.kind = kind; this.code = code; }
}
const E = (code, msg) => Object.assign(new Error(`RASID:${code}: ${msg}`), { rasid: code });
const MOVABLE = ['DISCOUNTED', 'PARTIALLY_TRANSFERRED'];
const NEXT = { REGISTERED: ['ACCEPTED'], ACCEPTED: ['DISCOUNTED'], DISCOUNTED: ['PARTIALLY_TRANSFERRED', 'SETTLED'], PARTIALLY_TRANSFERRED: ['PARTIALLY_TRANSFERRED', 'SETTLED'], SETTLED: [] };
const can = (a, b) => (NEXT[a] || []).includes(b);
const needRole = (p, ...r) => { if (!r.includes(p.role)) throw E('ROLE_NOT_AUTHORISED', `role ${p.role} may not perform this action`); };
const int = (n) => { if (!Number.isSafeInteger(n) || n <= 0) throw E('INVALID_AMOUNT', 'amount must be a positive integer number of paise'); return n; };

class Ctx {
  constructor(l, cn, txId) { this.l = l; this.cn = cn; this.txId = txId; this.reads = new Map(); this.writes = new Map(); this.ts = new Date().toISOString(); }
  get(k) {
    if (this.writes.has(k)) return clone(this.writes.get(k));
    const e = this.l.kv.get(k); if (!this.reads.has(k)) this.reads.set(k, e ? e.v : 0);
    return e ? clone(e.value) : null;
  }
  put(k, v) { this.writes.set(k, clone(v)); }
  range(prefix) {
    const keys = new Set([...this.l.kv.keys(), ...this.writes.keys()]);
    return [...keys].filter((k) => k.startsWith(prefix)).sort().map((k) => this.get(k)).filter(Boolean);
  }
  actor() {
    const p = this.get('PART~' + this.cn);
    if (!p) throw E('UNKNOWN_IDENTITY', `identity "${this.cn}" is not a registered participant`);
    return p;
  }
  claim(prefix, ref) {
    if (!ref || String(ref).includes('~')) throw E('INVALID_REQUEST', 'a unique reference is required');
    if (this.get(`${prefix}~${ref}`)) throw E('REPLAYED_REFERENCE', `reference "${ref}" was already used`);
    this.put(`${prefix}~${ref}`, { txId: this.txId, at: this.ts });
  }
  fu(id) { const f = this.get('FU~' + id); if (!f) throw E('FU_NOT_FOUND', `factoring unit "${id}" does not exist`); return f; }
  audit(fu, action, actor, details) { this.put(`AUD~${fu}~${this.txId}`, { txId: this.txId, fuId: fu, action, actor, details, at: this.ts }); }
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const pk = (fu, h) => `POS~${fu}~${h}`;

const cc = {
  BootstrapOperator(c, id) {
    if (c.get('BOOT')) throw E('ALREADY_BOOTSTRAPPED', 'operator already bound');
    c.put('BOOT', { cn: c.cn });
    c.put('PART~' + c.cn, { cn: c.cn, id, role: 'OPERATOR', msp: 'DevMSP' }); c.put('PARTID~' + id, c.cn);
  },
  RegisterParticipant(c, cn, id, role, msp) {
    needRole(c.actor(), 'OPERATOR');
    c.put('PART~' + cn, { cn, id, role, msp }); c.put('PARTID~' + id, cn);
  },
  WhoAmI: (c) => c.actor(),
  RegisterFactoringUnit(c, fuId, buyer, amt, evidenceHash, ref) {
    const a = c.actor(); needRole(a, 'OPERATOR'); c.claim('REQ', ref);
    if (c.get('FU~' + fuId)) throw E('FU_EXISTS', `factoring unit "${fuId}" is already registered`);
    int(amt);
    c.put('FU~' + fuId, { fuId, buyer, currency: 'INR', outstandingPaise: amt, status: 'REGISTERED', evidenceHash, registeredBy: a.id, updatedAt: c.ts });
    c.audit(fuId, 'REGISTER', a.id, 'outstandingPaise=' + amt);
  },
  AcceptFactoringUnit(c, fuId, ref) {
    const a = c.actor(); needRole(a, 'OPERATOR'); c.claim('REQ', ref);
    const fu = c.fu(fuId);
    if (!can(fu.status, 'ACCEPTED')) throw E('INVALID_LIFECYCLE', `cannot accept a unit in status ${fu.status}`);
    fu.status = 'ACCEPTED'; fu.updatedAt = c.ts; c.put('FU~' + fuId, fu); c.audit(fuId, 'ACCEPT', a.id, 'buyer acceptance recorded');
  },
  DiscountFactoringUnit(c, fuId, ref) {
    const a = c.actor(); needRole(a, 'FINANCIER'); c.claim('REQ', ref);
    const fu = c.fu(fuId);
    if (!can(fu.status, 'DISCOUNTED')) throw E('INVALID_LIFECYCLE', `cannot discount a unit in status ${fu.status}`);
    fu.status = 'DISCOUNTED'; fu.updatedAt = c.ts; c.put('FU~' + fuId, fu);
    c.put(pk(fuId, a.id), { fuId, holderId: a.id, amountPaise: fu.outstandingPaise, releasedPaise: 0 });
    c.audit(fuId, 'DISCOUNT', a.id, 'initial position ' + fu.outstandingPaise);
  },
  TransferPosition(c, fuId, toId, amt, ref) {
    const a = c.actor(); needRole(a, 'FINANCIER'); c.claim('REQ', ref);
    const fu = c.fu(fuId);
    if (!MOVABLE.includes(fu.status)) throw E('INVALID_LIFECYCLE', `positions cannot move in status ${fu.status}`);
    if (toId === a.id) throw E('INVALID_REQUEST', 'cannot transfer to yourself');
    const toCn = c.get('PARTID~' + toId); const to = toCn && c.get('PART~' + toCn);
    if (!to || to.role !== 'FINANCIER') throw E('RECIPIENT_NOT_ELIGIBLE', `"${toId}" is not a registered financier`);
    int(amt);
    const from = c.get(pk(fuId, a.id)); // read + write of the same key => MVCC conflict on double sale
    if (!from || from.amountPaise <= 0) throw E('NOT_A_HOLDER', `caller holds no position in ${fuId}`);
    if (amt > from.amountPaise) throw E('INSUFFICIENT_POSITION', `requested ${amt} paise but holder has ${from.amountPaise}`);
    const dest = c.get(pk(fuId, toId)) || { fuId, holderId: toId, amountPaise: 0, releasedPaise: 0 };
    if (dest.amountPaise + amt > fu.outstandingPaise) throw E('OVER_ALLOCATION', 'position would exceed outstanding amount');
    from.amountPaise -= amt; dest.amountPaise += amt;
    c.put(pk(fuId, a.id), from); c.put(pk(fuId, toId), dest);
    if (fu.status === 'DISCOUNTED') { fu.status = 'PARTIALLY_TRANSFERRED'; fu.updatedAt = c.ts; c.put('FU~' + fuId, fu); }
    c.audit(fuId, 'TRANSFER', a.id, `${amt} paise to ${toId}`);
  },
  ReleasePosition(c, fuId, amt, ref) {
    const a = c.actor(); needRole(a, 'FINANCIER'); c.claim('REQ', ref);
    const fu = c.fu(fuId);
    if (!MOVABLE.includes(fu.status)) throw E('INVALID_LIFECYCLE', `positions cannot be released in status ${fu.status}`);
    int(amt);
    const p = c.get(pk(fuId, a.id));
    if (!p || p.amountPaise <= 0) throw E('NOT_A_HOLDER', `caller holds no position in ${fuId}`);
    if (amt > p.amountPaise) throw E('INSUFFICIENT_POSITION', `requested ${amt} paise but holder has ${p.amountPaise}`);
    p.amountPaise -= amt; p.releasedPaise += amt; c.put(pk(fuId, a.id), p); c.audit(fuId, 'RELEASE', a.id, `${amt} paise released`);
  },
  SettleReceivable(c, fuId, ref) {
    const a = c.actor(); needRole(a, 'OPERATOR'); c.claim('SETTLE', ref);
    const fu = c.fu(fuId);
    if (!can(fu.status, 'SETTLED')) throw E('INVALID_LIFECYCLE', `cannot settle a unit in status ${fu.status}`);
    let released = 0;
    for (const p of c.range(`POS~${fuId}~`)) { released += p.amountPaise; p.releasedPaise += p.amountPaise; p.amountPaise = 0; c.put(pk(fuId, p.holderId), p); }
    fu.status = 'SETTLED'; fu.updatedAt = c.ts; c.put('FU~' + fuId, fu);
    c.audit(fuId, 'SETTLE', a.id, `released ${released} paise, ref ${ref}`);
  },
  GetFactoringUnit: (c, id) => { c.actor(); return c.fu(id); },
  GetPositions: (c, id) => { c.actor(); return c.range(`POS~${id}~`); },
  ListFactoringUnits: (c) => { c.actor(); return c.range('FU~'); },
  GetAuditTrail: (c, id) => { c.actor(); return c.range(`AUD~${id}~`).sort((x, y) => (x.at < y.at ? -1 : 1)); },
};

class DevLedger {
  constructor() { this.mode = 'dev'; this.kv = new Map(); this.lastSuccessfulTransaction = null; }
  cnOf(identity) { return identity; }
  async propose(identity, fn, args) {
    const txId = crypto.randomBytes(16).toString('hex');
    const c = new Ctx(this, this.cnOf(identity), txId);
    if (!cc[fn]) {
      const error = new LedgerError('NETWORK_ERROR', 'UNKNOWN_FUNCTION', fn);
      error.txId = txId;
      throw error;
    }
    try { await cc[fn](c, ...args); } catch (e) {
      const error = e.rasid
        ? new LedgerError('REJECTED_CHAINCODE', e.rasid, e.message.replace(/^RASID:[A-Z_]+:\s*/, ''))
        : new LedgerError('NETWORK_ERROR', 'INTERNAL', e.message);
      error.txId = txId;
      throw error;
    }
    return { txId, reads: c.reads, writes: c.writes };
  }
  async commit(p) {
    await new Promise((r) => setImmediate(r));
    for (const [k, v] of p.reads) {
      const cur = this.kv.get(k); if ((cur ? cur.v : 0) !== v) return { txId: p.txId, status: 'MVCC_READ_CONFLICT', blockNumber: null };
    }
    for (const [k, value] of p.writes) { const cur = this.kv.get(k); this.kv.set(k, { value, v: (cur ? cur.v : 0) + 1 }); }
    this.lastSuccessfulTransaction = { txId: p.txId, at: new Date().toISOString() };
    return { txId: p.txId, status: 'COMMITTED', blockNumber: null };
  }
  async query(identity, fn, args) {
    const c = new Ctx(this, this.cnOf(identity), 'query');
    try { return await cc[fn](c, ...args); } catch (e) {
      throw new LedgerError('REJECTED_CHAINCODE', e.rasid || 'INTERNAL', e.message.replace(/^RASID:[A-Z_]+:\s*/, ''));
    }
  }
  async health() {
    return {
      ok: true,
      mode: 'dev',
      status: 'CONNECTED',
      networkName: 'Local development engine',
      channelName: null,
      chaincodeName: 'Development mirror',
      peerConnectionStatus: 'NOT_APPLICABLE',
      identityAuthenticationStatus: 'NOT_APPLICABLE',
      chaincodeAvailabilityStatus: 'NOT_APPLICABLE',
      latestBlockNumber: null,
      lastSuccessfulTransaction: this.lastSuccessfulTransaction,
      lastCheckAt: new Date().toISOString(),
      lastError: null,
      detail: 'Local development ledger only; not a Drunix network',
    };
  }
  reset() { this.kv.clear(); this.lastSuccessfulTransaction = null; }
}
module.exports = { DevLedger, LedgerError, cnOfPlaceholder: null };
