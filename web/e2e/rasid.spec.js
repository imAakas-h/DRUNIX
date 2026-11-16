import { test, expect, login, logout, nav } from './fixtures';

const RUN = Date.now().toString(36).toUpperCase();
const LAB = `FU-LAB-${RUN}`; const SET = `FU-SET-${RUN}`; const MAN = `FU-MAN-${RUN}`;
const NAMES = { OPERATOR: 'Platform Operator', FINANCIER_A: 'Financier A', INSURER: 'Insurer / Guarantor', AUDITOR: 'Auditor' };
const NAVS = {
  OPERATOR: ['Dashboard', 'Blockchain Networks', 'Blockchain Nodes', 'Smart Contract Sets', 'Middleware', 'Integration Tools', 'Storage', 'Private Keys', 'Insights', 'Resource Costs'],
  FINANCIER_A: ['Dashboard', 'Blockchain Networks', 'Blockchain Nodes', 'Smart Contract Sets', 'Middleware', 'Integration Tools', 'Storage', 'Private Keys', 'Insights', 'Resource Costs'],
  INSURER: ['Dashboard', 'Blockchain Networks', 'Blockchain Nodes', 'Smart Contract Sets', 'Middleware', 'Integration Tools', 'Storage', 'Private Keys', 'Insights', 'Resource Costs'],
  AUDITOR: ['Dashboard', 'Blockchain Networks', 'Blockchain Nodes', 'Smart Contract Sets', 'Middleware', 'Integration Tools', 'Storage', 'Private Keys', 'Insights', 'Resource Costs'],
};
const runStep = async (page, n) => { await page.getByTestId(`run-step-${n}`).click(); await expect(page.getByTestId(`step-${n}-result`)).toBeVisible({ timeout: 20_000 }); };
const useUnit = async (page, id) => { await page.getByLabel('Factoring unit ID').fill(id); };

test.describe.configure({ mode: 'serial' });

test.describe('authentication and role navigation', () => {
  test('wrong password is refused', async ({ page }) => {
    await page.goto('/'); await page.getByLabel('Password').fill('nope'); await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Wrong identity or password');
  });
  for (const [id, links] of Object.entries(NAVS)) {
    test(`${id}: sees exactly its navigation and cannot open other pages`, async ({ page }) => {
      await login(page, id);
      await expect(page.getByTestId('whoami')).toHaveText(NAMES[id]);
      await expect(page.getByTestId('mode-banner')).toContainText('DEV MODE — NOT DRUNIX');
      const shown = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').allInnerTexts();
      expect(shown.map((s) => s.trim())).toEqual(links);
      for (const l of links) { await nav(page, l).click(); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await expect(page.getByTestId('mode-banner')).toBeVisible(); }
      if (!['OPERATOR', 'AUDITOR'].includes(id)) { await page.goto('/lab'); await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/attack lab/i); }
    });
  }
});

test.describe('six-step demo and concurrency lab', () => {
  test('steps 1–4: registration, discount, re-discount, exactly one of two sales commits', async ({ page }) => {
    await login(page, 'OPERATOR'); await nav(page, 'Attack lab').click(); await useUnit(page, LAB);
    await runStep(page, 1); await expect(page.getByTestId('step-1-result')).toContainText('SIMULATED');
    await runStep(page, 2); await expect(page.getByTestId('step-2-result')).toContainText('Committed');
    await runStep(page, 3); await expect(page.getByTestId('step-3-result')).toContainText('₹2,88,000');
    await expect(page.getByTestId('step-3-result')).toContainText('₹1,92,000');
    await runStep(page, 4);
    await expect(page.getByTestId('attack-winner')).toHaveCount(1); await expect(page.getByTestId('attack-loser')).toHaveCount(1);
    await expect(page.getByTestId('attack-loser')).toContainText('Rejected at commit');
    await expect(page.getByTestId('attack-loser')).toContainText('MVCC_READ_CONFLICT'); // dev engine; on Drunix the code is whatever the network returns
    const txs = await page.getByTestId('step-4-result').locator('.font-mono', { hasText: /^tx / }).allInnerTexts(); expect(new Set(txs.map((t) => t.trim())).size).toBe(2);
    await expect(page.getByTestId('step-4-result')).toContainText('1 of 2 committed');
    await expect(page.getByTestId('step-4-result')).toContainText('₹1,92,000'); // attempted amount
    await expect(page.getByTestId('step-4-result').getByText('Ledger now')).toBeVisible();
  });
  test('step 5: five rule violations each show a classified rejection', async ({ page }) => {
    await login(page, 'OPERATOR'); await nav(page, 'Attack lab').click(); await useUnit(page, LAB); await runStep(page, 5);
    const t = page.getByTestId('step-5-result');
    for (const code of ['INSUFFICIENT_POSITION', 'NOT_A_HOLDER', 'INVALID_LIFECYCLE', 'REPLAYED_REFERENCE', 'ROLE_NOT_AUTHORISED']) await expect(t).toContainText(code);
    await expect(t.getByText('Rejected by chaincode')).toHaveCount(5);
  });
  test('step 6: settlement releases once and the replay is refused; CERSAI record is labelled simulated', async ({ page }) => {
    await login(page, 'OPERATOR'); await nav(page, 'Attack lab').click(); await useUnit(page, LAB); await runStep(page, 6);
    const t = page.getByTestId('step-6-result');
    await expect(t).toContainText('Committed'); await expect(t).toContainText('REPLAYED_REFERENCE'); await expect(t).toContainText('SIMULATED · not filed'); await expect(t).toContainText('settled');
  });
  test('step 4 on an already-settled unit is a clear error, not a crash', async ({ page }) => {
    await login(page, 'OPERATOR'); await nav(page, 'Attack lab').click(); await useUnit(page, LAB);
    await page.getByTestId('run-step-4').click(); await expect(page.getByRole('alert')).toContainText('NO_POSITION');
  });
  test('New run ID generates a fresh unit id', async ({ page }) => {
    await login(page, 'OPERATOR'); await nav(page, 'Attack lab').click();
    const before = await page.getByLabel('Factoring unit ID').inputValue(); await page.getByRole('button', { name: 'New run ID' }).click();
    const after = await page.getByLabel('Factoring unit ID').inputValue(); expect(after).not.toBe(before); expect(after).toMatch(/^FU-2041-R[A-Z0-9]{4}$/);
  });
});

test.describe('receivables, discounting and transfers through the UI', () => {
  test('operator registers a unit, sees it, and the simulated duplicate check blocks a DUP invoice', async ({ page }) => {
    await login(page, 'OPERATOR'); await nav(page, 'Receivables').click();
    await page.getByLabel('Unit ID').fill(MAN); await page.getByLabel('Invoice no.').fill('INV-MAN-1'); await page.getByLabel('Amount (₹)').fill('4,80,000');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByTestId('tx-result')).toContainText('Committed');
    await expect(page.getByTestId('receivables-table').getByRole('link', { name: MAN })).toBeVisible();
    await page.getByLabel('Unit ID').fill(`${MAN}-D`); await page.getByLabel('Invoice no.').fill('DUP-77'); await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByTestId('tx-result')).toContainText('SIMULATED_VERIFICATION_FAILED');
    await page.getByLabel('Unit ID').fill(MAN); await page.getByLabel('Invoice no.').fill('INV-MAN-2'); await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByTestId('tx-result')).toContainText('FU_EXISTS');
    await page.getByLabel('Amount (₹)').fill('abc'); await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter an amount' })).toBeVisible();
  });
  test('accept → discount → fractional transfer → over-allocation rejected, balances come from the ledger', async ({ page }) => {
    await login(page, 'OPERATOR'); await page.goto(`/receivables/${MAN}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('₹4,80,000');
    await page.getByRole('button', { name: 'Record buyer acceptance' }).click(); await expect(page.getByTestId('tx-result')).toContainText('Committed');
    await logout(page); await login(page, 'FINANCIER_A'); await page.goto(`/transfer?fu=${MAN}`);
    await page.getByRole('button', { name: /Discount and take 100%/ }).click(); await expect(page.getByTestId('tx-result')).toContainText('Committed');
    await page.getByLabel('Amount (₹)').fill('2,88,000'); await page.getByLabel('Recipient').selectOption('FINANCIER_B'); await page.getByRole('button', { name: 'Transfer', exact: true }).click();
    await expect(page.getByTestId('tx-result')).toContainText('Committed');
    await expect(page.getByText('Your position: ₹1,92,000')).toBeVisible();
    await page.getByLabel('Amount (₹)').fill('1,92,001'); await page.getByRole('button', { name: 'Transfer', exact: true }).click();
    await expect(page.getByTestId('tx-result')).toContainText('INSUFFICIENT_POSITION'); await expect(page.getByTestId('tx-result')).toContainText('Rejected by chaincode');
    await expect(page.getByText('Your position: ₹1,92,000')).toBeVisible(); // unchanged after rejection
    await page.goto(`/receivables/${MAN}`);
    await expect(page.getByText('Financier B 60% · ₹2,88,000')).toBeVisible(); await expect(page.getByText('Financier A 40% · ₹1,92,000')).toBeVisible();
  });
});

test.describe('settlement', () => {
  test('simulated settlement releases all positions once; replay is rejected; settled unit shows no unallocated balance', async ({ page }) => {
    await login(page, 'OPERATOR'); await nav(page, 'Attack lab').click(); await useUnit(page, SET);
    await runStep(page, 1); await runStep(page, 2); await runStep(page, 3);
    await page.goto(`/settlement?fu=${SET}`);
    await page.getByRole('button', { name: /Settle \(simulated payment\)/ }).click();
    await expect(page.getByTestId('tx-result')).toContainText('Committed'); await expect(page.getByText(/SIM-PAY-/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Replay last settlement reference' }).click();
    await expect(page.getByTestId('tx-result')).toContainText('REPLAYED_REFERENCE');
    await expect(page.getByRole('button', { name: /Settle \(simulated payment\)/ })).toBeDisabled();
    await page.goto(`/receivables/${SET}`); await expect(page.getByText('all positions released at settlement')).toBeVisible(); await expect(page.getByText(/unallocated/)).toHaveCount(0);
    await expect(page.getByText('Financier B 0% · ₹0 (released ₹2,88,000)')).toBeVisible();
  });
});

test.describe('audit and insurer', () => {
  test('auditor sees successful and rejected attempts with actor, time, reference and reason, plus an intact hash chain', async ({ page }) => {
    await login(page, 'AUDITOR'); await page.goto(`/audit?fu=${LAB}`);
    const rows = page.getByTestId('audit-table').locator('tbody tr'); await expect(rows.first()).toBeVisible();
    const text = await page.getByTestId('audit-table').innerText();
    for (const s of ['Committed', 'Rejected at commit', 'Rejected by chaincode', 'MVCC_READ_CONFLICT', 'INSUFFICIENT_POSITION', 'REPLAYED_REFERENCE', 'Financier A', 'Platform Operator', `${LAB}:atk-C`, 'on-chain']) expect(text).toContain(s);
    expect(text).toMatch(/\d\d:\d\d:\d\d\.\d{3}/);
    await expect(page.getByTestId('chain-status')).toContainText('intact');
  });
  test('financier sees only own attempts; insurer sees read-only exposure with SIMULATED policy and no audit/transfer pages', async ({ page }) => {
    await login(page, 'FINANCIER_A'); await page.goto(`/audit?fu=${LAB}`);
    const text = await page.getByTestId('audit-table').innerText(); expect(text).not.toContain('Platform Operator');
    await logout(page); await login(page, 'INSURER'); await nav(page, 'Insurer exposure').click();
    await expect(page.getByText('SIMULATED policy').first()).toBeVisible(); await expect(page.getByRole('button', { name: /transfer|settle|release/i })).toHaveCount(0);
    await page.goto('/audit'); await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Audit timeline');
  });
  test('network page reports the real mode and measured samples', async ({ page }) => {
      await login(page, 'AUDITOR'); await nav(page, 'Blockchain Networks').click();
    await expect(page.getByTestId('net-mode')).toHaveText('dev'); await expect(page.getByText(/Successful transactions measured/)).toContainText(/\d+/);
  });
});

  test.describe('blockchain network preferences', () => {
    test('selects Hyperledger Fabric, creates a persistent demo entry, and opens its details', async ({ page }) => {
      await login(page, 'OPERATOR');
      await nav(page, 'Blockchain Networks').click();
      await page.getByRole('button', { name: 'Add a Blockchain Network' }).click();
      await expect(page.getByRole('dialog')).toContainText('Select your network preference');
      await page.getByRole('button', { name: 'Hyperledger Fabric' }).click();
      await expect(page.getByRole('heading', { name: 'Hyperledger Fabric' })).toBeVisible();
      await page.locator('.preview-continue').click();
      await expect(page.getByText(/creates a saved demonstration entry in this browser only/)).toBeVisible();
      await page.getByLabel('Display name').fill('Fabric Acceptance Demo');
      await page.getByRole('button', { name: 'Create demo network' }).click();
      const row = page.getByRole('row', { name: /Fabric Acceptance Demo/ });
      await expect(row).toContainText('Hyperledger Fabric');
      await expect(row).toContainText('Local demo setup');
      await expect(row).toContainText('Configured');
      await page.reload();
      await expect(page.getByRole('row', { name: /Fabric Acceptance Demo/ })).toBeVisible();
      await page.getByRole('row', { name: /Fabric Acceptance Demo/ }).getByRole('button', { name: /View details/ }).click();
      await expect(page.getByRole('dialog')).toContainText('This overview describes a local demo configuration');
      await expect(page.getByRole('dialog')).toContainText('local UI demonstration only');
      await page.getByRole('button', { name: 'Close dialog' }).click();
    });

    test('network layout remains usable at a narrow viewport', async ({ page }) => {
      await login(page, 'AUDITOR');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Blockchain Networks' })).toBeVisible();
      await nav(page, 'Blockchain Networks').click();
      await expect(page.getByRole('heading', { name: 'Blockchain Networks' })).toBeVisible();
      await page.getByRole('button', { name: 'Add a Blockchain Network' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Hyperledger Fabric' }).click();
      await page.locator('.mobile-continue').click();
      await expect(page.getByLabel('Display name')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
