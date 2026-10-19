import { test, expect } from '@playwright/test';
import { selectChoice, installClock, play, solve } from './helpers.js';

async function holdLeft(page) {
  await page.mouse.move(30, page.viewportSize().height * .5);
  await page.mouse.down();
}
const position = page => page.locator('#clock').getAttribute('aria-label');

test.beforeEach(async ({ page }) => { await installClock(page); await page.goto('/'); });

test('short taps move once on release, and exactly 150 ms activates Nitro without an extra tap', async ({ page }) => {
  await play(page);
  await holdLeft(page);
  await page.clock.runFor(100);
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 5\./);
  await page.mouse.up();
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 4\./);
  await expect(page.locator('#nitro-value')).toHaveText('40%');
  await holdLeft(page);
  await page.clock.runFor(149);
  await expect(page.locator('body')).toHaveAttribute('data-nitro', 'false');
  await page.clock.runFor(1);
  await expect(page.locator('body')).toHaveAttribute('data-nitro', 'true');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 4\./);
  await page.mouse.up();
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 4\./);
});

test('passing twelve does not auto-solve; releasing at twelve rewards Perfect Nitro and stops immediately', async ({ page }) => {
  await play(page);
  await holdLeft(page);
  await page.clock.runFor(690);
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 0\./);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#score')).toHaveText('0');
  await page.mouse.up();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('body')).toHaveAttribute('data-nitro', 'false');
  await expect(page.locator('#combo')).toHaveText('×1');
  await expect(page.locator('#nitro-message')).toContainText('PERFECT NITRO');
  const charge = Number(await page.locator('#nitro-meter').getAttribute('aria-valuenow'));
  expect(charge).toBeGreaterThan(30); expect(charge).toBeLessThan(31);
  await page.clock.runFor(1000);
  expect(Number(await page.locator('#nitro-meter').getAttribute('aria-valuenow'))).toBe(charge);
  await expect(page.locator('body')).toHaveAttribute('data-phase', '2');
});

test('overshoot requires correction and pause cancels the held control without free moves', async ({ page }) => {
  await play(page);
  await holdLeft(page);
  await page.clock.runFor(800);
  await page.mouse.up();
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 11\./);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('#nitro-message')).not.toContainText('PERFECT');
  await page.clock.runFor(1000);
  await holdLeft(page);
  await page.clock.runFor(400);
  await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  const frozen = await position(page);
  const charge = await page.locator('#nitro-meter').getAttribute('aria-valuenow');
  await page.clock.runFor(3000);
  await page.mouse.up();
  expect(await position(page)).toBe(frozen);
  expect(await page.locator('#nitro-meter').getAttribute('aria-valuenow')).toBe(charge);
  await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('body')).toHaveAttribute('data-nitro', 'false');
});

test('survival recovers time, keeps counting through celebrations and crosses cycles without a break', async ({ page }) => {
  await selectChoice(page, 'format', 'survival');
  await play(page);
  await expect(page.locator('body')).toHaveAttribute('data-format', 'survival');
  await page.clock.runFor(2000);
  await solve(page);
  expect(Number(await page.locator('#time').textContent())).toBeGreaterThan(13);
  expect(Number(await page.locator('#time').textContent())).toBeLessThan(14);
  await expect(page.locator('#nitro-message')).toContainText('S');
  const recovered = Number(await page.locator('#time').textContent());
  await page.clock.runFor(1020);
  expect(Number(await page.locator('#time').textContent())).toBeLessThan(recovered);
  for (let i = 1; i < 12; i++) { await solve(page); await page.clock.runFor(1000); }
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'minutos');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#intermission')).not.toBeVisible();
  await expect(page.locator('#combo')).toHaveText('×12');
  await expect(page.locator('body')).toHaveAttribute('data-hot', 'true');
});

test('hours fill Nitro only at the tenth perfect solve', async ({ page }) => {
  await installClock(page); await page.goto('/'); await play(page);
  for (let i = 1; i <= 10; i++) {
    await solve(page);
    await expect(page.locator('#nitro-value')).toHaveText(`${40 + 5 * i + (i >= 5 ? 4 : 0) + (i === 10 ? 6 : 0)}%`);
    if (i < 10) await page.clock.runFor(1000);
  }
});
