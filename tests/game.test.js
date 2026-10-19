import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, moveGame, tickGame, advanceGame, pauseGame, resumeGame, retryPhase, phaseBudget, positions } from '../src/game.js';

const random = () => 0.4;
function solve(game, now) {
  const count = positions(game.stage);
  const direction = game.position <= count / 2 ? -1 : 1;
  for (let guard = 0; game.status === 'playing' && guard < count; guard++) moveGame(game, direction, now);
  assert.equal(game.status, 'cleared');
}

test('introduction gives 10 seconds, then the first real phase resets to 15', () => {
  const game = startGame(createGame(), 100, random);
  assert.equal(game.remaining, 10);
  assert.notEqual(game.position, 0);
  solve(game, 200);
  assert.equal(game.completed, 0);
  advanceGame(game, 1000, random);
  assert.equal(game.tutorial, false);
  assert.equal(game.remaining, 15);
  assert.equal(game.phase, 1);
});

test('both directions wrap around 12 and 60 positions and stop accepting taps after a solve', () => {
  for (const stage of [0, 1, 2]) {
    for (const direction of [-1, 1]) {
      const game = startGame(createGame(), 0, random);
      game.stage = stage;
      game.position = direction === 1 ? positions(stage) - 1 : 1;
      assert.equal(moveGame(game, direction, 10), true);
      assert.equal(game.position, 0);
      assert.equal(moveGame(game, direction, 20), false);
    }
  }
});

test('all 270 phases execute in order, reset each stage, and finish at the exact round floors', () => {
  const game = startGame(createGame(), 0, random);
  solve(game, 1);
  advanceGame(game, 2, random);
  for (let i = 0; i < 270; i++) {
    assert.equal(game.round, Math.floor(i / 90));
    assert.equal(game.stage, Math.floor(i / 30) % 3);
    assert.equal(game.phase, i % 30 + 1);
    if (game.phase === 1) assert.equal(game.budget, 15);
    if (game.phase === 30) assert.equal(game.budget, [7, 5, 3][game.round]);
    solve(game, 3 + i * 2);
    advanceGame(game, 4 + i * 2, random);
  }
  assert.equal(game.status, 'won');
  assert.equal(game.completed, 270);
});

test('expiry uses elapsed time and prevents a late tap from winning', () => {
  const game = startGame(createGame(), 0, random);
  game.position = 1;
  assert.equal(moveGame(game, -1, 10_001), false);
  assert.equal(game.status, 'lost');
  assert.equal(game.completed, 0);
  retryPhase(game, 20_000, random);
  assert.equal(game.status, 'playing');
  assert.equal(game.deadline, 30_000);
});

test('pause preserves time and can also pause the transition between phases', () => {
  const game = startGame(createGame(), 0, random);
  pauseGame(game, 3000);
  tickGame(game, 100_000);
  assert.equal(game.remaining, 7);
  resumeGame(game, 100_000);
  tickGame(game, 102_000);
  assert.equal(game.remaining, 5);
  solve(game, 102_010);
  pauseGame(game, 102_020);
  assert.equal(game.status, 'paused');
  resumeGame(game, 103_000);
  assert.equal(game.status, 'cleared');
});

test('budgets decrease monotonically and generated positions are always unsolved', () => {
  for (let round = 0; round < 3; round++) {
    let previous = 15;
    for (let phase = 1; phase <= 30; phase++) {
      const budget = phaseBudget(round, phase);
      assert.ok(budget <= previous);
      previous = budget;
    }
  }
  for (const seed of [0, 0.1, 0.5, 0.999999]) {
    const game = startGame(createGame(), 0, () => seed);
    assert.notEqual(game.position, 0);
  }
});
