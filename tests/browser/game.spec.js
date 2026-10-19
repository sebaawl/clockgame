import { test, expect } from '@playwright/test';
import { installClock, play, solve } from './helpers.js';

test.beforeEach(async ({ page }) => { await installClock(page); await page.goto('/'); });

test('mode menu comes first, then phase one and hour for exactly three seconds with no tutorial move', async ({ page }) => {
  await expect(page.locator('#start-menu')).toBeVisible();
  await expect(page.locator('#clock-wrap')).not.toBeVisible();
  await expect(page.locator('#score-panel')).not.toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'menu');
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(page.locator('#break-title')).toHaveText('HORA');
  await expect(page.locator('#break-detail')).toHaveText('FASE 1');
  await expect(page.locator('#clock-wrap')).not.toBeVisible();
  await page.clock.runFor(2999);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'break');
  await page.clock.runFor(1);
  await expect(page.locator('#time')).toHaveText('15.0');
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('body')).toHaveAttribute('data-phase', '1');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 5\./);
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(560);
  await solve(page);
  await expect(page.locator('#score')).toHaveText('22');
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-phase', '2');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});

test('normal mode turns both ways with a satisfying bump and no scroll', async ({ page, isMobile }) => {
  await play(page);
  const zone = page.locator('#tap-right');
  const bounds = await zone.boundingBox();
  const options = { position: { x: bounds.width - 12, y: 20 } };
  if (isMobile) await zone.tap(options); else await zone.click(options);
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 6\./);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 5\./);
  expect(await page.locator('#clock-wrap').evaluate(el => el.getAnimations()[0].effect.getKeyframes().some(frame => frame.transform.includes('1.018')))).toBe(true);
  expect(await page.evaluate(() => ({ width: document.body.scrollWidth, height: document.body.scrollHeight }))).toEqual(page.viewportSize());
});

test('hard mode rejects the intuitive shortcut and any last-tap bypass, then accepts a full long route', async ({ page }) => {
  await play(page, 'hard');
  await expect(page.locator('#time')).toHaveText('12.0');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'hard');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 0\./);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#score')).toHaveText('0');
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  expect(Number(await page.locator('#score').textContent())).toBeGreaterThan(0);
  expect(Number(await page.locator('#score').textContent())).toBeLessThan(33);
});

test('success remains a solid one-second circle and cannot be skipped', async ({ page }) => {
  await play(page);
  await solve(page);
  const effect = await page.locator('#success-glow').evaluate(el => ({
    duration: el.getAnimations()[0].effect.getTiming().duration,
    width: parseFloat(el.style.width), color: getComputedStyle(el).backgroundColor,
    image: getComputedStyle(el).backgroundImage,
  }));
  expect(effect.duration).toBe(1000);
  expect(effect.width).toBeGreaterThan(Math.hypot(page.viewportSize().width, page.viewportSize().height));
  expect(effect.color).toBe('rgb(255, 255, 255)');
  expect(effect.image).toBe('none');
  await page.clock.runFor(999);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await page.clock.runFor(1);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});

test('cycle changes and a full phase still pause, reset the timer and keep the background pure black', async ({ page }) => {
  test.setTimeout(100_000);
  await play(page);
  for (let i = 0; i < 30; i++) {
    await solve(page);
    await page.clock.runFor(1000);
    if (i === 9 || i === 19) {
      await expect(page.locator('body')).toHaveAttribute('data-state', 'break');
      await expect(page.locator('#break-title')).toHaveText(i === 9 ? 'MINUTO' : 'SEGUNDO');
      await page.clock.runFor(3000);
      await expect(page.locator('#time')).toHaveText('15.0');
    }
  }
  await expect(page.locator('body')).toHaveAttribute('data-round', '2');
  await expect(page.locator('#break-kicker')).toHaveText('NUEVA FASE');
  await expect(page.locator('#break-detail')).toHaveText('FASE 2');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim())).toBe('#000000');
  await page.clock.runFor(3000);
  await expect(page.locator('#time')).toHaveText('15.0');
});

test('backgrounding play and breaks preserves both timers', async ({ page }) => {
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.clock.runFor(1000);
  await page.keyboard.press('Escape');
  await page.clock.runFor(5000);
  await page.locator('#intermission').dispatchEvent('pointerdown', { button: 0 });
  await page.clock.runFor(1999);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'break');
  await page.clock.runFor(1);
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(560);
  await page.clock.runFor(2000);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const frozen = await page.locator('#time').textContent();
  await page.clock.runFor(5000);
  await expect(page.locator('#time')).toHaveText(frozen);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#timer').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});
