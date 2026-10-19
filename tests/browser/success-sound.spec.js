import { test, expect } from '@playwright/test';
import { installClock, play, solve } from './helpers.js';

test('starting plays only the button; solves have a separately configurable tone', async ({ page }) => {
  await installClock(page, { feedback: true });
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    window.__mediaPlays = 0;
    HTMLMediaElement.prototype.play = function (...args) { window.__mediaPlays++; return original.apply(this, args); };
  });
  await page.goto('/');
  await page.locator('#start-game').click();
  expect(await page.evaluate(() => window.__mediaPlays)).toBe(1);
  await page.clock.runFor(3000);
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(560);
  let before = await page.evaluate(() => window.__ticks);
  await solve(page);
  expect(await page.evaluate(() => window.__ticks)).toBe(before + 6);
  await page.clock.runFor(1000);
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Sonido de acierto', exact: true }).uncheck();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  before = await page.evaluate(() => window.__ticks);
  await solve(page);
  expect(await page.evaluate(() => window.__ticks)).toBe(before + 5);
  await page.reload();
  await page.locator('#settings-button').click();
  await expect(page.getByRole('switch', { name: 'Sonido de acierto', exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Sonido', exact: true })).toBeChecked();
});
