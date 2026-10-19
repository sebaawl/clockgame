import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, moveGame, tickGame, advanceGame, pauseGame, resumeGame, phaseBudget, positions, randomPosition } from '../src/game.js';

const random = () => 0.4;
const rolls = new Map();
function rollFor(stage, target) {
  if (!rolls.has(stage)) {
    const targets = new Map();
    for (let i = 0; i < 20000; i++) targets.set(randomPosition(stage, 'normal', () => i / 20000), i / 20000);
    rolls.set(stage, targets);
  }
  assert.ok(rolls.get(stage).has(target), `Unreachable target ${target}`);
  return rolls.get(stage).get(target);
}
function solve(game, now) {
  const count = positions(game.stage);
  const direction = game.mode === 'hard' ? game.requiredDirection : game.position <= count / 2 ? -1 : 1;
  for (let guard = 0; game.status === 'playing' && guard < count * 2; guard++) moveGame(game, direction, now);
  assert.equal(game.status, 'cleared');
}

test('new games have no tutorial: the first actual adjustment starts with twelve or nine seconds', () => {
  assert.equal(createGame().status, 'menu');
  for (const [mode, budget] of [['normal', 12], ['hard', 9]]) {
    const game = startGame(createGame(), 100, random, mode);
    assert.equal(game.remaining, budget);
    assert.equal(game.phase, 1);
    assert.equal(game.completed, 0);
    assert.equal('tutorial' in game, false);
    solve(game, 200);
    assert.equal(game.completed, 1);
  }
});

test('starting positions span every unsolved hour, minute and second, including near and far targets', () => {
  for (const stage of [0, 1, 2]) {
    const count = positions(stage);
    for (const mode of ['normal', 'hard']) {
      const observed = new Set();
      for (let i = 0; i < 20000; i++) observed.add(randomPosition(stage, mode, () => i / 20000));
      assert.equal(observed.has(0), false);
      assert.equal(observed.has(1), true);
      assert.equal(observed.has(count - 1), true);
      assert.equal(observed.has(count / 2), mode === 'normal');
      assert.equal(observed.size, count - (mode === 'hard' ? 2 : 1));
    }
  }
});

test('normal mode accepts either route and ignores further taps after a solve', () => {
  for (const direction of [-1, 1]) {
    const game = startGame(createGame(), 0, random);
    for (let i = 0; i < 12 && game.status === 'playing'; i++) moveGame(game, direction, 10);
    assert.equal(game.position, 0);
    assert.equal(game.status, 'cleared');
    assert.equal(moveGame(game, direction, 20), false);
  }
});

test('at three o’clock hard mode requires nine clockwise steps; the intuitive shortcut cannot clear', () => {
  const game = startGame(createGame(), 0, () => .05, 'hard');
  assert.equal(game.position, 3);
  assert.equal(game.requiredDirection, 1);
  assert.equal(game.requiredSteps, 9);
  for (let i = 0; i < 3; i++) moveGame(game, -1, 10);
  assert.equal(game.position, 0);
  assert.equal(game.status, 'playing');
  assert.equal(game.completed, 0);
  for (let i = 0; i < 12; i++) moveGame(game, 1, 20);
  assert.equal(game.status, 'cleared');
  assert.equal(game.completed, 1);
});

test('hard mode cannot be bypassed by reversing the last tap or walking the wrong way around again', () => {
  const game = startGame(createGame(), 0, () => .05, 'hard');
  for (const direction of [-1, -1, 1, -1, -1]) moveGame(game, direction, 10);
  assert.equal(game.position, 0);
  assert.equal(game.status, 'playing');
  for (let i = 0; i < 12; i++) moveGame(game, -1, 20);
  assert.equal(game.position, 0);
  assert.equal(game.status, 'playing');
  const direct = startGame(createGame(), 0, () => .05, 'hard');
  for (let i = 0; i < 9; i++) moveGame(direct, 1, 10);
  assert.equal(direct.status, 'cleared');
});

test('both modes execute exactly 90 adjustments, resetting each cycle and reaching the correct floors', () => {
  for (const mode of ['normal', 'hard']) {
    const game = startGame(createGame(), 0, random, mode);
    for (let i = 0; i < 90; i++) {
      assert.equal(game.round, Math.floor(i / 30));
      assert.equal(game.stage, Math.floor(i / 10) % 3);
      assert.equal(game.phase, i % 10 + 1);
      const factor = mode === 'hard' ? 0.75 : 1;
      if (game.phase === 1) assert.equal(game.budget, 12 * factor);
      if (game.phase === 10) assert.equal(game.budget, Math.max(phaseBudget(game.round, 10, mode, game.stage), game.optimalSteps / 9 + .75));
      solve(game, 1 + i * 2);
      advanceGame(game, 2 + i * 2, random);
    }
    assert.equal(game.status, 'won');
    assert.equal(game.completed, 90);
  }
});

test('expiry uses real elapsed time, blocks late wins and preserves completed count', () => {
  const game = startGame(createGame(), 0, random);
  assert.equal(moveGame(game, -1, 15_001), false);
  assert.equal(game.status, 'lost');
  assert.equal(game.remaining, 0);
  assert.equal(game.completed, 0);
});

test('pausing preserves the remaining time, signed hard progress and cycle break state', () => {
  const game = startGame(createGame(), 0, random, 'hard');
  moveGame(game, game.requiredDirection, 1000);
  const progress = game.hardProgress;
  pauseGame(game, 3000);
  assert.equal(game.remaining, 6);
  tickGame(game, 100_000);
  resumeGame(game, 100_000);
  assert.equal(game.hardProgress, progress);
  tickGame(game, 102_000);
  assert.equal(game.remaining, 4);
  game.status = 'break';
  game.remaining = 12;
  pauseGame(game, 103_000);
  resumeGame(game, 200_000);
  assert.equal(game.status, 'break');
  assert.equal(game.remaining, 12);
});

test('time limits decrease monotonically and hard mode always has twenty-five percent less time', () => {
  for (let round = 0; round < 3; round++) {
    let previous = 15;
    for (let phase = 1; phase <= 10; phase++) {
      const normal = phaseBudget(round, phase);
      assert.ok(normal <= previous);
      assert.ok(Math.abs(phaseBudget(round, phase, 'hard') - normal * 0.75) < 1e-9);
      previous = normal;
    }
  }
});

 test('every new target departs twelve along the shortest arc, preserving either solved revolution', () => {
  for (const stage of [0, 1, 2]) {
    const count = positions(stage);
    for (const base of [-720, 0, 720]) {
      for (let target = 1; target < count; target++) {
        const game = Object.assign(createGame(), { stage, status: 'cleared', rotation: base });
        advanceGame(game, 0, () => rollFor(stage, target));
        assert.equal(game.position, target);
        const delta = game.rotation - base;
        assert.ok(Math.abs(delta) <= 180);
        assert.equal(Math.sign(delta), target > count / 2 ? -1 : 1);
      }
    }
  }
});

test('seconds take ten taps between dial marks, exactly double minutes', () => {
  for (const [stage, steps] of [[1, 5], [2, 10]]) {
    const count = positions(stage);
    const game = Object.assign(createGame(), { stage, status: 'cleared' });
    advanceGame(game, 0, () => rollFor(stage, count - steps));
    assert.equal(game.position, count - steps);
    for (let tap = 1; tap < steps; tap++) {
      moveGame(game, 1, tap);
      assert.equal(game.status, 'playing');
    }
    moveGame(game, 1, steps);
    assert.equal(game.status, 'cleared');
  }
});

test('near-twelve targets are exceptional in every cycle and route', () => {
  for (const stage of [0, 1, 2]) for (const mode of ['normal', 'hard']) {
    const count = positions(stage);
    let near = 0;
    for (let i = 0; i < 10000; i++) {
      const target = randomPosition(stage, mode, () => (i + .5) / 10000);
      if (Math.min(target, count - target) <= count / 6) near++;
    }
    assert.ok(near > 100 && near < 300, `${stage}/${mode}: ${near / 100}% near twelve`);
  }
});
