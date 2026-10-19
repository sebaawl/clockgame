import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.4; });
  const instant = new Date('2026-10-19T12:00:00Z');
  await page.clock.install({ time: instant });
  await page.clock.pauseAt(instant);
  await page.goto('/');
  await page.clock.runFor(800);
});

async function begin(page) {
  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
}

async function solve(page) {
  const label = await page.locator('#clock').getAttribute('aria-label');
  const position = Number(label.match(/(?:hora|minuto|segundo) (\d+)/)[1]);
  const count = label.includes('hora ') ? 12 : 60;
  const key = position <= count / 2 ? 'ArrowLeft' : 'ArrowRight';
  const taps = Math.min(position, count - position);
  for (let i = 0; i < taps; i++) await page.keyboard.press(key);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
}

test('start, touch controls, bump feedback, and automatic first phase', async ({ page, isMobile }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Todo a su tiempo.');
  await begin(page);
  await expect(page.locator('#timer-whole')).toHaveText('10');
  const right = page.locator('#tap-right');
  if (isMobile) await right.tap();
  else await right.click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await page.clock.runFor(1250);
  await expect(page.locator('#phase-label')).toHaveText('FASE 01');
  await expect(page.locator('#timer-whole')).toHaveText('15');
  // One physical activation must produce exactly one step, in either direction.
  await page.getByRole('button', { name: 'Girar en sentido antihorario. Flecha izquierda.' }).click();
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 10\./);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#clock')).toHaveAttribute('aria-label', /hora 11\./);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
  await expect(page.locator('#best-label')).toContainText('01');
  expect(errors).toEqual([]);
});

test('countdown, pause, help, expiry, and retry preserve the current phase', async ({ page }) => {
  await begin(page);
  await solve(page);
  await page.clock.runFor(1250);
  await page.clock.runFor(2000);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const before = await page.locator('#timer').textContent();
  await page.clock.runFor(30_000);
  await expect(page.locator('#timer')).toHaveText(before);
  await page.getByRole('button', { name: 'Seguir jugando' }).click();
  await page.getByRole('button', { name: 'Cómo jugar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.runFor(30_000);
  await page.getByRole('button', { name: 'Ya lo tengo' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  await page.getByRole('button', { name: 'Seguir jugando' }).click();
  await page.clock.runFor(16_000);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'lost');
  await expect(page.locator('#timer')).toHaveText('0,0s');
  await page.getByRole('button', { name: 'Repetir esta fase' }).click();
  await expect(page.locator('#phase-label')).toHaveText('FASE 01');
  await expect(page.locator('#timer-whole')).toHaveText('15');
});

test('30 actual solves switch from hours at 7 seconds to minutes at 15', async ({ page }) => {
  await begin(page);
  await solve(page);
  await page.clock.runFor(1250);
  for (let phase = 1; phase <= 30; phase++) {
    await expect(page.locator('#phase-label')).toHaveText(`FASE ${String(phase).padStart(2, '0')}`);
    if (phase === 30) await expect(page.locator('#time-progress')).toHaveAttribute('aria-valuemax', '7.0');
    await solve(page);
    await page.clock.runFor(phase === 30 ? 1250 : 650);
  }
  await expect(page.locator('#stage-heading')).toHaveText('Los minutos.');
  await expect(page.locator('#phase-label')).toHaveText('FASE 01');
  await expect(page.locator('#time-progress')).toHaveAttribute('aria-valuemax', '15.0');
  await expect(page.locator('[data-stage="0"]')).toHaveClass(/completed/);
  const rotation = await page.locator('#active-hand').getAttribute('style');
  await page.keyboard.press('ArrowLeft');
  expect(await page.locator('#active-hand').getAttribute('style')).not.toBe(rotation);
});

test('sound preference persists and reduced motion keeps controls functional', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Activar sonido', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Desactivar sonido', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Desactivar sonido', exact: true })).toBeVisible();
  await begin(page);
  await solve(page);
  await expect(page.locator('#feedback')).toHaveText('Eso es. Ya tienes el ritmo.');
});

test('screen halves work beyond the dial and there is no horizontal overflow', async ({ page }) => {
  const dimensions = await page.evaluate(() => ({ scroll: document.body.scrollWidth, viewport: innerWidth }));
  expect(dimensions.scroll).toBe(dimensions.viewport);
  await begin(page);
  // The right half of the heading, outside the clock's own hit zones.
  const heading = await page.locator('.intro').boundingBox();
  const width = page.viewportSize().width;
  await page.mouse.click(width * 0.7, heading.y + 20);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
});
