import { test, expect } from '@playwright/test';
import { installClock, play, solve, selectChoice } from './helpers.js';

async function challenge(page, light = false, random = .4) {
  await installClock(page);
  await page.addInitScript(({ light, random }) => {
    Math.random = () => random;
    localStorage.setItem('clocking:progress:v1', JSON.stringify({ version: 1, owned: ['original', 'sound-felt', 'compass'], boosts: ['compass'] }));
    if (light) localStorage.setItem('clocking:preferences', JSON.stringify({ sound: false, vibration: false, theme: 'light' }));
  }, { light, random });
  await page.goto('/'); await selectChoice(page, 'format', 'survival'); await play(page);
  for (let i = 0; i < 2; i++) { await solve(page); await page.clock.runFor(1000); }
}

test('large count sits above the right arc on small phones without hitting score, timer or settings', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await challenge(page);
  const box = await page.evaluate(() => {
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
    return { dock: r('challenge-dock'), clock: r('clock-wrap'), score: r('score-panel'), hud: r('hud') };
  });
  expect(box.dock.top).toBeLessThan(box.clock.top);
  expect(box.dock.left).toBeGreaterThan(box.score.right);
  expect(box.dock.top).toBeGreaterThan(box.hud.bottom);
  expect(box.dock.right).toBeLessThanOrEqual(320);
  expect(parseFloat(await page.locator('.count-current').evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(52);
  await expect(page.locator('#challenge-counter-label')).toHaveText('CLICS');
  await expect(page.locator('#compass-ghost')).not.toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  const landscape = await page.evaluate(() => {
    const dock = document.querySelector('#challenge-dock').getBoundingClientRect(), score = document.querySelector('#score-panel').getBoundingClientRect();
    return { left: dock.left, right: dock.right, scoreRight: score.right };
  });
  expect(landscape.left).toBeGreaterThan(landscape.scoreRight);
  expect(landscape.right).toBeLessThan(844);
});

test('ghost guides clockwise too, pauses with settings and honors reduced motion and light theme', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await challenge(page, true, .8);
  await page.evaluate(() => {
    const preferred = Number(document.body.dataset.challengeDirection);
    for (let i = 0; i < 36 && document.querySelector('#challenge-panel').dataset.guide === 'free'; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: preferred === 1 ? 'ArrowLeft' : 'ArrowRight', bubbles: true }));
  });
  await expect(page.locator('#compass-ghost')).toBeVisible();
  await expect(page.locator('#compass-ghost')).toHaveAttribute('data-direction', '1');
  await expect(page.locator('#compass-ghost .spectral-0')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#settings-button').click(); await page.locator('#tab-extras').click();
  await page.locator('[data-extra="compass"]').click();
  // Selecting an equipped boost removes it; equipping it again restores the spectral preview.
  await page.locator('[data-extra="compass"]').click();
  await expect(page.locator('.preview-compass-ghost')).toBeVisible();
  await expect(page.locator('#compass-ghost .spectral-0')).toHaveCSS('animation-name', 'none');
});
