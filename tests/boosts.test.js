import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, moveGame, advanceGame, settleGame, pauseGame, resumeGame, nitroDrain } from '../src/game.js';
const near = () => .9999;
const start = (boost, mode = 'normal', difficulty = 'easy') => startGame(createGame(), 0, near, mode, 'classic', { boost, difficulty });
function solve(g, accelerated = false) {
  const count = g.optimalSteps, direction = g.optimalDirection;
  for (let i = 0; i < count; i++) moveGame(g, direction, 1, { deferSolve: accelerated });
}

test('double recharge doubles gains in every difficulty, including the hours precision ceiling', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = start(null, 'normal', difficulty), fast = start('recharge', 'normal', difficulty);
    solve(base); solve(fast);
    assert.equal(fast.lastNitroGain, base.lastNitroGain * 2);
  }
  const fast = start('recharge');
  for (let i = 0; i < 6; i++) { solve(fast); if (i < 5) advanceGame(fast, 1, near); }
  assert.equal(fast.nitro, 100);
});
test('Lock stops at twelve three times, waits for three other solves, then reloads', () => {
  const g = start('lock');
  for (let i = 0; i < 3; i++) {
    solve(g, true);
    assert.equal(g.status, 'cleared'); assert.equal(g.position, 0); assert.equal(g.nitroLocked, true);
    assert.equal(g.perfectNitro, false); assert.equal(g.perfect, true);
    assert.equal(g.lockUses, 2 - i); assert.equal(g.lockCooldown, i === 2 ? 3 : 0);
    advanceGame(g, 1, near);
  }
  for (let i = 0; i < 3; i++) {
    solve(g, true);
    assert.equal(g.status, 'playing'); assert.equal(g.nitroLocked, false);
    settleGame(g, 1, { perfectNitro: true });
    assert.equal(g.lockCooldown, 2 - i); assert.equal(g.lockUses, i === 2 ? 3 : 0);
    advanceGame(g, 1, near);
  }
  solve(g, true); assert.equal(g.nitroLocked, true); assert.equal(g.combo, 7);
});
test('manual solves do not spend Lock uses and pause/time never refill the cooldown', () => {
  const g = start('lock'); solve(g); assert.equal(g.lockUses, 3); advanceGame(g, 1, near);
  for (let i = 0; i < 3; i++) { solve(g, true); advanceGame(g, 1, near); }
  pauseGame(g, 2); resumeGame(g, 100000);
  assert.equal(g.lockCooldown, 3); assert.equal(g.lockUses, 0);
});
test('Lock does not validate the counterintuitive shortcut; no boost still passes twelve freely', () => {
  const hard = startGame(createGame(), 0, () => .05, 'hard', 'classic', { boost: 'lock' });
  for (let i = 0; i < 3; i++) moveGame(hard, -1, 1, { deferSolve: true });
  assert.equal(hard.position, 0); assert.equal(hard.status, 'playing'); assert.equal(hard.lockUses, 3);
  const plain = start(null); solve(plain, true);
  assert.equal(plain.status, 'playing'); moveGame(plain, 1, 1, { deferSolve: true });
  assert.equal(plain.position, 1); assert.equal(plain.combo, 0);
});

test('paired boosts apply together and survive cycle changes without duplication', () => {
  const g = startGame(createGame(), 0, near, 'normal', 'classic', { boosts: ['recharge', 'lock', 'time', 'precision'] });
  assert.deepEqual(g.boosts, ['recharge', 'lock', 'time']);
  solve(g, true); assert.equal(g.nitroLocked, true); assert.equal(g.nitro, 50); assert.equal(g.lockUses, 2);
  advanceGame(g, 1, near); assert.deepEqual(g.boosts, ['recharge', 'lock', 'time']);
  const tank = startGame(createGame(), 0, near, 'normal', 'survival', { boosts: ['tank', 'time', 'tank'] });
  assert.deepEqual(tank.boosts, ['tank', 'time']); assert.equal(tank.remaining, 15.5);
});

test('new boosts preserve hours precision limits and reward only perfect routes', () => {
  const efficient = start('efficient'); assert.equal(nitroDrain(efficient), 24);
  assert.equal(nitroDrain(start(null)), 32);
  const plain = start(null), precision = start('precision'); solve(plain); solve(precision);
  assert.ok(precision.nitro > plain.nitro); assert.ok(precision.nitro <= 46);
  const later = start('precision'); later.phase = 12; later.status = 'cleared'; advanceGame(later, 1, near); later.nitro = 0; later.perfectRoute = false; solve(later);
  assert.equal(later.lastNitroGain, 2);
  const perfect = start('precision'); perfect.phase = 12; perfect.status = 'cleared'; advanceGame(perfect, 1, near); perfect.nitro = 0; solve(perfect);
  assert.equal(perfect.lastNitroGain, 8);
});
