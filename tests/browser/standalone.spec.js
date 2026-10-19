import { test, expect } from '@playwright/test';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let folder;

test.beforeEach(async ({ page, context }) => {
  // Use an isolated, renamed file: no checkout assets or conventional filename.
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
  // A blank, opaque-origin document has no server or checkout assets to fall back to.
  await page.goto('about:blank');
  await page.setContent(await readFile(join(folder, 'mi reloj.html'), 'utf8'));
  await page.clock.runFor(800);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Todo a su tiempo.');
}

test('standalone HTML plays offline with embedded styles and fonts', async ({ page, isMobile }) => {
  const errors = [];
  const networkRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) networkRequests.push(request.url()); });
  await openPortable(page);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily)).toContain('DM Sans');
  const fonts = await page.evaluate(() => [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family));
  expect(fonts).toContain('DM Sans');
  expect(fonts).toContain('Instrument Serif');

  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
  if (isMobile) await page.locator('#tap-right').tap();
  else await page.locator('#tap-right').click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await page.clock.runFor(1250);
  await expect(page.locator('#phase-label')).toHaveText('FASE 01');
  await expect(page.locator('#timer-whole')).toHaveText('15');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.clock.runFor(5000);
  await expect(page.locator('#timer-whole')).toHaveText('15');

  const currentUrl = page.url();
  await page.getByRole('link', { name: 'clocking, inicio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Todo a su tiempo.');
  expect(page.url()).toBe(currentUrl);
  expect(await page.locator('#font-licenses').evaluate(element => JSON.parse(element.textContent).length)).toBe(2);
  expect(errors).toEqual([]);
  expect(networkRequests).toEqual([]);
});

test('standalone HTML still plays when browser privacy settings deny localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage disabled', 'SecurityError'); },
    });
  });
  await openPortable(page);
  await page.getByRole('button', { name: 'Activar sonido', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(1250);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('#best-label')).toContainText('01');
});

test('a renamed local HTML file opens directly and its home link stays in that file', async ({ page }) => {
  const fileUrl = pathToFileURL(join(folder, 'mi reloj.html')).href;
  try {
    await page.goto(fileUrl);
  } catch (error) {
    // Managed Chromium can forbid all file URLs; keep this distinct from an app failure.
    if (error.message.includes('net::ERR_BLOCKED_BY_ADMINISTRATOR')) {
      test.skip(true, 'Browser administration policy blocks file://. Standalone HTML is tested separately offline in an opaque-origin document.');
    }
    throw error;
  }
  await page.clock.runFor(800);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Todo a su tiempo.');
  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await page.getByRole('link', { name: 'clocking, inicio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Todo a su tiempo.');
  expect(page.url()).toBe(fileUrl);
});
