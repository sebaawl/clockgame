import { test, expect } from '@playwright/test';
import { installClock, play } from './helpers.js';

test('locked sound previews play without changing ownership, balances or the equipped sound', async ({ page }) => {
  await installClock(page, { feedback: true });
  await page.goto('/'); await page.locator('#open-store').click();
  const before = await page.evaluate(() => localStorage.getItem('clocking:progress:v1'));
  for (const id of ['sound-felt', 'sound-wood', 'sound-clock']) {
    const ticks = await page.evaluate(() => window.__ticks);
    await page.locator(`[data-action="preview"][data-id="${id}"]`).click();
    expect(await page.evaluate(() => window.__ticks)).toBe(ticks + 1);
    expect(await page.evaluate(() => localStorage.getItem('clocking:progress:v1'))).toBe(before);
  }
  await expect(page.locator('[data-item="sound-clock"] [data-action="buy"]')).toBeDisabled();
  await expect(page.locator('[data-item="sound-felt"] [data-action="equip"]')).toHaveText('Equipado ✓');
});

test('new clocks render distinctly and the moon reveals the new theme from its position', async ({ page }) => {
  await installClock(page);
  await page.addInitScript(() => localStorage.setItem('clocking:progress:v1', JSON.stringify({ version: 1, owned: ['original', 'eclipse', 'pulse', 'diamond', 'efficient', 'precision'] })));
  await page.goto('/'); await play(page); await page.locator('#settings-button').click();
  await page.locator('#tab-extras').click();
  await page.locator('[data-extra="eclipse"]').click();
  await expect(page.locator('.clock-face')).toHaveCSS('stroke-width', '15px');
  await page.locator('[data-extra="pulse"]').click();
  await expect(page.locator('.clock-face')).toHaveCSS('stroke-dasharray', '12px, 8px');
  await page.locator('[data-extra="diamond"]').click();
  await expect(page.locator('.square-face')).toHaveCSS('display', 'block');
  await expect(page.locator('.clock-face')).toHaveCSS('display', 'none');
  await page.locator('[data-extra="efficient"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-boosts', 'efficient');
  await page.getByRole('switch', { name: 'Modo claro', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => window.__motions.some(m => m.options.pseudoElement === '::view-transition-new(root)' && m.options.duration === 620))).toBe(true);
  await page.getByRole('switch', { name: 'Modo claro', exact: true }).uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
