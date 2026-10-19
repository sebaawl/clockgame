import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAdjustment } from '../src/scoring.js';

const perfect = { remaining: 10, budget: 10, optimalSteps: 2, taps: 2, stage: 0, round: 0, streak: 1 };

test('a fast and exact first solve earns 3 base, 4 speed and 1 precision', () => {
  assert.equal(scoreAdjustment(perfect), 8);
});

test('wasted taps and slower solves can only reduce the same solve reward', () => {
  const base = scoreAdjustment(perfect);
  assert.ok(scoreAdjustment({ ...perfect, taps: 10 }) < base);
  assert.ok(scoreAdjustment({ ...perfect, remaining: 2 }) < base);
  assert.ok(scoreAdjustment({ ...perfect, taps: 10, remaining: 2 }) < scoreAdjustment({ ...perfect, remaining: 2 }));
});

test('harder cycles and phases reward more points and the streak caps at twenty percent', () => {
  assert.ok(scoreAdjustment({ ...perfect, stage: 2, round: 2 }) > scoreAdjustment(perfect));
  assert.equal(scoreAdjustment({ ...perfect, streak: 2 }), 8);
  assert.equal(scoreAdjustment({ ...perfect, streak: 11 }), 10);
  assert.equal(scoreAdjustment({ ...perfect, streak: 100 }), 10);
});

test('invalid attempts never earn points and clock rounding cannot exceed speed bonus', () => {
  assert.equal(scoreAdjustment({ ...perfect, taps: 0 }), 0);
  assert.equal(scoreAdjustment({ ...perfect, budget: 0 }), 0);
  assert.equal(scoreAdjustment({ ...perfect, remaining: 100 }), 8);
  assert.equal(scoreAdjustment({ ...perfect, remaining: -1 }), 4);
});

test('a completed hard route earns a fifty-percent difficulty premium', () => {
  assert.equal(scoreAdjustment({ ...perfect, mode: 'hard' }), 12);
});

test('one thousand points requires more than eighty perfect normal solves', () => {
  let total = 0;
  for (let i = 0; i < 80; i++) total += scoreAdjustment({ ...perfect, stage: Math.floor(i / 10) % 3, round: Math.floor(i / 30), streak: i + 1 });
  assert.ok(total < 1000);
  total += scoreAdjustment({ ...perfect, stage: 2, round: 2, streak: 81 });
  assert.ok(total >= 1000);
});
