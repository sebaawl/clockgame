import { test, expect } from '@playwright/test';
import { installClock } from './helpers.js';

// Native Android permits startup audio. This flag lets Chromium verify the
// same scheduled audio path; ordinary-browser gesture fallback is tested too.
test.use({ launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] } });

test('clock completes twelve stepped landings, geometrically becomes real Poppins and reveals the native wordmark', async ({ page }) => {
  await installClock(page, { feedback: true });
  await page.addInitScript(() => {
    window.__introTicks = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
      if (Math.abs((duration || 0) - .03375) < .000001) window.__introTicks.push(when);
      return start.call(this, when, offset, duration);
    };
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__introTicks.length)).toBe(12);
  const ticks = await page.evaluate(() => window.__introTicks);
  for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBeCloseTo(.125, 6);
  const geometry = await page.evaluate(() => {
    const minute = document.querySelector('#intro-minute').getAnimations()[0];
    const hour = document.querySelector('#intro-hour').getAnimations()[0];
    const ring = document.querySelector('#intro-ring').getAnimations()[0];
    const word = document.querySelector('#intro-word').getAnimations()[0];
    return { minute: { duration: minute.effect.getTiming().duration, frames: minute.effect.getKeyframes() }, hour: hour.effect.getKeyframes().at(-1).transform,
      ring: { delay: ring.effect.getTiming().delay, duration: ring.effect.getTiming().duration, frames: ring.effect.getKeyframes() }, word: word.effect.getTiming(),
      text: document.querySelector('#start-title').textContent, font: getComputedStyle(document.querySelector('#start-title')).fontFamily };
  });
  expect(geometry.minute.duration).toBe(1500);
  expect(geometry.minute.frames.at(-1).transform).toBe('rotate(-360deg)');
  expect(geometry.hour).toBe('rotate(-30deg)');
  expect(geometry.ring.delay).toBe(1500); expect(geometry.ring.duration).toBe(600);
  expect(geometry.ring.frames[0].d).not.toBe(geometry.ring.frames.at(-1).d);
  expect(geometry.word.delay).toBe(2100); expect(geometry.word.duration).toBe(600);
  expect(geometry.text).toBe('clocking'); expect(geometry.font).toContain('Poppins');
  await expect(page.locator('body')).not.toHaveClass(/intro-active/, { timeout: 7000 });
  await expect(page.locator('#start-title')).toBeVisible();
  await expect(page.locator('#start-title svg')).toHaveCount(0);
  await expect(page.locator('#startup-intro')).toHaveCount(0);
  await expect(page.locator('#app')).toHaveJSProperty('inert', false);
});

test('skipping stops pending clicks and orientation changes finish without starting another intro', async ({ page }) => {
  await installClock(page, { feedback: true });
  await page.addInitScript(() => {
    window.__introStops = 0; window.__introScheduled = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { if (Math.abs((args[2] || 0) - .03375) < .000001) window.__introScheduled++; return start.apply(this, args); };
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (...args) { window.__introStops++; return stop.apply(this, args); };
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__introScheduled)).toBe(12);
  await page.getByRole('button', { name: 'Saltar introducción' }).click();
  await expect(page.locator('#startup-intro')).toHaveCount(0);
  await expect(page.locator('#app')).toHaveJSProperty('inert', false);
  expect(await page.evaluate(() => window.__introStops)).toBeGreaterThan(0);
  await expect(page.locator('#start-title')).toHaveText('clocking');
  await page.setViewportSize({ width: 740, height: 360 });
  await expect(page.locator('#startup-intro')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#startup-intro')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#startup-intro')).toHaveCount(0);
  await expect(page.locator('#start-title')).toBeVisible();
});
