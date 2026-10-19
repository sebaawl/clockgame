import { test, expect } from '@playwright/test';
import { installClock } from './helpers.js';

test('pill actions, three recorded sounds, persistent selection and global mute', async ({ page }) => {
  await installClock(page, { feedback: true });
  await page.goto('/');
  await expect(page.locator('#start-game')).toHaveCSS('border-radius', '999px');
  await page.locator('#mode-hard').click();
  expect(await page.evaluate(() => window.__ticks)).toBeGreaterThan(0);
  await page.clock.runFor(100);
  const beforePanel = await page.evaluate(() => window.__ticks);
  await page.locator('#settings-button').click();
  expect(await page.evaluate(() => window.__ticks)).toBeGreaterThan(beforePanel);
  await expect(page.locator('[data-sound]')).toHaveCount(3);
  for (const preset of ['wood', 'clock', 'felt']) {
    const before = await page.evaluate(() => window.__ticks);
    await page.locator(`[data-sound="${preset}"]`).click();
    await expect(page.locator(`[data-sound="${preset}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__ticks)).toBe(before + 1);
  }
  await page.locator('[data-sound="wood"]').click();
  await page.reload();
  await page.locator('#settings-button').click();
  await expect(page.locator('[data-sound="wood"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('switch', { name: /^Sonido$/ }).uncheck();
  const muted = await page.evaluate(() => window.__ticks);
  await page.locator('[data-sound="clock"]').click();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await page.locator('#mode-normal').click();
  expect(await page.evaluate(() => window.__ticks)).toBe(muted);
});
