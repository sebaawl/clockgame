import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, moveGame, tickGame, advanceGame, pauseGame, resumeGame, settleGame, beginPlay } from '../src/game.js';
import { rhythmGrade } from '../src/rhythm.js';
const start = (format = 'rhythm', mode = 'normal') => startGame(createGame(), 0, () => .4, mode, format);
function survivalRhythm() {
  const g = start('survival');
  Object.assign(g, { completed: 10, status: 'cleared', remaining: 6, deadline: 6000 });
  advanceGame(g, 0, () => .4);
  assert.equal(g.challenge, 'rhythm');
  return g;
}
function solve(g, error = 0) {
  for (let i = 0; i < 4; i++) moveGame(g, i % 2 ? -1 : 1, g.rhythmNext + error);
  assert.equal(g.status, g.format === 'rhythm' ? 'playing' : 'cleared');
}
test('four timed pulses complete a full turn; hard route and Nitro cannot settle it early', () => {
  const g = start('rhythm', 'hard'), initial = g.rotation;
  assert.equal(settleGame(g, 0, { nitroLock: true }), false);
  solve(g);
  assert.equal(g.rotation - initial, 360);
  assert.equal(g.completed, 4);
  assert.equal(g.rhythmScore, 192);
  assert.equal(g.lastTimeGain, 0);
  assert.equal(g.perfect, true);
});
test('precision windows include both edges and reward exact over marginal taps', () => {
  assert.equal(rhythmGrade(45).label, 'EXACTO');
  assert.equal(rhythmGrade(95).label, 'BIEN');
  assert.equal(rhythmGrade(170).label, 'JUSTO');
  assert.equal(rhythmGrade(171), null);
  for (const error of [-170, 170]) { const g = start(); solve(g, error); assert.equal(g.rhythmScore, 48); }
});
test('survival freezes its countdown and earns time according to precision for the next clock', () => {
  const exact = survivalRhythm(), marginal = survivalRhythm();
  tickGame(exact, exact.rhythmNext - 100);
  assert.equal(exact.remaining, 6);
  solve(exact); solve(marginal, 160);
  assert.ok(Math.abs(exact.lastTimeGain - 2.6) < 1e-9);
  assert.ok(Math.abs(marginal.lastTimeGain - .6) < 1e-9);
  const now = exact.rhythmNext - exact.rhythmPeriod;
  advanceGame(exact, now + 1000, () => .4);
  assert.equal(exact.challenge, 'normal');
  assert.ok(Math.abs(exact.remaining - 7.6) < 1e-9);
  tickGame(exact, now + 2000);
  assert.ok(Math.abs(exact.remaining - 6.6) < 1e-9);
});
test('spamming cannot farm points; missing unattended beats loses the run at any FPS', () => {
  const a = start(), b = start();
  for (let i = 0; i < 10; i++) moveGame(a, 1, 1);
  assert.equal(a.rhythmMisses, 1); assert.equal(a.rhythmScore, 0);
  moveGame(a, 1, a.rhythmNext - 200);
  moveGame(a, 1, a.rhythmNext - 200);
  assert.equal(a.status, 'lost'); assert.equal(a.rhythmScore, 0);
  tickGame(b, 10000);
  assert.equal(b.status, 'lost'); assert.equal(b.rhythmMisses, 3);
});
test('pause preserves ring distance; standalone rhythm keeps strikes between clocks and has no timer reward', () => {
  const g = start();
  pauseGame(g, 400);
  tickGame(g, 100000);
  assert.equal(g.rhythmMisses, 0);
  resumeGame(g, 100000);
  assert.equal(g.rhythmNext, 101200);
  moveGame(g, 1, 101200); moveGame(g, 1, g.rhythmNext - 200);
  assert.equal(g.rhythmMisses, 1);
  for (let i = 0; i < 3; i++) moveGame(g, 1, g.rhythmNext);
  assert.equal(g.status, 'playing'); assert.equal(g.lastTimeGain, 0);
  const next = g.rhythmNext; advanceGame(g, next + 5000, () => .4);
  assert.equal(g.rhythmNext, next);
  assert.equal(g.rhythmMisses, 1); assert.equal(g.challenge, 'rhythm');
});
test('standalone duels always use minutes and keep lives instead of a countdown', () => {
  const g = start('duel');
  for (let i = 0; i < 30; i++) {
    assert.equal(g.challenge, 'tug'); assert.equal(g.stage, 1); assert.equal(g.phase, 1); assert.equal(g.round, 0);
    const steps = Math.abs(g.duelOffset), direction = -Math.sign(g.duelOffset);
    for (let j = 0; j < steps; j++) moveGame(g, direction, 0);
    assert.equal(g.status, 'cleared'); assert.equal(g.lastTimeGain, 0);
    advanceGame(g, 0, () => .4);
  }
  assert.equal(g.lives, 3);
});

test('restarting clears strikes and presentation never advances the first duel or rhythm beat', () => {
  const g = start();
  tickGame(g, 10000); assert.equal(g.status, 'lost');
  startGame(g, 20000, () => .4, 'normal', 'rhythm');
  assert.equal(g.rhythmMisses, 0);
  beginPlay(g, 90000);
  tickGame(g, 90000); assert.equal(g.rhythmMisses, 0);
  assert.equal(g.rhythmNext, 91600);
  const duel = start('duel'), position = duel.position;
  beginPlay(duel, 90000); tickGame(duel, 90299);
  assert.equal(duel.position, position);
  tickGame(duel, 90300); assert.notEqual(duel.position, position);
});

test('a press just beyond the late margin loses one life, never two', () => {
  const g = start();
  moveGame(g, 1, g.rhythmNext + 171);
  assert.equal(g.rhythmMisses, 1); assert.equal(g.rhythmHits, 0);
  assert.equal(g.status, 'playing');
  pauseGame(g, g.rhythmNext - g.rhythmPeriod + 180); resumeGame(g, 100000);
  moveGame(g, 1, 100000);
  assert.equal(g.rhythmMisses, 1);
  moveGame(g, 1, g.rhythmNext);
  assert.equal(g.rhythmMisses, 1); assert.equal(g.rhythmHits, 1);
});

test('rhythm accelerates monotonically without cycles or pauses, with a playable speed floor', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const g = startGame(createGame(), 0, () => .4, 'normal', 'rhythm', { difficulty });
    const initial = g.rhythmPeriod;
    for (let i = 0; i < 250; i++) {
      const period = g.rhythmPeriod;
      moveGame(g, 1, g.rhythmNext);
      assert.equal(g.status, 'playing'); assert.ok(g.rhythmPeriod <= period);
      assert.equal(g.stage, 0); assert.equal(g.phase, 1); assert.equal(g.round, 0);
    }
    assert.ok(g.rhythmPeriod < initial / 2); assert.ok(g.rhythmPeriod >= 380);
    assert.equal(g.rhythmMisses, 0); assert.equal(g.rhythmHits, 250);
  }
});
test('duel pushes away from twelve on either side and a slip costs one life before repositioning', () => {
  for (const roll of [.4, .8]) {
    const g = startGame(createGame(), 0, () => roll, 'normal', 'duel');
    const side = Math.sign(g.duelOffset), before = Math.abs(g.duelOffset);
    moveGame(g, -side, 1); assert.equal(Math.abs(g.duelOffset), before - 1);
    tickGame(g, g.driftNext); assert.equal(Math.abs(g.duelOffset), before);
    assert.equal(g.driftDirection, side);
    const life = g.lives;
    while (g.lives === life) tickGame(g, g.driftNext);
    assert.equal(g.lives, 2); assert.equal(g.status, 'playing');
    assert.ok(Math.abs(g.duelOffset) >= 12 && Math.abs(g.duelOffset) <= 24);
    assert.equal(g.attemptSteps, 0); assert.equal(g.duelEscapes, 1);
    pauseGame(g, g.driftNext - 100); const position = g.position;
    tickGame(g, 100000); assert.equal(g.position, position); assert.equal(g.lives, 2);
    resumeGame(g, 100000); tickGame(g, 100099); assert.equal(g.position, position);
    tickGame(g, 100100); assert.notEqual(g.position, position);
    tickGame(g, 200000); assert.equal(g.lives, 0); assert.equal(g.status, 'lost');
  }
});
test('duel outcome is independent of frame rate and never wins through autonomous movement', () => {
  const a = start('duel'), b = start('duel');
  tickGame(a, 5000);
  for (let now = 0; now <= 5000; now += 10) tickGame(b, now);
  assert.deepEqual([a.position,a.lives,a.driftNext,a.duelEscapes], [b.position,b.lives,b.driftNext,b.duelEscapes]);
  assert.equal(a.completed, 0); assert.notEqual(a.status, 'cleared');
});
