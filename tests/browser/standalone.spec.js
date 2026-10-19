import { test, expect } from '@playwright/test';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installClock, play, solve } from './helpers.js';

let folder;
test.beforeEach(async ({ page, context }) => {
  folder = await mkdtemp(join(tmpdir(), 'clocking sin conexión '));
  await copyFile(new URL('../../index.html', import.meta.url), join(folder, 'mi reloj.html'));
  await context.setOffline(true);
  await installClock(page);
});
test.afterEach(async () => { if (folder) await rm(folder, { recursive: true, force: true }); });
async function openPortable(page) {
  await page.goto('about:blank');
  await page.setContent(await readFile(join(folder, 'mi reloj.html'), 'utf8'));
  await expect(page.locator('#start-menu')).toBeVisible();
}

test('single HTML includes fonts, menu, gameplay and settings without any external request', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await openPortable(page);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('700 48px Poppins'))).toBe(true);
  await play(page);
  await solve(page);
  await expect(page.locator('#score')).toHaveText('8');
  await page.clock.runFor(1000);
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings')).toBeVisible();
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});

test('hard mode still works in a downloaded file with local storage denied', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } }); });
  await openPortable(page);
  await play(page, 'hard');
  await solve(page);
  await expect(page.locator('#score')).toHaveText('12');
});

test('a renamed local HTML file opens directly', async ({ page }) => {
  try { await page.goto(pathToFileURL(join(folder, 'mi reloj.html')).href); }
  catch (error) {
    if (error.message.includes('net::ERR_BLOCKED_BY_ADMINISTRATOR')) test.skip(true, 'Managed browser blocks file://; offline content is verified separately.');
    throw error;
  }
  await play(page);
  await solve(page);
  await expect(page.locator('#score')).toHaveText('8');
});
