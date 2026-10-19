import { test, expect } from '@playwright/test';

test('real button and transition recordings decode, advance, and mute in Chrome', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('clocking:preferences', JSON.stringify({ sound: true }));
    window.__media = [];
    const Audio = window.Audio;
    window.Audio = function (...args) { const audio = new Audio(...args); window.__media.push(audio); return audio; };
  });
  await page.goto('/');
  await page.locator('#settings-button').click();
  await expect.poll(() => page.evaluate(() => window.__media.length)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__media.every(a => a.readyState >= 2 && a.currentTime > 0 && !a.error))).toBe(true);
  const samples = await page.evaluate(async () => {
    const context = new AudioContext();
    const outputs = [];
    for (const media of window.__media) {
      const response = await fetch(media.src);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      outputs.push(Math.max(...buffer.getChannelData(0).map(Math.abs)));
    }
    await context.close();
    return outputs;
  });
  expect(samples.every(peak => peak > .1)).toBe(true);
  await page.getByRole('switch', { name: /^Sonido$/ }).uncheck();
  expect(await page.evaluate(() => window.__media.every(a => a.paused))).toBe(true);
});
