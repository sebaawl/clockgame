import { test, expect } from '@playwright/test';
import { installClock, play } from './helpers.js';

test('Android startup height changes do not cancel the intro; each launch replays, duplicates do not restart it', async ({ page }) => {
  await installClock(page); await page.goto('/');
  await expect(page.locator('#startup-intro')).toBeVisible();
  const before = await page.locator('#startup-intro').evaluate(el => { el.dataset.instance = 'first'; return el.dataset.instance; });
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width, height: viewport.height - 40 });
  await expect(page.locator('#startup-intro')).toHaveAttribute('data-instance', before);
  await page.evaluate(() => window.dispatchEvent(new Event('clocking:launch')));
  await expect(page.locator('#startup-intro')).toHaveAttribute('data-instance', before);
  await expect(page.locator('#startup-intro')).toHaveCount(0, { timeout: 7000 });
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event('clocking:launch')));
    await expect(page.locator('#intro-minute')).toBeVisible();
    await page.getByRole('button', { name: 'Saltar introducción' }).click();
  }
});

test('foreground launch preserves a paused run and restores interaction after the intro', async ({ page }) => {
  await installClock(page); await page.goto('/'); await play(page);
  const points = await page.locator('#score').textContent();
  await page.evaluate(() => window.dispatchEvent(new Event('clocking:launch')));
  await expect(page.locator('#startup-intro')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  await expect(page.locator('#startup-intro')).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator('#score')).toHaveText(points);
  await page.locator('#tap-right').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});

test('theme control becomes a sun in light mode and a moon in dark mode, persisting on reopening', async ({ page }) => {
  await installClock(page); await page.goto('/');
  await page.locator('#settings-button').click();
  const toggle = page.getByRole('switch', { name: 'Modo claro', exact: true });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('.theme-rays')).toHaveCSS('opacity', '0');
  const moonCutout = await page.locator('.theme-cutout').evaluate(el => getComputedStyle(el).transform);
  await toggle.check();
  await expect(page.locator('.theme-rays')).toHaveCSS('opacity', '1');
  await expect(page.locator('.theme-disc')).toHaveCSS('r', '5.5px');
  expect(await page.locator('.theme-cutout').evaluate(el => getComputedStyle(el).transform)).not.toBe(moonCutout);
  await page.locator('#continue-game').click(); await page.clock.runFor(300);
  await page.locator('#settings-button').click(); await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.locator('.theme-rays')).toHaveCSS('opacity', '0');
  await expect(page.locator('.theme-disc')).toHaveCSS('r', '8px');
});


test('native startup keeps the clock visible but waits for a drawable WebView before turning', async ({ page }) => {
  await installClock(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' clocking/0.3.24' }));
  await page.goto('/');
  await expect(page.locator('#startup-intro')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  expect(await page.locator('#intro-minute').evaluate(el => el.getAnimations().length)).toBe(0);
  await page.evaluate(() => { window.__clockingVisibleLaunch = true; window.dispatchEvent(new Event('clocking:launch')); });
  await expect.poll(() => page.locator('#intro-minute').evaluate(el => el.getAnimations().length)).toBe(1);
  await expect(page.locator('#startup-intro')).toHaveCount(0, { timeout: 7000 });
});

test('a hidden document cannot consume its intro before the player sees it', async ({ page }) => {
  await installClock(page);
  await page.addInitScript(() => {
    window.__hiddenBoot = true;
    Object.defineProperty(document, 'hidden', { get: () => window.__hiddenBoot });
  });
  await page.goto('/');
  await expect(page.locator('#startup-intro')).toHaveCount(0);
  await page.evaluate(() => { window.__hiddenBoot = false; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#intro-minute')).toBeVisible();
  await expect(page.locator('#startup-intro')).toHaveCount(0, { timeout: 7000 });
});
