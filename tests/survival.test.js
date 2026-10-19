import { exactGuide } from '../src/survival.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, advanceGame, moveGame, tickGame, pauseGame, resumeGame, settleGame } from '../src/game.js';

function challenge(completed, { stage = 0, mode = 'normal', boosts = [] } = {}) {
  const g = startGame(createGame(), 0, () => .4, mode, 'survival', { boosts });
  Object.assign(g, { completed: completed + [0, 12, 18][stage], status: 'cleared' });
  advanceGame(g, 0, () => .4);
  return g;
}

test('exact clocks require an additional full turn, accept Nitro and never clear on the first twelve', () => {
  const g = challenge(2);
  assert.equal(g.challenge, 'exact');
  assert.ok(g.targetClicks > 12);
  const target = g.targetClicks;
  for (let i = 0; i < target; i++) {
    moveGame(g, g.challengeDirection, 10, { deferSolve: true });
    if (i < target - 1) assert.equal(settleGame(g, 10, { perfectNitro: true }), false);
  }
  assert.equal(settleGame(g, 10, { perfectNitro: true }), true);
  assert.equal(g.perfect, true);
  assert.equal(g.combo, 1);
  assert.equal(g.perfectNitro, true);
  assert.equal(g.completed, 3);
});

test('a missed count costs a second, resets combo and creates a solvable counter even in hard route', () => {
  for (const mode of ['normal', 'hard']) {
    const g = challenge(2, { mode });
    g.combo = 4;
    const target = g.targetClicks, before = g.remaining;
    for (let i = 0; i < target; i++) moveGame(g, -g.challengeDirection, 1);
    assert.equal(g.challengeRetries, 1);
    assert.equal(g.attemptSteps, 0);
    assert.equal(g.combo, 0);
    assert.ok(Math.abs(g.remaining - (before - 1.001)) < 1e-8);
    const retry = g.targetClicks;
    for (let i = 0; i < retry; i++) moveGame(g, g.challengeDirection, 2);
    assert.equal(g.status, 'cleared');
    assert.equal(g.perfect, false);
  }
});

test('Nitro Lock waits for the exact count and consumes only one use', () => {
  const g = challenge(2, { boosts: ['lock'] });
  const target = g.targetClicks;
  for (let i = 0; i < target; i++) {
    moveGame(g, g.challengeDirection, 1, { deferSolve: true });
    if (i < target - 1) { assert.equal(g.status, 'playing'); assert.equal(g.lockUses, 3); }
  }
  assert.equal(g.status, 'cleared');
  assert.equal(g.lockUses, 2);
  assert.equal(g.nitroLocked, true);
});

test('autonomous movement never wins by itself or spends manual taps or Nitro', () => {
  const g = challenge(5);
  assert.equal(g.challenge, 'duel');
  const start = g.position, nitro = g.nitro;
  tickGame(g, g.driftInterval * start);
  assert.equal(g.position, 0);
  assert.equal(g.status, 'playing');
  assert.equal(g.completed, 5);
  assert.equal(g.attemptSteps, 0);
  assert.equal(g.taps, 0);
  assert.equal(g.nitro, nitro);
  tickGame(g, g.driftInterval * (start + 1));
  moveGame(g, 1, g.driftInterval * (start + 1));
  assert.equal(g.status, 'cleared');
});

test('changing-direction duels follow real time independently of frame rate', () => {
  const a = challenge(8), b = challenge(8);
  const direction = a.driftDirection;
  tickGame(a, a.flipInterval);
  assert.equal(a.driftDirection, -direction);
  for (let time = 0; time <= 4500; time += 30) tickGame(b, time);
  tickGame(a, 4500);
  assert.deepEqual([a.position, a.rotation, a.driftDirection, a.driftNext, a.flipNext], [b.position, b.rotation, b.driftDirection, b.driftNext, b.flipNext]);
});

test('pausing freezes autonomous steps and direction changes without catching up on resume', () => {
  const g = challenge(8);
  pauseGame(g, 450);
  const snapshot = [g.position, g.rotation, g.driftDirection, g.remaining];
  tickGame(g, 10000);
  assert.deepEqual([g.position, g.rotation, g.driftDirection, g.remaining], snapshot);
  resumeGame(g, 10000);
  tickGame(g, 10449);
  assert.equal(g.position, snapshot[0]);
  tickGame(g, 10450);
  assert.notEqual(g.position, snapshot[0]);
  tickGame(g, 10900);
  assert.equal(g.driftDirection, -snapshot[2]);
});

test('classic has no special clocks; shorter minute and second cycles retain both duels', () => {
  for (const stage of [0, 1, 2]) {
    const schedule = stage === 0 ? [[2, 'exact'], [5, 'duel'], [8, 'chaos']] : stage === 1 ? [[2, 'duel'], [5, 'chaos']] : [[1, 'duel'], [3, 'chaos']];
    for (const [slot, kind] of schedule) {
      const classic = startGame(createGame(), 0, () => .4);
      Object.assign(classic, { completed: slot, stage, status: 'cleared' });
      advanceGame(classic, 0, () => .4);
      assert.equal(classic.challenge, 'normal');
      assert.equal(challenge(slot, { stage }).challenge, kind);
    }
  }
});

test('exact targets vary between one and two additional turns and remain solvable', () => {
  const observed = new Set();
  for (const roll of [.1, .4, .8]) {
    const g = startGame(createGame(), 0, () => roll, 'normal', 'survival');
    Object.assign(g, { completed: 2, status: 'cleared' }); advanceGame(g, 0, () => roll);
    observed.add(g.extraTurns);
    const distance = g.challengeDirection === 1 ? 12 - g.position : g.position;
    assert.equal(g.targetClicks, 12 * g.extraTurns + distance);
    const target = g.targetClicks;
    for (let i = 0; i < target; i++) moveGame(g, g.challengeDirection, 10);
    assert.equal(g.status, 'cleared');
    assert.equal(g.perfect, true);
  }
  assert.deepEqual([...observed].sort(), [1, 2]);
});

test('compass waits through spare clicks, then guides a wasted route to a valid exact finish', () => {
  const g = challenge(2, { boosts: ['compass'] });
  assert.equal(exactGuide(g).state, 'free');
  while (exactGuide(g).state === 'free') moveGame(g, -g.challengeDirection, 1);
  assert.equal(exactGuide(g).state, 'turn');
  while (g.status === 'playing') moveGame(g, exactGuide(g).direction, 1);
  assert.equal(g.position, 0);
  assert.equal(g.attemptSteps, g.targetClicks);
  assert.equal(exactGuide(g).state, 'release');
});

test('compass advice preserves reachability across every valid hour and remaining click count', () => {
  const can = (p, n) => n >= Math.min(p, 12 - p) && (n - Math.min(p, 12 - p)) % 2 === 0;
  for (let p = 0; p < 12; p++) for (let left = 0; left <= 35; left++) {
    const g = { format: 'survival', challenge: 'exact', position: p, targetClicks: left, attemptSteps: 0, challengeDirection: -1 };
    const before = JSON.stringify(g), guide = exactGuide(g);
    assert.equal(JSON.stringify(g), before);
    if (!can(p, left)) assert.equal(guide.state, 'lost');
    else if (!left) assert.equal(guide.state, 'release');
    else {
      assert.ok(can((p + guide.direction + 12) % 12, left - 1));
      if (guide.state === 'free') for (const dir of [-1, 1]) assert.ok(can((p + dir + 12) % 12, left - 1));
    }
  }
  assert.equal(exactGuide({ format: 'classic', challenge: 'exact' }), null);
});

test('survival repeats 12 hours, 6 minutes and 4 seconds without ending the run', () => {
  const g = startGame(createGame(), 0, () => .4, 'normal', 'survival');
  const observed = [0, 0, 0];
  let now = 0;
  for (let i = 0; i < 66; i++) {
    observed[g.stage]++;
    const count = g.optimalSteps;
    for (let j = 0; j < count; j++) {
      now = g.challenge === 'rhythm' ? g.rhythmNext : now + 1;
      moveGame(g, g.optimalDirection || 1, now);
    }
    assert.equal(g.status, 'cleared'); advanceGame(g, now, () => .4);
  }
  assert.deepEqual(observed, [36, 18, 12]);
  assert.equal(g.status, 'playing'); assert.equal(g.round, 3); assert.equal(g.phase, 1);
});
