import { test, expect } from '@playwright/test';
import { createProgress, PROGRESS_KEY } from '../../src/progression.js';
import { selectChoice, installClock, play, solve } from './helpers.js';
const now = new Date(2026, 9, 19, 12);
async function setup(page, mutate = () => {}) {
  await installClock(page);
  const p = createProgress(now); mutate(p);
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: PROGRESS_KEY, state: p });
  await page.goto('/');
}
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROGRESS_KEY);

test('claim daily gears, exchange for coins, buy and equip a cosmetic, and retain everything on reload', async ({ page }) => {
  await setup(page, p => { p.points = 600; p.daily.best = 1600; });
  await page.locator('#open-daily').click();
  const claim = page.locator('[data-goal="score"] button');
  await claim.click(); await expect(claim).toBeDisabled();
  await expect(page.locator('#wallet-points strong')).toHaveText('1.200');
  expect(await page.locator('.reward-particle').count()).toBeGreaterThan(0);
  await page.locator('#open-store').click();
  await page.locator('[data-action="section"][data-id="exchange"]').click();
  await page.locator('[data-action="exchange"][data-id="large"]').click();
  await expect(page.locator('#wallet-coins strong')).toHaveText('90');
  await page.locator('[data-action="section"][data-id="buy"]').click();
  await page.locator('[data-item="dots"] [data-action="buy"]').click();
  await page.locator('[data-item="dots"] [data-action="equip"]').click();
  expect((await state(page)).coins).toBe(30);
  await page.reload();
  expect((await state(page)).cosmetic).toBe('dots');
  expect((await state(page)).daily.claimed).toContain('score');
  await play(page); await expect(page.locator('body')).toHaveAttribute('data-skin', 'dots');
  await expect(page.locator('.tick').first()).toHaveAttribute('y2', '35');
});

test('a challenging record unlocks a boost for free and Nitro really moves twice as fast', async ({ page }) => {
  await setup(page, p => { p.best = 9000; });
  await page.locator('#open-store').click();
  await page.getByRole('button', { name: 'Boosts', exact: true }).click();
  await page.clock.runFor(450);
  await page.locator('[data-item="speed"] [data-action="unlock"]').click();
  await page.locator('[data-item="speed"] [data-action="equip"]').click();
  expect((await state(page)).coins).toBe(0);
  await page.locator('#open-play').click();
  await expect(page.locator('#store')).not.toBeVisible();
  await play(page); await expect(page.locator('body')).toHaveAttribute('data-boost', 'speed');
  await page.mouse.move(30, page.viewportSize().height / 2); await page.mouse.down();
  await page.clock.runFor(450);
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 0\./);
  await page.mouse.up(); await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
});

test('easy preserves existing play; medium/hard shorten the timer and persist separately', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#difficulty-current')).toHaveText('Fácil');
  await selectChoice(page, 'difficulty', 'hard');
  await page.reload();
  await expect(page.locator('#difficulty-current')).toHaveText('Difícil');
  await play(page);
  await expect(page.locator('#time')).toHaveText('9.8');
  await solve(page);
  const p = await state(page);
  expect(p.daily.clocks).toBe(1); expect(p.daily.perfect).toBe(1); expect(p.best).toBeGreaterThan(0);
  await expect(page.locator('#nitro-value')).toHaveText('43%');
});

test('double tank changes the actual meter capacity; rapid navigation remains safe', async ({ page }) => {
  await setup(page, p => { p.owned.push('tank'); p.boost = 'tank'; });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('#open-store').click();
  await page.getByRole('button', { name: 'Boosts', exact: true }).click();
  await page.locator('#open-daily').click();
  await page.clock.runFor(600);
  await expect(page.locator('.goal')).toHaveCount(3);
  await page.locator('#open-play').click();
  await expect(page.locator('#store')).not.toBeVisible();
  await play(page);
  await expect(page.locator('#nitro-meter')).toHaveAttribute('aria-valuemax', '200');
  await expect(page.locator('#nitro-value')).toHaveText('40/200');
  expect(errors).toEqual([]);
});
