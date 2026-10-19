import { test, expect } from '@playwright/test';
import { installClock } from './helpers.js';

test('guide waits without spending time; first tap launches without changing the target or scoring', async ({ page }) => {
  await installClock(page);
  await page.goto('/');
  await page.locator('#start-game').click();
  await expect(page.locator('#break-detail')).toHaveText('FASE 1');
  await page.clock.runFor(3000);
  await expect(page.locator('#control-guide')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.clock.runFor(20000);
  await expect(page.locator('#time')).toHaveText('12.0');
  const target = await page.locator('#clock').getAttribute('aria-label');
  await page.locator('#tap-left').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'launching');
  const frames = await page.locator('#clock').evaluate(el => el.getAnimations().flatMap(a => a.effect.getKeyframes()));
  expect(frames.some(f => f.transform?.includes('-360deg'))).toBe(true);
  await page.clock.runFor(559);
  await expect(page.locator('#time')).toHaveText('12.0');
  await page.clock.runFor(1);
  await expect(page.locator('#control-guide')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', target);
  await expect(page.locator('#score')).toHaveText('0');
  expect(await page.locator('#success-glow').evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  await page.clock.runFor(1020);
  await expect(page.locator('#time')).toHaveText('11.0');
  await page.locator('#tap-left').click();
  await expect(page.locator('#clock')).not.toHaveAttribute('aria-label', target);
});

test('reduced motion starts with a short fade instead of the spinning jump', async ({ page }) => {
  await installClock(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#start-game').click();
  await page.clock.runFor(3000);
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(160);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#time')).toHaveText('12.0');
});
