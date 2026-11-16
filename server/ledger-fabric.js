'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LedgerError } = require('./ledger-dev');

const IDENTITY_NAMES = ['OPERATOR', 'FINANCIER_A', 'FINANCIER_B', 'FINANCIER_C', 'FINANCIER_D', 'INSURER', 'AUDITOR'];
const TX_CODES = { 0: 'COMMITTED', 9: 'DUPLICATE_TXID', 10: 'ENDORSEMENT_POLICY_FAILURE', 11: 'MVCC_READ_CONFLICT', 12: 'PHANTOM_READ_CONFLICT', 22: 'BAD_RWSET', 254: 'NOT_VALIDATED', 255: 'INVALID_OTHER_REASON' };

function parseErr(e) {
  const details = Array.isArray(e.details) ? e.details.map((d) => d.message) : [];
  const text = [e.message, ...details].filter(Boolean).join(' | ');
  const m = /RASID:([A-Z_]+):\s*([^|"\n]*)/.exec(text);
  return m ? new LedgerError('REJECTED_CHAINCODE', m[1], m[2].trim()) : new LedgerError('NETWORK_ERROR', 'ENDORSEMENT_FAILED', text.slice(0, 300));
}

function expandEnv(value) {
  if (typeof value !== 'string') return value;
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(value);
  return match ? process.env[match[1]] || '' : value;
}

function firstFile(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isDirectory()) return filePath;
  const file = fs.readdirSync(filePath).sort().find((name) => fs.statSync(path.join(filePath, name)).isFile());
  if (!file) throw new Error('configured credential directory is empty');
  return path.join(filePath, file);
}

class FabricLedger {
  constructor(cfg) {
    this.mode = 'drunix';
    this.cfg = cfg;
    this.clients = new Map();
    this.gateways = new Map();
    this.contracts = new Map();
    this.lastSuccessfulTransaction = null;
    this.lastCheckAt = null;
    this.lastHealth = null;
    this.ids = {};
    this.configurationErrors = [];
    try {
      if (!cfg.identitiesFile) throw new Error('IDENTITIES_FILE is required');
      const file = path.resolve(cfg.identitiesFile);
      if (!fs.existsSync(file)) throw new Error(`identity configuration file not found: ${file}`);
      const input = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const [name, identity] of Object.entries(input)) {
        this.ids[name] = Object.fromEntries(Object.entries(identity).map(([key, value]) => [key, expandEnv(value)]));
      }
    } catch (e) {
      this.configurationErrors.push(e.message);
    }

    const certificates = new Map();
    const signingKeys = new Map();
    const commonNames = new Map();
    for (const name of IDENTITY_NAMES) {
      const id = this.ids[name];
      if (!id) {
        this.configurationErrors.push(`${name} identity is not configured`);
        continue;
      }
      for (const field of ['mspId', 'certPath', 'keyPath', 'peerEndpoint', 'hostAlias', 'tlsCertPath']) {
        if (!id[field]) this.configurationErrors.push(`${name}.${field} is not configured`);
      }
      if (['mspId', 'certPath', 'keyPath', 'peerEndpoint', 'hostAlias', 'tlsCertPath'].every((field) => id[field])) {
        try {
          const configured = this.identity(name);
          const fingerprint = crypto.createHash('sha256').update(fs.readFileSync(configured.certPath)).digest('hex');
          const priorCertificate = certificates.get(fingerprint);
          const priorKey = signingKeys.get(configured.keyFingerprint);
          const priorCN = commonNames.get(configured.cn);
          if (priorCertificate) this.configurationErrors.push(`${name} and ${priorCertificate} use the same client certificate`);
          else certificates.set(fingerprint, name);
          if (priorKey) this.configurationErrors.push(`${name} and ${priorKey} use the same signing key`);
          else signingKeys.set(configured.keyFingerprint, name);
          if (priorCN) this.configurationErrors.push(`${name} and ${priorCN} use the same certificate Common Name`);
          else commonNames.set(configured.cn, name);
        }
        catch (e) { this.configurationErrors.push(e.message); }
      }
    }
    if (!cfg.channel) this.configurationErrors.push('CHANNEL is not configured');
    if (!cfg.chaincode) this.configurationErrors.push('CHAINCODE is not configured');
  }

  identity(name) {
    const id = this.ids[name];
    if (!id) throw new LedgerError('CONFIGURATION_REQUIRED', 'NO_IDENTITY', `${name} identity is not configured`);
    const paths = {};
    try {
      for (const field of ['certPath', 'keyPath', 'tlsCertPath']) {
        if (!id[field]) throw new Error(`${name}.${field} is not configured`);
        paths[field] = firstFile(path.resolve(id[field]));
      }
      const cert = new crypto.X509Certificate(fs.readFileSync(paths.certPath));
      new crypto.X509Certificate(fs.readFileSync(paths.tlsCertPath));
      const privateKey = crypto.createPrivateKey(fs.readFileSync(paths.keyPath));
      const keyPublic = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
      const certPublic = cert.publicKey.export({ type: 'spki', format: 'der' });
      if (!keyPublic.equals(certPublic)) throw new Error(`${name} private key does not match its client certificate`);
      const now = Date.now();
      if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) throw new Error(`${name} client certificate is not currently valid`);
      const cn = /(?:^|\n)CN=([^\n,]+)/.exec(cert.subject)?.[1];
      if (!cn) throw new Error(`${name} client certificate has no Common Name`);
      return { ...id, ...paths, cn, keyFingerprint: crypto.createHash('sha256').update(keyPublic).digest('hex') };
    } catch (e) {
      throw new LedgerError('CONFIGURATION_REQUIRED', 'INVALID_IDENTITY_CONFIGURATION', `${name}: ${e.message}`);
    }
  }

  cnOf(name) { return this.identity(name).cn; }

  contract(name) {
    if (this.contracts.has(name)) return this.contracts.get(name);
    const id = this.identity(name);
    const grpc = require('@grpc/grpc-js');
    const { connect, signers } = require('@hyperledger/fabric-gateway');
    const clientKey = `${id.peerEndpoint}|${id.tlsCertPath}|${id.hostAlias}`;
    let client = this.clients.get(clientKey);
    if (!client) {
      client = new grpc.Client(id.peerEndpoint, grpc.credentials.createSsl(fs.readFileSync(id.tlsCertPath)), {
        'grpc.ssl_target_name_override': id.hostAlias,
      });
      this.clients.set(clientKey, client);
    }
    const gateway = connect({
      client,
      identity: { mspId: id.mspId, credentials: fs.readFileSync(id.certPath) },
      signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(id.keyPath))),
    });
    const contract = gateway.getNetwork(this.cfg.channel).getContract(this.cfg.chaincode);
    this.gateways.set(name, gateway);
    this.contracts.set(name, contract);
    return contract;
  }

  async propose(identity, fn, args) {
    try {
      const proposal = this.contract(identity).newProposal(fn, { arguments: args.map(String) });
      const transaction = await proposal.endorse();
      return { txId: proposal.getTransactionId(), transaction };
    } catch (e) { throw e instanceof LedgerError ? e : parseErr(e); }
  }

  async commit(p) {
    try {
      const submitted = await p.transaction.submit();
      const status = await submitted.getStatus();
      const result = {
        txId: p.txId,
        status: status.successful ? 'COMMITTED' : (TX_CODES[status.code] || `CODE_${status.code}`),
        blockNumber: Number(status.blockNumber),
      };
      if (result.status === 'COMMITTED') {
        this.lastSuccessfulTransaction = { txId: result.txId, blockNumber: result.blockNumber, at: new Date().toISOString() };
      }
      return result;
    } catch (e) { throw e instanceof LedgerError ? e : parseErr(e); }
  }

  async query(identity, fn, args) {
    try {
      return JSON.parse(Buffer.from(await this.contract(identity).evaluateTransaction(fn, ...args.map(String))).toString() || 'null');
    } catch (e) { throw e instanceof LedgerError ? e : parseErr(e); }
  }

  async health(identity = 'OPERATOR') {
    this.lastCheckAt = new Date().toISOString();
    const base = {
      mode: 'drunix',
      networkName: process.env.DRUNIX_NETWORK_NAME || null,
      channelName: this.cfg.channel || null,
      chaincodeName: this.cfg.chaincode || null,
      peerConnectionStatus: 'NOT_CHECKED',
      identityAuthenticationStatus: 'NOT_CHECKED',
      chaincodeAvailabilityStatus: 'NOT_CHECKED',
      latestBlockNumber: this.lastSuccessfulTransaction?.blockNumber ?? null,
      lastSuccessfulTransaction: this.lastSuccessfulTransaction,
      lastCheckAt: this.lastCheckAt,
      lastError: null,
    };
    if (this.configurationErrors.length) {
      this.lastHealth = {
        ...base,
        ok: false,
        status: 'CONFIGURATION REQUIRED',
        lastError: this.configurationErrors.join('; '),
      };
      return this.lastHealth;
    }
    try {
      const me = await this.query(identity, 'WhoAmI', []);
      this.lastHealth = {
        ...base,
        ok: true,
        status: 'CONNECTED',
        peerConnectionStatus: 'CONNECTED',
        identityAuthenticationStatus: 'AUTHENTICATED',
        chaincodeAvailabilityStatus: 'AVAILABLE',
        authenticatedIdentity: me.id,
      };
    } catch (e) {
      const message = e.message || String(e);
      const unknownIdentity = e.code === 'UNKNOWN_IDENTITY' || /unknown identity|not registered participant/i.test(message);
      const authenticationFailed = unknownIdentity || /unauthenticated|permission denied|access denied|invalid identity|creator.*(invalid|failed)|msp.*(invalid|not found)/i.test(message);
      const missingChaincode = /chaincode.*(not found|unavailable|does not exist)|no such chaincode|cannot find chaincode|chaincode definition.*not found|chaincode.*not defined/i.test(message);
      const configuration = e.kind === 'CONFIGURATION_REQUIRED' || e.code === 'NO_IDENTITY';
      this.lastHealth = {
        ...base,
        ok: false,
        status: configuration ? 'CONFIGURATION REQUIRED' : authenticationFailed ? 'AUTHENTICATION FAILED' : missingChaincode ? 'CHAINCODE UNAVAILABLE' : 'DISCONNECTED',
        peerConnectionStatus: configuration ? 'NOT_CHECKED' : authenticationFailed || missingChaincode ? 'CONNECTED' : 'DISCONNECTED',
        identityAuthenticationStatus: authenticationFailed ? 'FAILED' : configuration ? 'NOT_CHECKED' : 'UNKNOWN',
        chaincodeAvailabilityStatus: missingChaincode ? 'UNAVAILABLE' : 'UNKNOWN',
        lastError: message,
      };
    }
    return this.lastHealth;
  }

  async close() {
    const gateways = [...this.gateways.values()];
    const clients = [...this.clients.values()];
    this.gateways.clear();
    this.contracts.clear();
    this.clients.clear();
    const errors = [];
    for (const gateway of gateways) {
      try { gateway.close(); } catch (e) { errors.push(e); }
    }
    for (const client of clients) {
      try { client.close(); } catch (e) { errors.push(e); }
    }
    if (errors.length) throw new AggregateError(errors, 'Failed to close Fabric Gateway connections');
  }
}

module.exports = { FabricLedger, IDENTITY_NAMES };
