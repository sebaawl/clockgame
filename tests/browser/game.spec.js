import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.4; });
  const instant = new Date('2026-10-19T12:00:00Z');
  await page.clock.install({ time: instant });
  await page.clock.pauseAt(instant);
  await page.goto('/');
});

async function solve(page) {
  const label = await page.locator('#clock').getAttribute('aria-label');
  const position = Number(label.match(/(?:hora|minuto|segundo) (\d+)/)[1]);
  const count = label.includes('hora ') ? 12 : 60;
  const key = position <= count / 2 ? 'ArrowLeft' : 'ArrowRight';
  for (let i = 0; i < Math.min(position, count - position); i++) await page.keyboard.press(key);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
}

test('only a white clock and counter on black, with no scrolling', async ({ page }) => {
  await expect(page.locator('#time')).toHaveText('10.0');
  await expect(page.locator('#clock')).toBeVisible();
  expect(await page.locator('header, footer, nav, dialog, svg text, a').count()).toBe(0);
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(0, 0, 0)');
  expect(await page.locator('.clock-face').evaluate(el => getComputedStyle(el).stroke)).toBe('rgb(255, 255, 255)');
  expect(await page.locator('#timer').evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  expect(await page.evaluate(() => ({ width: document.body.scrollWidth, height: document.body.scrollHeight }))).toEqual(page.viewportSize());
  await page.clock.runFor(3000);
  await expect(page.locator('#time')).toHaveText('10.0');
});

test('first touch starts and moves the clock exactly once in either direction', async ({ page, isMobile }) => {
  const zone = page.locator('#tap-left');
  if (isMobile) await zone.tap();
  else await zone.click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 10\./);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 11\./);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
});

test('success glow is behind the clock, covers the viewport and lasts exactly one second', async ({ page }) => {
  await solve(page);
  const geometry = await page.locator('#success-glow').evaluate(el => {
    const animation = el.getAnimations()[0];
    return {
      duration: animation.effect.getTiming().duration,
      width: parseFloat(el.style.width),
      x: parseFloat(el.style.left), y: parseFloat(el.style.top),
      layer: Number(getComputedStyle(el).zIndex),
    };
  });
  const clock = await page.locator('#clock-wrap').boundingBox();
  expect(geometry.duration).toBe(1000);
  expect(geometry.width).toBeGreaterThan(Math.hypot(page.viewportSize().width, page.viewportSize().height));
  expect(geometry.x).toBeCloseTo(clock.x + clock.width / 2, 0);
  expect(geometry.y).toBeCloseTo(clock.y + clock.height / 2, 0);
  expect(geometry.layer).toBeLessThan(await page.locator('#clock-wrap').evaluate(el => Number(getComputedStyle(el).zIndex)));
  await page.clock.runFor(999);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  // Inputs cannot skip the glow or change the next clock early.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await page.clock.runFor(1);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#time')).toHaveText('15.0');
  expect(await page.locator('#success-glow').evaluate(el => el.getAnimations().length)).toBe(0);
});

test('timer and keyboard pause without consuming time; expiry can be retried by tapping', async ({ page }) => {
  await page.locator('#timer').click();
  await page.clock.runFor(2000);
  await page.locator('#timer').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  const before = await page.locator('#time').textContent();
  await page.clock.runFor(3000);
  await expect(page.locator('#time')).toHaveText(before);
  await page.keyboard.press('Space');
  await page.clock.runFor(8100);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'lost');
  await expect(page.locator('#time')).toHaveText('0.0');
  await page.locator('#tap-left').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#time')).toHaveText('10.0');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 10\./);
});

test('thirty solves still change hours to minutes and reset the limit to fifteen', async ({ page }) => {
  await solve(page);
  await page.clock.runFor(1000);
  for (let phase = 1; phase <= 30; phase++) {
    await expect(page.locator('body')).toHaveAttribute('data-phase', String(phase));
    if (phase === 30) expect(Number(await page.locator('#time').textContent())).toBeLessThanOrEqual(7);
    await solve(page);
    await page.clock.runFor(1000);
  }
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'minutos');
  await expect(page.locator('body')).toHaveAttribute('data-phase', '1');
  await expect(page.locator('#time')).toHaveText('15.0');
});

test('reduced motion uses a gentle one-second fade instead of an expanding flash', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await solve(page);
  const frames = await page.locator('#success-glow').evaluate(el => el.getAnimations()[0].effect.getKeyframes());
  expect(new Set(frames.map(frame => frame.transform)).size).toBe(1);
  expect(Math.max(...frames.map(frame => Number(frame.opacity)))).toBeLessThanOrEqual(0.12);
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});

test('switching away pauses both active play and an unfinished success transition', async ({ page, context }) => {
  await page.locator('#timer').click();
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  // Chromium headless may keep pages visible; dispatch the real handler deterministically.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  await other.close();
  await page.bringToFront();
  await page.locator('#timer').click();
  await solve(page);
  await page.clock.runFor(400);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  await page.clock.runFor(2000);
  await page.locator('#timer').click();
  await page.clock.runFor(599);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await page.clock.runFor(1);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});
