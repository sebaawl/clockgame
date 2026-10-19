import { test, expect } from '@playwright/test';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let folder;
test.beforeEach(async ({ page, context }) => {
  folder = await mkdtemp(join(tmpdir(), 'clocking sin conexión '));
  await copyFile(new URL('../../index.html', import.meta.url), join(folder, 'mi reloj.html'));
  await context.setOffline(true);
  await page.addInitScript(() => { Math.random = () => 0.4; });
  const instant = new Date('2026-10-19T12:00:00Z');
  await page.clock.install({ time: instant });
  await page.clock.pauseAt(instant);
});
test.afterEach(async () => {
  if (folder) await rm(folder, { recursive: true, force: true });
});

async function openPortable(page) {
  await page.goto('about:blank');
  await page.setContent(await readFile(join(folder, 'mi reloj.html'), 'utf8'));
  await expect(page.locator('#time')).toHaveText('10.0');
  await expect(page.locator('#clock')).toBeVisible();
}

test('single HTML plays and celebrates offline with no external assets', async ({ page, isMobile }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await openPortable(page);
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(0, 0, 0)');
  if (isMobile) await page.locator('#tap-right').tap();
  else await page.locator('#tap-right').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  expect(await page.locator('#success-glow').evaluate(el => el.getAnimations()[0].effect.getTiming().duration)).toBe(1000);
  await page.clock.runFor(1000);
  await expect(page.locator('#time')).toHaveText('15.0');
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});

test('single HTML works even when all local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  });
  await openPortable(page);
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(1000);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
});

test('a renamed local HTML file opens directly', async ({ page }) => {
  try {
    await page.goto(pathToFileURL(join(folder, 'mi reloj.html')).href);
  } catch (error) {
    if (error.message.includes('net::ERR_BLOCKED_BY_ADMINISTRATOR')) {
      test.skip(true, 'Managed browser blocks file://; offline standalone content is tested separately.');
    }
    throw error;
  }
  await expect(page.locator('#time')).toHaveText('10.0');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
});
