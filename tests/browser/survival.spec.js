import { test, expect } from '@playwright/test';
import { installClock, play, solve, selectChoice } from './helpers.js';

async function begin(page) {
  await installClock(page); await page.goto('/');
  await selectChoice(page, 'format', 'survival'); await play(page);
}
async function next(page) { await solve(page); await page.clock.runFor(1000); }

test('exact-turn counter allows crossing twelve, counts all moves and disappears on ordinary clocks', async ({ page }) => {
  await begin(page); await next(page); await next(page);
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'exact');
  await expect(page.locator('#challenge-panel')).toBeVisible();
  await expect(page.locator('#challenge-title')).toHaveText('VUELTA EXACTA');
  const target = Number(await page.locator('body').getAttribute('data-target-clicks'));
  expect(target).toBeGreaterThan(12);
  await expect(page.locator('#challenge-counter')).toHaveText(`0 / ${target}`);
  await page.evaluate(() => {
    const label = document.querySelector('#clock').getAttribute('aria-label');
    const position = Number(label.match(/hora (\d+)/)[1]);
    const dir = Number(document.body.dataset.challengeDirection);
    const steps = dir === 1 ? 12 - position : position;
    for (let i = 0; i < steps; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: dir === 1 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
  });
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 0\./);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await solve(page);
  await expect(page.locator('#challenge-counter')).toHaveText(`${target} / ${target}`);
  await page.clock.runFor(1000);
  await expect(page.locator('#challenge-panel')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'normal');
});

test('duel moves by itself, freezes in settings, resumes and later changes direction', async ({ page }) => {
  await begin(page);
  for (let i = 0; i < 5; i++) await next(page);
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'duel');
  const before = await page.locator('#clock').getAttribute('aria-label');
  await page.clock.runFor(950);
  await expect(page.locator('#clock')).not.toHaveAttribute('aria-label', before);
  await page.locator('#settings-button').click();
  const paused = await page.locator('#clock').getAttribute('aria-label');
  await page.clock.runFor(3000);
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', paused);
  await page.locator('#continue-game').click(); await page.clock.runFor(1200);
  await expect(page.locator('#clock')).not.toHaveAttribute('aria-label', paused);
  for (let i = 5; i < 8; i++) await next(page);
  await expect(page.locator('body')).toHaveAttribute('data-challenge', 'chaos');
  await expect(page.locator('#challenge-title')).toHaveText('RELOJ IMPREDECIBLE');
  const arrow = await page.locator('#challenge-counter').textContent();
  await page.clock.runFor(1400);
  await expect(page.locator('#challenge-counter')).not.toHaveText(arrow);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});

test('small phones keep the clock, Nitro and temporary counter apart', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await begin(page); await next(page); await next(page); await page.clock.runFor(400);
  const bounds = await page.evaluate(() => {
    const read = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
    return { clock: read('clock-wrap'), resources: read('resources'), challenge: read('challenge-panel') };
  });
  expect(bounds.clock.bottom).toBeLessThan(bounds.resources.top);
  expect(bounds.resources.bottom).toBeLessThanOrEqual(bounds.challenge.top);
  expect(bounds.challenge.left).toBeGreaterThanOrEqual(0);
  expect(bounds.challenge.right).toBeLessThanOrEqual(320);
  expect(bounds.challenge.bottom).toBeLessThanOrEqual(568);
});
