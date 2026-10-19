import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAdjustment, classifyAdjustment } from '../src/scoring.js';

const perfect = { remaining: 15, budget: 15, optimalSteps: 5, taps: 5, stage: 0, round: 0, streak: 1 };
const scoreAt = (elapsed, extra = {}) => scoreAdjustment({ ...perfect, remaining: 15 - elapsed, ...extra });

test('absolute elapsed seconds classify every inclusive tier boundary', () => {
  for (const [elapsed, expected] of [[0, 'excelente'], [1, 'excelente'], [1.001, 'bien'], [2, 'bien'], [2.001, 'insuficiente'], [3, 'insuficiente'], [3.001, 'malo'], [10, 'malo']]) {
    assert.equal(classifyAdjustment(elapsed), expected);
  }
});

test('one-second solves clearly outscore two, three and slower solves', () => {
  assert.equal(scoreAt(0), 22);
  assert.equal(scoreAt(1), 20);
  assert.equal(scoreAt(2), 10);
  assert.equal(scoreAt(3), 4);
  assert.equal(scoreAt(3.001), 2);
  assert.equal(scoreAt(5.001), 1);
});

test('slow solves remain tiny regardless of difficulty, streak, precision or mode', () => {
  for (const mode of ['normal', 'hard']) {
    assert.equal(scoreAt(3.5, { stage: 2, round: 2, streak: 100, mode }), 2);
    assert.equal(scoreAt(7, { stage: 2, round: 2, streak: 100, mode }), 1);
  }
});

test('score never rises with elapsed time and extra taps never increase rewards', () => {
  for (const mode of ['normal', 'hard']) {
    let previous = Infinity;
    for (let i = 0; i < 1500; i++) {
      const score = scoreAt(i / 100, { mode, stage: 2, round: 2, streak: 10 });
      assert.ok(score <= previous);
      assert.ok(scoreAt(i / 100, { taps: 20, mode, stage: 2, round: 2, streak: 10 }) <= score);
      previous = score;
    }
  }
});

test('time grades use seconds rather than the percentage of the budget', () => {
  assert.equal(scoreAt(1), scoreAdjustment({ ...perfect, budget: 3, remaining: 2 }));
  assert.equal(scoreAt(2.5), scoreAdjustment({ ...perfect, budget: 3, remaining: .5 }));
});

test('hard route keeps its premium and streak multipliers have a small fixed cap', () => {
  assert.equal(scoreAt(0, { mode: 'hard' }), 33);
  assert.equal(scoreAt(0, { streak: 11 }), 24);
  assert.equal(scoreAt(0, { streak: 100 }), 24);
});

test('zero-time and invalid attempts never earn points', () => {
  for (const extra of [{ taps: 0 }, { budget: 0 }, { remaining: 0 }, { remaining: -1 }, { remaining: NaN }, { taps: Infinity }]) {
    assert.equal(scoreAdjustment({ ...perfect, ...extra }), 0);
  }
});

test('a thousand requires a substantial run of fast solves, but fewer than before', () => {
  function reach(elapsed) {
    let total = 0;
    for (let i = 0; i < 90; i++) {
      total += scoreAt(elapsed, { stage: Math.floor(i / 10) % 3, round: Math.floor(i / 30), streak: i + 1 });
      if (total >= 1000) return i + 1;
    }
    return Infinity;
  }
  assert.ok(reach(1) >= 35 && reach(1) <= 50);
  assert.ok(reach(1.5) >= 50 && reach(1.5) <= 75);
  assert.equal(reach(3.5), Infinity);
});
