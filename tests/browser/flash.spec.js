import { test, expect } from '@playwright/test';
import { installClock, play, solve } from './helpers.js';

test('score inverts against the actual flash in either theme', async ({ page }) => {
  await installClock(page);
  await page.goto('/');
  await play(page);
  await solve(page);
  await expect(page.locator('#score')).toHaveText('44');
  await expect(page.locator('#success-glow')).toHaveCSS('mix-blend-mode', 'difference');
  await expect(page.locator('#score-panel')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('#success-glow')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.clock.runFor(1000);
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Modo claro', exact: true }).check();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await solve(page);
  await expect(page.locator('#success-glow')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('#success-glow')).toHaveCSS('mix-blend-mode', 'difference');
});

test('flash preference persists and disables both landing and success disks, without disabling play', async ({ page }) => {
  await installClock(page);
  await page.goto('/');
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Destello de acierto', exact: true }).uncheck();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await page.reload();
  await page.locator('#settings-button').click();
  await expect(page.getByRole('switch', { name: 'Destello de acierto', exact: true })).not.toBeChecked();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await play(page);
  expect(await page.locator('#success-glow').evaluate(el => el.getAnimations().length)).toBe(0);
  await solve(page);
  await expect(page.locator('#score')).toHaveText('44');
  expect(await page.locator('#success-glow').evaluate(el => el.getAnimations().length)).toBe(0);
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-phase', '2');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});
