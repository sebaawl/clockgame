import { test, expect } from '@playwright/test';
import { createProgress, PROGRESS_KEY } from '../../src/progression.js';
import { installClock, play, solve, selectChoice } from './helpers.js';

test('buy three slots and compass, preserve the loadout, replace slot three and signal the exact turnaround', async ({ page }) => {
  await installClock(page, { feedback: true });
  const progress = createProgress(); progress.coins = 1130; progress.owned.push('recharge', 'lock');
  await page.addInitScript(({ key, progress }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(progress)); }, { key: PROGRESS_KEY, progress });
  await page.goto('/'); await page.locator('#open-store').click();
  await page.getByRole('button', { name: 'Boosts', exact: true }).click(); await page.clock.runFor(450);
  await page.locator('[data-item="triple"] [data-action="buy"]').click();
  await page.locator('[data-item="compass"] [data-action="buy"]').click();
  await expect(page.locator('#wallet-coins strong')).toHaveText('0');
  for (const id of ['compass', 'recharge', 'lock']) await page.locator(`[data-item="${id}"] [data-action="equip"]`).click();
  await expect(page.locator('[data-slot-index="2"] strong')).toHaveText('Nitro Lock');
  await page.reload(); await selectChoice(page, 'format', 'survival'); await play(page);
  await expect(page.locator('#time')).toHaveText('14.0');
  await expect(page.locator('body')).toHaveAttribute('data-boosts', 'compass recharge lock');
  await page.locator('#settings-button').click(); await page.locator('#tab-extras').click();
  await expect(page.locator('#settings .boost-slot.locked')).toHaveCount(0);
  await page.locator('[data-remove-boost="lock"]').click();
  await expect(page.locator('[data-slot-index="2"] strong')).toHaveText('Disponible');
  await page.locator('[data-boost-slot="2"]').click(); await page.locator('[data-extra="lock"]').click();
  await expect(page.locator('[data-slot-index="2"] strong')).toHaveText('Nitro Lock');
  await page.locator('#continue-game').click(); await page.clock.runFor(300);
  for (let i = 0; i < 2; i++) { await solve(page); await page.clock.runFor(1000); }
  await expect(page.locator('#challenge-panel')).toHaveAttribute('data-guide', 'free');
  await page.evaluate(() => {
    const dir = -Number(document.body.dataset.challengeDirection);
    for (let i = 0; i < 36 && document.querySelector('#challenge-panel').dataset.guide === 'free'; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: dir === 1 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
    }
  });
  await expect(page.locator('#challenge-panel')).toHaveAttribute('data-guide', 'turn');
  await expect(page.locator('#challenge-hint')).toContainText('GIRA AHORA');
  expect(await page.evaluate(() => window.__pulses.some(p => JSON.stringify(p) === '[10,20,10]'))).toBe(true);
  await solve(page);
  await expect(page.locator('#challenge-panel')).toHaveAttribute('data-guide', 'release');
});
