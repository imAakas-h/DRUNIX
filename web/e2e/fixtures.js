import { test as base, expect } from '@playwright/test';
export const PASSWORD = 'e2e-pass';
// Every test fails on uncaught page errors, console errors, failed requests and 5xx responses.
// 4xx responses are legitimate ledger/API rejections and are asserted by the tests themselves.
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) problems.push(`console: ${m.text()}`); });
    // ERR_ABORTED is the browser cancelling in-flight fetches when the test navigates away; every other failure counts.
    page.on('requestfailed', (r) => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    page.on('response', (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    await use(page);
    expect(problems, 'browser problems').toEqual([]);
  },
});
export { expect };
export async function login(page, identity, password = PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Sign in as').selectOption(identity);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('whoami')).toBeVisible();
}
export const logout = (page) => page.getByRole('button', { name: 'Sign out' }).click();
export const nav = (page, name) => page.locator('nav').getByRole('link', { name });
