import { test, expect } from '@playwright/test';
import { installClock } from './helpers.js';

test('shop muffles the same menu theme, previews remain audible and leaving restores the filter', async ({ page }) => {
  await installClock(page, { feedback: true });
  await page.addInitScript(() => {
    const Audio = window.AudioContext || window.webkitAudioContext;
    const create = Audio.prototype.createBiquadFilter;
    Audio.prototype.createBiquadFilter = function (...args) {
      const filter = create.apply(this, args);
      window.__musicFilter ||= filter;
      return filter;
    };
  });
  await page.goto('/');
  await page.locator('#open-store').click();
  const menu = page.locator('audio[data-music="menu"]');
  const source = await menu.getAttribute('src');
  await expect.poll(() => page.evaluate(() => window.__musicFilter.frequency.value)).toBeLessThan(600);
  await expect(menu).toHaveJSProperty('paused', false);
  const before = await page.evaluate(() => window.__ticks);
  await page.locator('[data-action="preview"][data-id="sound-felt"]').click();
  expect(await page.evaluate(() => window.__ticks)).toBeGreaterThan(before);
  await expect.poll(() => page.evaluate(() => window.__musicFilter.frequency.value)).toBeLessThan(600);
  await page.locator('#open-daily').click();
  await expect.poll(() => page.evaluate(() => window.__musicFilter.frequency.value)).toBeGreaterThan(18000);
  expect(await menu.getAttribute('src')).toBe(source);
  await page.locator('#open-store').click();
  await expect.poll(() => page.evaluate(() => window.__musicFilter.frequency.value)).toBeLessThan(600);
  await page.locator('#open-play').click();
  await expect.poll(() => page.evaluate(() => window.__musicFilter.frequency.value)).toBeGreaterThan(18000);
  expect(await menu.getAttribute('src')).toBe(source);
});
