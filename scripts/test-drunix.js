'use strict';
const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['--test', 'test/api.test.js', 'test/ledger-config.test.js'], {
  stdio: 'inherit',
  env: { ...process.env, LEDGER_MODE: 'drunix' },
});
if (result.error) {
  console.error('Could not start Drunix integration tests:', result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
