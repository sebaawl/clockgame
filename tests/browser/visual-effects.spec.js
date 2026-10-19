import { backdropColors } from '../../src/ambience.js';
import { test, expect } from '@playwright/test';
import { installClock, play, solve } from './helpers.js';

test.beforeEach(async ({ page }) => { await installClock(page); await page.goto('/'); });

test('five consecutive solves show a large combo with a white flash on black', async ({ page }) => {
  await play(page);
  for (let i = 0; i < 5; i++) {
    await solve(page);
    if (i < 4) await page.clock.runFor(1000);
  }
  await expect(page.locator('#combo-big')).toHaveText('5×');
  await expect(page.locator('#combo-celebration')).toBeVisible();
  expect(parseFloat(await page.locator('#combo-big').evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThan(90);
  await expect(page.locator('#success-glow')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('#success-glow')).toHaveCSS('z-index', '6');
  await expect(page.locator('#clock-wrap')).toHaveCSS('opacity', '0');
  await expect(page.locator('#success-glow')).toHaveCSS('mix-blend-mode', 'difference');
  await expect(page.locator('#resources')).toHaveCSS('mix-blend-mode', 'normal');
  await expect(page.locator('#resources')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-phase', '6');
  await expect(page.locator('#clock-wrap')).toHaveCSS('opacity', '1');
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Destello de acierto', exact: true }).uncheck();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  for (let i = 0; i < 5; i++) { await solve(page); if (i < 4) await page.clock.runFor(1000); }
  await expect(page.locator('#combo-big')).toHaveText('10×');
  await expect(page.locator('#success-glow')).toHaveAttribute('data-combo', 'false');
  await expect(page.locator('#success-glow')).toHaveCSS('mix-blend-mode', 'difference');
  await expect(page.locator('#resources')).toHaveCSS('mix-blend-mode', 'normal');
  expect(await page.locator('#success-glow').evaluate(el => el.getAnimations().length)).toBe(0);
});

test('backdrops change with active time and stay frozen while paused', async ({ page }) => {
  await play(page);
  await expect(page.locator('body')).toHaveAttribute('data-backdrop', '0');
  await page.clock.runFor(10020);
  const color = await page.locator('body').getAttribute('data-backdrop');
  expect(color).not.toBe('0');
  const colors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { accent: root.getPropertyValue('--accent').trim(), flash: root.getPropertyValue('--combo-flash').trim() };
  });
  expect(colors.accent).toBe(backdropColors(Number(color)).accent);
  expect(colors.flash).toBe(backdropColors(Number(color)).flash);
  await page.evaluate(() => { document.body.dataset.nitro = 'true'; document.body.dataset.hot = 'true'; });
  const accents = await page.evaluate(() => ['.hand-line', '.trail-mark line', '#nitro-fill', '.combo-count'].map(selector => {
    const element = document.querySelector(selector), style = getComputedStyle(element);
    return selector.includes('line') ? style.stroke : selector === '#nitro-fill' ? style.backgroundColor : style.color;
  }));
  expect(new Set(accents).size).toBe(1);

  await page.keyboard.press('Space');
  await page.clock.runFor(30000);
  await expect(page.locator('body')).toHaveAttribute('data-backdrop', color);
  await page.keyboard.press('Space');
  await page.clock.runFor(1000);
  await expect(page.locator('body')).toHaveAttribute('data-backdrop', color);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
});

test('game over fills the viewport with red and slides up with readable controls in light mode', async ({ page }) => {
  await page.locator('#settings-button').click();
  await page.getByRole('switch', { name: 'Modo claro', exact: true }).check();
  await page.locator('#continue-game').click();
  await page.clock.runFor(240);
  await play(page);
  await page.clock.runFor(15100);
  await expect(page.locator('#game-over')).toHaveCSS('background-color', 'rgb(223, 38, 59)');
  await expect(page.locator('#game-over')).toHaveCSS('animation-name', 'game-over-rise');
  await expect(page.locator('#restart-game')).toHaveCSS('color', 'rgb(255, 255, 255)');
  const size = await page.locator('#game-over').evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight }));
  expect(size).toEqual(page.viewportSize());
});

test('best scores follow the selected mode and remain visible on the controls guide', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('clocking:best:classic:normal', '2468');
    localStorage.setItem('clocking:best:classic:hard', '864');
  });
  await page.reload();
  await expect(page.locator('#menu-best strong')).toHaveText('2.468');
  await page.locator('#mode-hard').click();
  await expect(page.locator('#menu-best strong')).toHaveText('864');
  await page.locator('#start-game').click();
  await page.clock.runFor(3000);
  await expect(page.locator('#guide-best')).toBeVisible();
  await expect(page.locator('#guide-best strong')).toHaveText('864');
  expect(parseFloat(await page.locator('#guide-best strong').evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(32);
  await expect(page.locator('.guide-nitro, .guide-start, .guide-control strong, .guide-control > span:last-child:not(.guide-arrow)')).toHaveCount(0);
  await expect(page.locator('.guide-clock-hand').first()).toHaveCSS('animation-duration', '5.2s');
});

for (const theme of ['dark', 'light']) {
  test(`breaking a streak restores the ${theme} monochrome backdrop and resets its color timer`, async ({ page }) => {
    if (theme === 'light') {
      await page.locator('#settings-button').click();
      await page.getByRole('switch', { name: 'Modo claro', exact: true }).check();
      await page.locator('#continue-game').click(); await page.clock.runFor(240);
    }
    await play(page); await solve(page); await page.clock.runFor(1000);
    await page.clock.runFor(10020);
    await expect(page.locator('body')).not.toHaveAttribute('data-backdrop', '0');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#combo')).toHaveText('×0');
    await expect(page.locator('body')).toHaveAttribute('data-backdrop', '0');
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return { background: style.getPropertyValue('--background').trim(), accent: style.getPropertyValue('--accent').trim() };
    });
    expect(colors).toEqual({ background: theme === 'light' ? '#ffffff' : '#000000', accent: theme === 'light' ? '#007fa8' : '#54d8ff' });
    expect(parseFloat(await page.locator('#score').evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(40);
    await page.clock.runFor(1000);
    await expect(page.locator('body')).toHaveAttribute('data-backdrop', '0');
    await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  });
}
