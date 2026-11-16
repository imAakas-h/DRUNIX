'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DevLedger } = require('./ledger-dev');

const ZERO_HASH = '0'.repeat(64);
const ORGANIZATIONS = {
  OPERATOR: { name: 'DRUNIX Platform Operator', mspId: 'SimOperatorMSP' },
  FINANCIER_A: { name: 'Financier A', mspId: 'SimFinancierAMSP' },
  FINANCIER_B: { name: 'Financier B', mspId: 'SimFinancierBMSP' },
  FINANCIER_C: { name: 'Financier C', mspId: 'SimFinancierCMSP' },
  FINANCIER_D: { name: 'Financier D', mspId: 'SimFinancierDMSP' },
  INSURER: { name: 'Insurer / Guarantor', mspId: 'SimInsurerMSP' },
  AUDITOR: { name: 'Independent Auditor', mspId: 'SimAuditorMSP' },
};

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function serialize(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : serialize(value)).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function endorsersFor(identity, operation, args) {
  const initiator = ORGANIZATIONS[identity] || { name: identity, mspId: 'SimUnknownMSP' };
  if (operation === 'TransferPosition') {
    const recipient = Object.keys(ORGANIZATIONS).find((key) => key === args[1]);
    return [initiator, ...(recipient ? [ORGANIZATIONS[recipient]] : [])]
      .filter((org, index, list) => list.findIndex((other) => other.mspId === org.mspId) === index);
  }
  if (['RegisterFactoringUnit', 'AcceptFactoringUnit', 'SettleReceivable'].includes(operation)) {
    return [initiator, { name: 'Buyer Organization (simulated)', mspId: 'SimBuyerMSP' }];
  }
  return [initiator, { name: 'DRUNIX Platform Operator', mspId: 'SimOperatorMSP' }];
}

class SimulationLedger extends DevLedger {
  constructor({ filePath = path.resolve(process.env.SIMULATION_LEDGER_FILE || path.join(process.env.DATA_DIR || './data', 'simulation-ledger.json')) } = {}) {
    super();
    this.mode = 'simulation';
    this.filePath = path.resolve(filePath);
    this.blocks = [];
    if (fs.existsSync(this.filePath)) this.load();
  }

  organizationFor(identity) {
    return ORGANIZATIONS[identity] || { name: identity, mspId: 'SimUnknownMSP' };
  }

  load() {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Could not read simulation ledger ${this.filePath}: ${error.message}`);
    }
    if (data.version !== 1 || !Array.isArray(data.state) || !Array.isArray(data.blocks)) {
      throw new Error(`Invalid simulation ledger format: ${this.filePath}`);
    }
    this.kv = new Map(data.state.map(([key, entry]) => [key, entry]));
    this.blocks = data.blocks;
    const verification = this.verify();
    if (!verification.ok) throw new Error(`Simulation ledger integrity check failed at block ${verification.brokenAt}: ${verification.reason}`);
    const last = this.blocks[this.blocks.length - 1];
    this.lastSuccessfulTransaction = last?.transactions[last.transactions.length - 1]
      ? { txId: last.transactions[last.transactions.length - 1].transactionId, at: last.timestamp }
      : null;
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({
      version: 1,
      state: [...this.kv.entries()],
      blocks: this.blocks,
    }, null, 2), { flag: 'w' });
    fs.renameSync(temporary, this.filePath);
  }

  async propose(identity, fn, args) {
    let proposal;
    try {
      proposal = await super.propose(identity, fn, args);
    } catch (error) {
      if (error.txId && !error.txId.startsWith('SIM-')) error.txId = `SIM-${error.txId}`;
      throw error;
    }
    proposal.txId = `SIM-${proposal.txId}`;
    proposal.identity = identity;
    proposal.operation = fn;
    proposal.args = clone(args);
    proposal.changes = [...proposal.writes.entries()].map(([key, after]) => ({
      key,
      before: this.kv.has(key) ? clone(this.kv.get(key).value) : null,
      after: clone(after),
    }));
    return proposal;
  }

  async commit(proposal) {
    const result = await super.commit(proposal);
    if (result.status !== 'COMMITTED') return result;

    const organization = this.organizationFor(proposal.identity);
    const timestamp = new Date().toISOString();
    const transaction = {
      transactionId: proposal.txId,
      timestamp,
      operation: proposal.operation,
      chaincode: 'rasid-simulation',
      status: 'SIMULATED_COMMIT',
      initiator: {
        id: proposal.identity,
        organization: organization.name,
        mspId: organization.mspId,
      },
      endorsements: endorsersFor(proposal.identity, proposal.operation, proposal.args)
        .map((endorser) => ({ ...endorser, simulated: true })),
      ordering: { service: 'Simulated Fabric ordering service', status: 'SIMULATED_ORDERED', simulated: true },
      data: { arguments: proposal.args, writes: proposal.writes.size, changes: proposal.changes },
    };
    transaction.transactionHash = sha256(transaction);
    const block = {
      blockNumber: this.blocks.length + 1,
      timestamp,
      previousHash: this.blocks.at(-1)?.hash || ZERO_HASH,
      transactionCount: 1,
      transactions: [transaction],
    };
    block.hash = sha256(block);
    this.blocks.push(block);
    result.blockNumber = block.blockNumber;
    this.lastSuccessfulTransaction = { txId: proposal.txId, at: timestamp };
    this.persist();
    return result;
  }

  verify() {
    let previousHash = ZERO_HASH;
    const replayedState = new Map();
    const versions = new Map();
    for (let index = 0; index < this.blocks.length; index++) {
      const block = this.blocks[index];
      if (!block || !Array.isArray(block.transactions) || typeof block.hash !== 'string') {
        return { ok: false, records: index, brokenAt: index + 1, reason: 'invalid block structure' };
      }
      if (block.blockNumber !== index + 1) return { ok: false, records: index, brokenAt: index + 1, reason: 'block number mismatch' };
      if (block.previousHash !== previousHash) return { ok: false, records: index, brokenAt: index + 1, reason: 'previous block hash mismatch' };
      if (block.transactionCount !== block.transactions.length) return { ok: false, records: index, brokenAt: index + 1, reason: 'transaction count mismatch' };
      for (const transaction of block.transactions) {
        if (!transaction?.data || !Array.isArray(transaction.data.changes)) {
          return { ok: false, records: index, brokenAt: index + 1, reason: 'invalid transaction state changes' };
        }
        const { transactionHash, ...transactionBody } = transaction;
        if (sha256(transactionBody) !== transactionHash) {
          return { ok: false, records: index, brokenAt: index + 1, reason: 'transaction hash mismatch' };
        }
        for (const change of transaction.data.changes) {
          const before = replayedState.has(change.key) ? replayedState.get(change.key) : null;
          if (serialize(before) !== serialize(change.before)) {
            return { ok: false, records: index, brokenAt: index + 1, reason: 'transaction state history mismatch' };
          }
          replayedState.set(change.key, change.after);
          versions.set(change.key, (versions.get(change.key) || 0) + 1);
        }
      }
      const { hash, ...blockBody } = block;
      if (sha256(blockBody) !== hash) return { ok: false, records: index, brokenAt: index + 1, reason: 'block hash mismatch' };
      previousHash = hash;
    }
    if (replayedState.size !== this.kv.size) {
      return { ok: false, records: this.blocks.length, brokenAt: this.blocks.length || 1, reason: 'ledger state does not match block history' };
    }
    for (const [key, value] of replayedState) {
      const entry = this.kv.get(key);
      if (!entry || entry.v !== versions.get(key) || serialize(entry.value) !== serialize(value)) {
        return { ok: false, records: this.blocks.length, brokenAt: this.blocks.length || 1, reason: 'ledger state does not match block history' };
      }
    }
    return { ok: true, records: this.blocks.length, latestBlockNumber: this.blocks.length, latestHash: previousHash };
  }

  snapshot() {
    return clone(this.blocks);
  }

  findTransaction(transactionId) {
    for (const block of this.blocks) {
      const transaction = block.transactions.find((item) => item.transactionId === transactionId);
      if (transaction) return { block: clone(block), transaction: clone(transaction) };
    }
    return null;
  }

  reset() {
    this.kv.clear();
    this.blocks = [];
    this.lastSuccessfulTransaction = null;
    this.persist();
  }

  async health() {
    return {
      ok: true,
      mode: 'simulation',
      status: 'SIMULATION READY',
      networkName: 'Simulated Fabric Network',
      channelName: 'mychannel (simulated)',
      chaincodeName: 'RASID (simulated)',
      peerConnectionStatus: 'SIMULATED',
      identityAuthenticationStatus: 'SIMULATED',
      chaincodeAvailabilityStatus: 'SIMULATED',
      latestBlockNumber: this.blocks.length || null,
      lastSuccessfulTransaction: this.lastSuccessfulTransaction,
      lastCheckAt: new Date().toISOString(),
      lastError: null,
      detail: 'Local blockchain simulation only. No live Fabric network activity is performed.',
    };
  }
}

module.exports = { SimulationLedger, ZERO_HASH, serialize, sha256, ORGANIZATIONS };
