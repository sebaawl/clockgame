import test from 'node:test';
import assert from 'node:assert/strict';
import { createNitroControl } from '../src/nitro.js';
import { createGame, startGame, moveGame, settleGame, advanceGame, consumeNitro, pauseGame, resumeGame, tickGame } from '../src/game.js';

function harness(initial = 100, velocity = 42) {
  let time = 0, charge = initial, steps = 0, taps = 0, active = false, playing = true, release = null, serial = 0;
  const jobs = new Map();
  const control = createNitroControl({
    now: () => time, schedule: (fn, delay) => { const id = ++serial; jobs.set(id, { at: time + delay, fn }); return id; }, unschedule: id => jobs.delete(id),
    canPlay: () => playing, charge: () => charge, spend: amount => { charge = Math.max(0, charge - amount); }, speed: () => velocity,
    step: () => steps++, shortTap: () => taps++, released: exact => { release = exact; }, activeChanged: value => { active = value; },
  });
  function advance(ms) {
    const end = time + ms;
    while (true) {
      const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      time = next[1].at; jobs.delete(next[0]); next[1].fn();
    }
    time = end;
  }
  return { control, advance, state: () => ({ time, charge, steps, taps, active, release }), setPlaying: v => { playing = v; } };
}

test('249 ms is one tap; 250 ms activates without a duplicate initial move', () => {
  const h = harness();
  h.control.press(1, 1); h.advance(249); h.control.release(1);
  assert.deepEqual([h.state().taps, h.state().steps, h.state().charge], [1, 0, 100]);
  h.control.press(1, 2); h.advance(249); assert.equal(h.state().active, false);
  h.advance(1); assert.equal(h.state().active, true); assert.equal(h.state().steps, 0);
  h.advance(100); assert.ok(h.state().steps > 0); h.control.release(2);
  assert.equal(h.state().taps, 1); assert.equal(h.state().release, true);
});

test('Nitro drains 40 percent per second and stops moving on release', () => {
  const h = harness(); h.control.press(1, 1); h.advance(1250); h.control.release(1);
  assert.ok(Math.abs(h.state().charge - 60) < 1e-8);
  const steps = h.state().steps; h.advance(1000);
  assert.equal(h.state().steps, steps); assert.equal(h.state().active, false);
});

test('100 percent lasts 2.5 seconds and an empty long hold only produces one normal tap', () => {
  const h = harness(); h.control.press(1, 1); h.advance(2800);
  assert.equal(h.state().charge, 0); assert.equal(h.state().active, false);
  const steps = h.state().steps; h.advance(1000); assert.equal(h.state().steps, steps);
  h.control.release(1); assert.equal(h.state().release, false);
  h.control.press(-1, 2); h.advance(1000); h.control.release(2);
  assert.equal(h.state().steps, steps); assert.equal(h.state().taps, 1);
});

test('a second pointer cannot steal a hold and cancellation never triggers a tap or solve', () => {
  const h = harness(); assert.equal(h.control.press(1, 1), true); assert.equal(h.control.press(-1, 2), false);
  h.advance(400); h.control.release(2); assert.equal(h.state().active, true);
  h.control.release(1, true); const steps = h.state().steps; h.advance(1000);
  assert.equal(h.state().steps, steps); assert.equal(h.state().taps, 0); assert.equal(h.state().release, null);
});

test('paused play cannot start or continue a hold', () => {
  const h = harness(); h.control.press(1, 1); h.advance(400); h.setPlaying(false); h.advance(8);
  assert.equal(h.state().active, false); assert.equal(h.control.press(1, 2), false);
  h.control.release(1); assert.equal(h.state().release, null);
});

const atEleven = () => .99;
function solve(game, now, accelerated = false) {
  const direction = game.mode === 'hard' ? game.requiredDirection : game.optimalDirection || 1;
  const steps = game.optimalSteps;
  for (let i = 0; i < steps; i++) moveGame(game, direction, now, { deferSolve: accelerated });
}

test('Nitro crosses twelve without solving; overshoot breaks precision and combo', () => {
  const game = startGame(createGame(), 0, atEleven);
  game.combo = 4;
  moveGame(game, 1, 300, { deferSolve: true });
  assert.equal(game.position, 0); assert.equal(game.status, 'playing'); assert.equal(game.completed, 0);
  moveGame(game, 1, 350, { deferSolve: true });
  assert.equal(game.position, 1); assert.equal(game.combo, 0); assert.equal(game.perfectRoute, false);
  moveGame(game, -1, 400);
  assert.equal(game.status, 'cleared'); assert.equal(game.perfect, false); assert.equal(game.lastNitroGain, 4);
});

test('release at twelve grants path-perfect and Perfect Nitro bonuses without penalizing acceleration', () => {
  const game = startGame(createGame(), 0, atEleven);
  consumeNitro(game, 10); solve(game, 400, true);
  assert.equal(game.status, 'playing');
  assert.equal(settleGame(game, 400, { perfectNitro: true }), true);
  assert.equal(game.perfect, true); assert.equal(game.perfectNitro, true);
  assert.equal(game.lastNitroGain, 13); assert.equal(game.nitro, 43);
  assert.equal(settleGame(game, 401, { perfectNitro: true }), false);
  assert.equal(game.nitro, 43);
});

test('recharge only happens on clears and five/ten milestones do not double count', () => {
  const game = startGame(createGame(), 0, atEleven);
  game.nitro = 0;
  tickGame(game, 1000); assert.equal(game.nitro, 0);
  for (let i = 1; i <= 10; i++) {
    solve(game, 1000 + i);
    assert.equal(game.lastNitroGain, i === 5 ? 14 : i === 10 ? 18 : 8);
    if (i < 10) advanceGame(game, 1000 + i, atEleven);
  }
  assert.equal(game.combo, 10); assert.equal(game.nitro, 96);
});

test('hard-mode shortcut still fails during Nitro and late releases never win', () => {
  const game = startGame(createGame(), 0, () => .21, 'hard');
  for (let i = 0; i < 3; i++) moveGame(game, -1, 100, { deferSolve: true });
  assert.equal(settleGame(game, 100, { perfectNitro: true }), false);
  const late = startGame(createGame(), 0, atEleven);
  solve(late, 100, true);
  assert.equal(settleGame(late, 16000, { perfectNitro: true }), false);
  assert.equal(late.status, 'lost'); assert.equal(late.completed, 0);
});

test('survival keeps one clock, adds bounded time and charges time during celebrations', () => {
  const game = startGame(createGame(), 0, atEleven, 'normal', 'survival');
  solve(game, 1000);
  assert.equal(game.solveRemaining, 14); assert.ok(game.remaining > 17);
  const afterClear = game.remaining;
  advanceGame(game, 2000, atEleven);
  assert.ok(Math.abs(game.remaining - (afterClear - 1)) < 1e-9);
  assert.equal(game.budget, game.remaining);
  game.remaining = 24.9; game.deadline = 26900;
  solve(game, 2000); assert.equal(game.remaining, 25);
});

test('survival continues beyond 90 and pause preserves its single timer', () => {
  const game = startGame(createGame(), 0, atEleven, 'normal', 'survival');
  for (let i = 0; i < 100; i++) { solve(game, i); advanceGame(game, i, atEleven); }
  assert.equal(game.status, 'playing'); assert.equal(game.completed, 100);
  pauseGame(game, 200); const remaining = game.remaining;
  tickGame(game, 99999); assert.equal(game.remaining, remaining);
  resumeGame(game, 100000); tickGame(game, 101000); assert.ok(Math.abs(game.remaining - (remaining - 1)) < 1e-9);
});

test('advanced classic clocks remain possible without Nitro at nine manual taps per second', () => {
  for (const mode of ['normal', 'hard']) {
    const game = startGame(createGame(), 0, atEleven, mode);
    for (let i = 0; i < 90; i++) {
      assert.ok(game.budget >= game.optimalSteps / 9 + .75 - 1e-9);
      solve(game, i); advanceGame(game, i, () => i % 2 ? .01 : .99);
    }
    assert.equal(game.status, 'won');
  }
});

test('a throttled tab cannot replay a delayed burst or award a canceled release', () => {
  let time = 0, stepCount = 0, charge = 40, latest;
  const control = createNitroControl({
    now: () => time, schedule: fn => { latest = fn; return 1; }, unschedule: () => {},
    canPlay: () => true, charge: () => charge, spend: amount => { charge -= amount; }, speed: () => 42,
    step: () => stepCount++, shortTap: () => { throw new Error('unexpected tap'); },
    released: () => { throw new Error('unexpected solve'); }, activeChanged: () => {},
  });
  control.press(1, 1); time = 250; latest();
  time = 5250; latest();
  assert.equal(control.holding, false); assert.equal(stepCount, 0); assert.equal(charge, 40);
  control.release(1);
});
