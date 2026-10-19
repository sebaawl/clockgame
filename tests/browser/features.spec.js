import { test, expect } from '@playwright/test';
import { installClock, play, solve } from './helpers.js';

test.beforeEach(async ({ page }) => { await installClock(page, { feedback: true }); await page.goto('/'); });

test('dedicated gear replaces the adjustment count; touching the dial turns the hand instead of opening settings', async ({ page }) => {
  await play(page);
  expect(await page.locator('#resolutions, .resolution-counter').count()).toBe(0);
  const timer = await page.locator('#timer').boundingBox();
  const gear = await page.locator('#settings-button').boundingBox();
  expect(gear.x).toBeGreaterThan(timer.x + timer.width);
  const dial = await page.locator('#clock-wrap').boundingBox();
  await page.mouse.click(dial.x + dial.width * 0.25, dial.y + dial.height / 2);
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 4\./);
  await expect(page.locator('#settings')).not.toBeVisible();
  await page.getByRole('button', { name: 'Abrir ajustes', exact: true }).click();
  await expect(page.locator('#settings')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
});

test('settings slide up and down and the game stays paused until the exit completes', async ({ page }) => {
  await play(page);
  await page.clock.runFor(2000);
  await page.locator('#settings-button').click();
  const opening = await page.evaluate(() => {
    const motion = window.__motions.findLast(m => m.id === 'settings' && m.frames[0].transform?.includes('100%'));
    return { duration: motion.options.duration, frames: motion.frames.map(f => f.transform) };
  });
  expect(opening.duration).toBe(280);
  expect(opening.frames[0]).toContain('100%');
  const frozen = await page.locator('#time').textContent();
  await page.clock.runFor(4000);
  await expect(page.locator('#time')).toHaveText(frozen);
  await page.getByRole('button', { name: 'Volver al juego', exact: true }).click();
  await expect(page.locator('#settings')).toHaveAttribute('data-closing', 'true');
  await page.clock.runFor(239);
  await expect(page.locator('#settings')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  await page.clock.runFor(1);
  await expect(page.locator('#settings')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#time')).toHaveText(frozen);
});

test('clock tap plays one sound; sound and haptics can be disabled independently', async ({ page }) => {
  await play(page);
  const beforeTap = await page.evaluate(() => window.__ticks);
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => window.__ticks)).toBe(beforeTap + 1);

  expect(await page.evaluate(() => window.__pulses)).toEqual([8]);
  await page.locator('#settings-button').click();
  expect(await page.evaluate(() => window.__pulses)).toEqual([8, [24, 30, 58]]);
  await page.getByRole('switch', { name: /^Sonido$/ }).uncheck();
  const beforeMute = await page.evaluate(() => window.__ticks);
  await page.getByRole('switch', { name: /Vibración/ }).uncheck();
  await page.getByRole('button', { name: 'Volver al juego' }).click();
  await page.clock.runFor(240);
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => window.__ticks)).toBe(beforeMute);
  expect(await page.evaluate(() => window.__pulses)).toEqual([8, [24, 30, 58]]);
});

test('light mode has a black solid success circle, retains preferences, and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: /Modo claro/ }).check();
  await page.getByRole('switch', { name: /^Sonido$/ }).uncheck();
  await page.getByRole('button', { name: 'Volver al juego' }).click();
  await expect(page.locator('#settings')).not.toBeVisible();
  await play(page);
  await solve(page);
  expect(await page.locator('#success-glow').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(0, 0, 0)');
  const frames = await page.locator('#success-glow').evaluate(el => el.getAnimations()[0].effect.getKeyframes());
  expect(new Set(frames.map(f => f.transform)).size).toBe(1);
  expect(Math.max(...frames.map(f => Number(f.opacity)))).toBeLessThanOrEqual(0.12);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#settings-button').click();
  await expect(page.getByRole('switch', { name: /Modo claro/ })).toBeChecked();
  await expect(page.getByRole('switch', { name: /^Sonido$/ })).not.toBeChecked();
});

test('timeout immediately presents the exact score and retry button on a red panel sliding up, never floating loss text', async ({ page }) => {
  await play(page);
  await solve(page);
  await expect(page.locator('#score')).toHaveText('22');
  await page.clock.runFor(1000);
  await page.clock.runFor(14200);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'lost');
  await expect(page.locator('#result-panel')).toBeVisible();
  await expect(page.locator('#final-score')).toHaveText('22');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  expect(await page.locator('#loss-message, #loss-intro').count()).toBe(0);
  await expect(page.locator('#game-over')).toHaveCSS('background-color', 'rgb(223, 38, 59)');
  await expect(page.locator('#game-over')).toHaveCSS('animation-name', 'game-over-rise');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'break');
  await expect(page.locator('#break-detail')).toHaveText('FASE 1');
  await expect(page.locator('#score')).toHaveText('0');
  await page.clock.runFor(3000);
  await expect(page.locator('#time')).toHaveText('15.0');
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(560);
  await page.clock.runFor(15050);
  await page.getByRole('button', { name: 'Cambiar modo', exact: true }).click();
  await expect(page.locator('#start-menu')).toBeVisible();
});

test('restart in settings clears score and returns to the first intro in the same mode', async ({ page }) => {
  await play(page, 'hard');
  await solve(page);
  await page.clock.runFor(1000);
  await page.locator('#settings-button').click();
  await page.getByRole('button', { name: 'Reiniciar partida', exact: true }).click();
  await page.clock.runFor(240);
  await expect(page.locator('#settings')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'break');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'hard');
  await expect(page.locator('#break-title')).toHaveText('HORA');
  await expect(page.locator('#break-detail')).toHaveText('FASE 1');
  await expect(page.locator('#score')).toHaveText('0');
  await page.clock.runFor(3000);
  await expect(page.locator('#time')).toHaveText('12.0');
});

test('settings have titles only and can return to the game menu', async ({ page }) => {
  await play(page);
  await solve(page);
  await page.clock.runFor(1000);
  await page.locator('#settings-button').click();
  expect(await page.locator('#settings .setting-row small, #settings details').count()).toBe(0);
  await page.getByRole('button', { name: 'Volver al menú', exact: true }).click();
  await page.clock.runFor(240);
  await expect(page.locator('#settings')).not.toBeVisible();
  await expect(page.locator('#start-menu')).toBeVisible();
  await page.clock.runFor(20000);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'menu');
});
