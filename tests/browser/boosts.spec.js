import { test, expect } from '@playwright/test';
import { installClock, play, solve } from './helpers.js';
import { createProgress, PROGRESS_KEY } from '../../src/progression.js';
async function setup(page, boost) {
  await installClock(page);
  const progress = createProgress(new Date(2026, 9, 19, 12));
  progress.owned.push(boost); progress.boost = boost;
  await page.addInitScript(({ key, progress }) => { Math.random = () => .9999; localStorage.setItem(key, JSON.stringify(progress)); }, { key: PROGRESS_KEY, progress });
  await page.goto('/'); await play(page);
}
async function hold(page, ms) {
  await page.mouse.move(page.viewportSize().width - 30, page.viewportSize().height / 2);
  await page.mouse.down(); await page.clock.runFor(ms);
}

test('Lock auto-stops three times, ignores a still-held finger in the next clock, and reloads after three manual solves', async ({ page }) => {
  await setup(page, 'lock');
  for (let i = 0; i < 3; i++) {
    await hold(page, 600);
    await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
    await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 0\./);
    await expect(page.locator('body')).toHaveAttribute('data-nitro', 'false');
    await expect(page.locator('#nitro-message')).toContainText(i === 2 ? 'RECARGA 3' : `${2 - i}/3`);
    await page.clock.runFor(1400);
    await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
    await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 11\./);
    await expect(page.locator('#combo')).toHaveText(`×${i + 1}`);
    await page.mouse.up();
  }
  await hold(page, 300);
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 0\./);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await page.mouse.up();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('#nitro-message')).toContainText('FALTAN 2');
  await page.clock.runFor(1000);
  for (let i = 0; i < 2; i++) { await solve(page); await page.clock.runFor(1000); }
  await expect(page.locator('#nitro-message')).toContainText('3/3');
  await hold(page, 600); await page.mouse.up();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('#combo')).toHaveText('×7');
  await expect(page.locator('#nitro-message')).toContainText('2/3');
});

test('double recharge appears in the shop and awards 10 rather than 5 Nitro on a perfect hour', async ({ page }) => {
  await setup(page, 'recharge'); await solve(page);
  await expect(page.locator('#nitro-value')).toHaveText('50%');
  await expect(page.locator('#combo')).toHaveText('×1');
});
