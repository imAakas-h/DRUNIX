'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
process.env.NODE_ENV = 'development';
process.env.LEDGER_MODE = 'simulation';
process.env.LEDGER_ALLOWED_MODES = 'simulation';
process.env.DATA_DIR = path.resolve(process.env.SIMULATION_DATA_DIR || './data/demo');
process.env.SIMULATION_LEDGER_FILE = path.join(process.env.DATA_DIR, 'simulation-ledger.json');
process.env.HOST = '127.0.0.1';
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
require('../server/index').startServer().catch((e) => {
  console.error('RASID demo startup failed:', e.message);
  process.exitCode = 1;
});
