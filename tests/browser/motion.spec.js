import { test, expect } from '@playwright/test';
import { installClock, play } from './helpers.js';

test('mode selector travels and draws its outline; settings icons animate on an opaque surface', async ({ page }) => {
  await installClock(page);
  await page.goto('/');
  await page.locator('#mode-hard').click();
  const selector = await page.locator('#mode-selector').evaluate(el => ({ transform: el.style.transform, animation: window.__motions.findLast(motion => Array.isArray(motion.frames) && motion.frames.some(frame => frame.strokeDashoffset === 100)) }));
  expect(selector.transform).not.toBe('translate(0px, 0px)');
  expect(selector.animation.frames[0].strokeDashoffset).toBe(100);
  await play(page);
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('#menu-settings svg')).toHaveCount(1);
  await expect(page.locator('#restart-settings svg')).toHaveCount(1);
  await page.locator('#restart-settings').click();
  expect(await page.locator('#restart-settings svg').evaluate(el => el.getAnimations().some(a => a.effect.getKeyframes().some(f => f.transform?.includes('360deg'))))).toBe(true);
  await page.clock.runFor(240);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'break');
});
