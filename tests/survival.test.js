import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, advanceGame, moveGame, tickGame, pauseGame, resumeGame, settleGame } from '../src/game.js';

function challenge(completed, { stage = 0, mode = 'normal', boosts = [] } = {}) {
  const g = startGame(createGame(), 0, () => .4, mode, 'survival', { boosts });
  Object.assign(g, { completed: completed + stage * 10, status: 'cleared' });
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

test('classic stays unchanged; later survival cycles use duels with stage-appropriate speeds', () => {
  for (const stage of [0, 1, 2]) {
    for (const slot of [2, 5, 8]) {
      const classic = startGame(createGame(), 0, () => .4);
      Object.assign(classic, { completed: slot, stage, status: 'cleared' });
      advanceGame(classic, 0, () => .4);
      assert.equal(classic.challenge, 'normal');
      const survival = challenge(slot, { stage });
      assert.equal(survival.challenge, slot === 2 && stage === 0 ? 'exact' : slot === 8 ? 'chaos' : 'duel');
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
