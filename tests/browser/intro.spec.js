import { test, expect } from '@playwright/test';
import { installClock, play } from './helpers.js';

test('opening clock turns into the logo, lands on the heading, and reveals a usable menu', async ({ page }) => {
  await installClock(page);
  await page.goto('/');
  await expect(page.locator('#startup-intro')).toBeVisible();
  await expect(page.locator('#start-title')).not.toBeVisible();
  await expect(page.locator('#app')).toHaveJSProperty('inert', true);
  await expect(page.locator('#startup-intro')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('#startup-intro')).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator('#start-title')).toBeVisible();
  const landing = await page.evaluate(() => window.__motions.find(m => m.options.duration === 600 && m.options.delay === 2100));
  expect(landing).toBeTruthy();
  await play(page);
  await expect(page.locator('#startup-intro')).toHaveCount(0);
});

test('intro can be skipped and honors light theme and reduced motion', async ({ page }) => {
  await installClock(page);
  await page.addInitScript(() => localStorage.setItem('clocking:preferences', JSON.stringify({ sound: false, theme: 'light' })));
  await page.goto('/');
  await expect(page.locator('#startup-intro')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Saltar introducción' }).click();
  await expect(page.locator('#startup-intro')).toHaveCount(0);
  await expect(page.locator('#start-title')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('#startup-intro')).toHaveCount(0);
  await expect(page.locator('#start-title')).toBeVisible();
});

test('loss plays a single low sine drop, and disabling sound silences the next loss', async ({ page }) => {
  await installClock(page, { feedback: true });
  await page.addInitScript(() => {
    window.__lossDrops = [];
    const Audio = window.AudioContext || window.webkitAudioContext;
    const create = Audio.prototype.createOscillator;
    Audio.prototype.createOscillator = function () {
      const voice = create.call(this);
      let frequency;
      const set = voice.frequency.setValueAtTime.bind(voice.frequency);
      voice.frequency.setValueAtTime = (value, ...args) => { frequency = value; return set(value, ...args); };
      const start = voice.start.bind(voice);
      voice.start = (...args) => { window.__lossDrops.push({ type: voice.type, start: frequency }); return start(...args); };
      return voice;
    };
    const ramp = AudioParam.prototype.exponentialRampToValueAtTime;
    AudioParam.prototype.exponentialRampToValueAtTime = function (value, time) {
      if (value > 1 && value < 200) window.__dropTarget = value;
      return ramp.call(this, value, time);
    };
  });
  await page.goto('/'); await play(page); await page.clock.runFor(12100);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'lost');
  expect(await page.evaluate(() => window.__lossDrops)).toEqual([{ type: 'sine', start: 190 }]);
  expect(await page.evaluate(() => window.__dropTarget)).toBe(42);
  await page.locator('#change-mode').click();
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Sonido', exact: true }).uncheck();
  await page.locator('#continue-game').click(); await page.clock.runFor(300);
  await play(page); await page.clock.runFor(12100);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'lost');
  expect(await page.evaluate(() => window.__lossDrops.length)).toBe(1);
});
