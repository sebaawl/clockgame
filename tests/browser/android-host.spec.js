import { test, expect } from '@playwright/test';
import { installClock, play } from './helpers.js';

test('Android background event pauses play and Android back toggles settings', async ({ page }) => {
  await installClock(page);
  await page.goto('/');
  await play(page);
  await page.clock.runFor(1000);
  await page.evaluate(() => window.dispatchEvent(new Event('clocking:pause')));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  const remaining = await page.locator('#time').textContent();
  await page.clock.runFor(20000);
  await expect(page.locator('#time')).toHaveText(remaining);
  await page.evaluate(() => window.dispatchEvent(new Event('clocking:back')));
  await expect(page.locator('#settings')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('clocking:back')));
  await page.clock.runFor(240);
  await expect(page.locator('#settings')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});
