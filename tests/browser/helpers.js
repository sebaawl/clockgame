import { expect } from '@playwright/test';

export async function installClock(page, { feedback = false } = {}) {
  await page.addInitScript(({ feedback }) => {
    Math.random = () => 0.4;
    try {
      if (!localStorage.getItem('clocking:preferences')) localStorage.setItem('clocking:preferences', JSON.stringify({ sound: feedback, vibration: feedback, theme: 'dark', mode: 'normal' }));
    } catch { /* A standalone test deliberately blocks storage. */ }
    window.__motions = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      window.__motions.push({ id: this.id, frames, options });
      return animate.call(this, frames, options);
    };
    window.__pulses = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pattern => { window.__pulses.push(pattern); return true; } });
    window.__ticks = 0;
    const mediaPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) { window.__ticks += 1; return mediaPlay.apply(this, args); };
    window.__frequencies = [];
    window.__peaks = [];
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      const original = Audio.prototype.createBufferSource;
      Audio.prototype.createBufferSource = function (...args) { window.__ticks += 1; return original.apply(this, args); };
      const set = AudioParam.prototype.setValueAtTime;
      AudioParam.prototype.setValueAtTime = function (value, ...args) { if (value > 1000) window.__frequencies.push(value); return set.call(this, value, ...args); };
      const ramp = AudioParam.prototype.exponentialRampToValueAtTime;
      AudioParam.prototype.exponentialRampToValueAtTime = function (value, ...args) { if (value < 0.1) window.__peaks.push(value); return ramp.call(this, value, ...args); };
    }
  }, { feedback });
  const instant = new Date('2026-10-19T12:00:00Z');
  await page.clock.install({ time: instant });
  await page.clock.pauseAt(new Date(instant.getTime() + 60_000));
}

export async function selectChoice(page, kind, value) {
  const titles = { route: { normal: 'Normal', hard: 'Contraintuitivo' }, format: { classic: 'Clásico', survival: 'Supervivencia' }, difficulty: { easy: 'Fácil', medium: 'Media', hard: 'Difícil' } };
  const wanted = titles[kind][value];
  for (let i = 0; i < 3; i++) {
    if (await page.locator(`#${kind}-current`).textContent() === wanted) return;
    await page.locator(`[data-cycle="${kind}"][data-step="1"]`).click();
  }
  await expect(page.locator(`#${kind}-current`)).toHaveText(wanted);
}

export async function play(page, mode = 'normal') {
  await selectChoice(page, 'route', mode);
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'break');
  await page.clock.runFor(3000);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.locator('#tap-right').click();
  await page.clock.runFor(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches ? 160 : 560));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'playing');
  await page.evaluate(() => { window.__pulses = []; });
}

export async function solve(page) {
  await page.evaluate(() => {
    const label = document.getElementById('clock').getAttribute('aria-label');
    const position = Number(label.match(/(?:hora|minuto|segundo) (\d+)/)[1]);
    const count = label.includes('hora ') ? 12 : label.includes('minuto ') ? 60 : 120;
    const hard = document.body.dataset.mode === 'hard';
    const direction = hard ? (position < count / 2 ? 1 : -1) : (position <= count / 2 ? -1 : 1);
    const steps = direction === 1 ? count - position : position;
    for (let i = 0; i < steps; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: direction === 1 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-state', 'cleared');
}
