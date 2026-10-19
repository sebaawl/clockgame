import { test, expect } from '@playwright/test';
import { installClock, play, selectChoice, solve } from './helpers.js';
async function begin(page, format) {
  await installClock(page); await page.goto('/');
  await selectChoice(page, 'format', format); await play(page);
}
async function pulse(page, error = 0, side = 'right') {
  const delay = await page.locator('#rhythm-ring').evaluate((el, error) => Number(el.dataset.next) - performance.now() + error, error);
  if (delay > 0) await page.clock.runFor(delay);
  await page.locator(`#tap-${side}`).dispatchEvent('pointerdown', { button: 0, pointerId: 7, isPrimary: true });
  await page.locator(`#tap-${side}`).dispatchEvent('pointerup', { button: 0, pointerId: 7, isPrimary: true });
}
test('standalone rhythm evaluates pointerdown, advances a full turn, awards precision points and carries on without a timer', async ({ page }) => {
  await begin(page, 'rhythm');
  await expect(page.locator('#time')).toHaveText('∞');
  await expect(page.locator('#resources')).not.toBeVisible();
  await expect(page.locator('#rhythm-ring')).toBeVisible();
  for (let i = 0; i < 4; i++) await pulse(page, 0, i % 2 ? 'left' : 'right');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('#score')).toHaveText('192');
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'rhythm');
  await pulse(page, 150);
  await expect(page.locator('#score')).toHaveText('204');
  await expect(page.locator('#challenge-hint')).toContainText('JUSTO');
  await page.clock.runFor(4000);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'lost');
  await expect(page.locator('#final-score')).toHaveText('204');
});
test('settings freeze the incoming ring and resume without missing beats', async ({ page }) => {
  await begin(page, 'rhythm'); await page.clock.runFor(400);
  await page.locator('#settings-button').click();
  const ring = await page.locator('#rhythm-ring').getAttribute('style');
  await page.clock.runFor(8000);
  await expect(page.locator('#rhythm-ring')).toHaveAttribute('style', ring);
  await page.locator('#continue-game').click(); await page.clock.runFor(300);
  await pulse(page);
  await expect(page.locator('#challenge-counter')).toHaveText('1 / 4');
  await expect(page.locator('#challenge-hint')).toContainText('3 vidas');
});
test('survival includes timed rings, freezes the single countdown and resumes its normal clocks afterwards', async ({ page }) => {
  await begin(page, 'survival');
  for (let i = 0; i < 10; i++) { await solve(page); await page.clock.runFor(1000); }
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'rhythm');
  const time = await page.locator('#time').textContent();
  await page.clock.runFor(600);
  await expect(page.locator('#time')).toHaveText(time);
  for (let i = 0; i < 4; i++) await pulse(page);
  expect(Number(await page.locator('#time').textContent())).toBeGreaterThanOrEqual(Number(time));
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'normal');
  const next = Number(await page.locator('#time').textContent());
  await page.clock.runFor(500);
  expect(Number(await page.locator('#time').textContent())).toBeLessThan(next);
});
test('1 vs 1 is selectable, has a moving hand and switches to the reversing variant on the next clock', async ({ page }) => {
  await begin(page, 'duel');
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'duel');
  const hand = await page.locator('#active-hand').getAttribute('style');
  await page.clock.runFor(950);
  await expect(page.locator('#active-hand')).not.toHaveAttribute('style', hand);
  await solve(page); await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'chaos');
});
