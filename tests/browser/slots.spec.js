import { test, expect } from '@playwright/test';
import { createProgress, PROGRESS_KEY } from '../../src/progression.js';
import { installClock, play } from './helpers.js';

test('purchase double slot, equip two boosts, prevent a third and play with both effects', async ({ page }) => {
  await installClock(page);
  const p = createProgress(new Date(2026, 9, 19, 12)); p.coins = 600; p.owned.push('recharge', 'lock', 'tank');
  await page.addInitScript(({ key, p }) => { Math.random = () => .9999; if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(p)); }, { key: PROGRESS_KEY, p });
  await page.goto('/'); await page.locator('#open-store').click();
  await page.getByRole('button', { name: 'Boosts', exact: true }).click(); await page.clock.runFor(450);
  await page.locator('[data-item="dual"] [data-action="buy"]').click();
  await expect(page.locator('#wallet-coins strong')).toHaveText('0');
  for (const id of ['recharge', 'lock']) await page.locator(`[data-item="${id}"] [data-action="equip"]`).click();
  await page.locator('[data-item="tank"] [data-action="equip"]').click();
  await expect(page.locator('#store-notice')).toContainText('liberar una ranura');
  await expect(page.locator('[data-item="recharge"] [data-action="equip"]')).toHaveText('Ranura 1 ✓');
  await expect(page.locator('[data-item="lock"] [data-action="equip"]')).toHaveText('Ranura 2 ✓');
  await page.reload(); await play(page);
  await expect(page.locator('body')).toHaveAttribute('data-boosts', 'recharge lock');
  await page.mouse.move(page.viewportSize().width - 30, page.viewportSize().height / 2); await page.mouse.down(); await page.clock.runFor(600);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('#nitro-message')).toContainText('LOCK');
  const charge = Number(await page.locator('#nitro-meter').getAttribute('aria-valuenow'));
  expect(charge).toBeGreaterThan(45); expect(charge).toBeLessThan(47);
  await page.mouse.up();
});
