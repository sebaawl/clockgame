import { test, expect } from '@playwright/test';
import { installClock, play, solve } from './helpers.js';

test.beforeEach(async ({ page }) => { await installClock(page); await page.goto('/'); });

test('five consecutive solves show a large combo with a sky blue flash', async ({ page }) => {
  await play(page);
  for (let i = 0; i < 5; i++) {
    await solve(page);
    if (i < 4) await page.clock.runFor(1000);
  }
  await expect(page.locator('#combo-big')).toHaveText('5×');
  await expect(page.locator('#combo-celebration')).toBeVisible();
  expect(parseFloat(await page.locator('#combo-big').evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThan(90);
  await expect(page.locator('#success-glow')).toHaveCSS('background-color', 'rgb(84, 216, 255)');
  await expect(page.locator('#success-glow')).toHaveCSS('z-index', '4');
  await expect(page.locator('#resources')).toHaveCSS('mix-blend-mode', 'normal');
  await expect(page.locator('#resources')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-phase', '6');
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Destello de acierto', exact: true }).uncheck();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  for (let i = 0; i < 5; i++) { await solve(page); if (i < 4) await page.clock.runFor(1000); }
  await expect(page.locator('#combo-big')).toHaveText('10×');
  await expect(page.locator('#success-glow')).toHaveAttribute('data-combo', 'false');
  await expect(page.locator('#resources')).toHaveCSS('mix-blend-mode', 'difference');
  expect(await page.locator('#success-glow').evaluate(el => el.getAnimations().length)).toBe(0);
});

test('backdrops change with active time and stay frozen while paused', async ({ page }) => {
  await play(page);
  await expect(page.locator('body')).toHaveAttribute('data-backdrop', '0');
  await page.clock.runFor(10020);
  const color = await page.locator('body').getAttribute('data-backdrop');
  expect(color).not.toBe('0');
  await page.keyboard.press('Space');
  await page.clock.runFor(30000);
  await expect(page.locator('body')).toHaveAttribute('data-backdrop', color);
  await page.keyboard.press('Space');
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-backdrop', color);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});

test('game over fills the viewport with red and slides up with readable controls in light mode', async ({ page }) => {
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Modo claro', exact: true }).check();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await play(page);
  await page.clock.runFor(15100);
  await expect(page.locator('#game-over')).toHaveCSS('background-color', 'rgb(223, 38, 59)');
  await expect(page.locator('#game-over')).toHaveCSS('animation-name', 'game-over-rise');
  await expect(page.locator('#restart-game')).toHaveCSS('color', 'rgb(255, 255, 255)');
  const size = await page.locator('#game-over').evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight }));
  expect(size).toEqual(page.viewportSize());
});
