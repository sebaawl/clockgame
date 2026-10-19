import { test, expect } from '@playwright/test';
import { installClock, play } from './helpers.js';
import { createProgress, PROGRESS_KEY } from '../../src/progression.js';

const sounds = ['paper', 'latch', 'velvet', 'pocket'];
test('loss brakes the theme with falling pitch, stops it, and restores normal playback on retry', async ({ page }) => {
  await installClock(page, { feedback: true }); await page.goto('/'); await play(page);
  const music = page.locator('audio[data-music="game"]');
  await expect(music).toHaveJSProperty('paused', false);
  await page.clock.runFor(12100);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'lost');
  await expect(music).toHaveJSProperty('preservesPitch', false);
  const firstRate = await music.evaluate(a => a.playbackRate);
  await page.clock.runFor(350);
  expect(await music.evaluate(a => a.playbackRate)).toBeLessThan(firstRate);
  await page.clock.runFor(600);
  await expect(music).toHaveJSProperty('paused', true);
  await expect(music).toHaveJSProperty('playbackRate', 1);
  await expect(music).toHaveJSProperty('preservesPitch', true);
  await page.locator('#restart-game').click();
  await expect(music).toHaveJSProperty('paused', false);
  await expect(music).toHaveJSProperty('playbackRate', 1);
  await page.clock.runFor(3000); await page.locator('#tap-right').click(); await page.clock.runFor(560);
  await page.clock.runFor(12100);
  await page.locator('#change-mode').click();
  await page.clock.runFor(1000);
  await expect(page.locator('audio[data-music="menu"]')).toHaveJSProperty('paused', false);
  await expect(music).toHaveJSProperty('paused', true);
  await expect(music).toHaveJSProperty('playbackRate', 1);
});

test('new sounds preview while locked, purchase, equip and persist into in-game extras', async ({ page }) => {
  await installClock(page, { feedback: true });
  const progress = createProgress(); progress.coins = 1000;
  await page.addInitScript(({ key, progress }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(progress)); }, { key: PROGRESS_KEY, progress });
  await page.goto('/'); await page.locator('#open-store').click();
  for (const preset of sounds) {
    const item = page.locator(`[data-item="sound-${preset}"]`);
    const before = await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY);
    const ticks = await page.evaluate(() => window.__ticks);
    await item.locator('[data-action="preview"]').click();
    expect(await page.evaluate(() => window.__ticks)).toBeGreaterThan(ticks);
    expect(await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY)).toBe(before);
    await item.locator('[data-action="buy"]').click();
    await item.locator('[data-action="equip"]').click();
    await expect(item.locator('[data-action="equip"]')).toHaveText('Equipado ✓');
  }
  await page.reload(); await play(page); await page.locator('#settings-button').click(); await page.locator('#tab-extras').click();
  await expect(page.locator('[data-sound="pocket"]')).toHaveAttribute('aria-pressed', 'true');
  for (const preset of sounds) {
    const before = await page.evaluate(() => window.__ticks);
    await page.locator(`[data-sound="${preset}"]`).click();
    expect(await page.evaluate(() => window.__ticks)).toBeGreaterThan(before);
    await expect(page.locator(`[data-sound="${preset}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
});
