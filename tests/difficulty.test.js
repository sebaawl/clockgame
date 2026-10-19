import test from 'node:test';
import assert from 'node:assert/strict';
import { startGame, createGame, moveGame, advanceGame, consumeNitro, nitroCapacity } from '../src/game.js';
const near = () => .99;
const start = (difficulty = 'easy', boost = null, format = 'classic') => startGame(createGame(), 0, near, 'normal', format, { difficulty, boost });
function solve(g, now = 1) { for (let i = 0; i < g.optimalSteps; i++) moveGame(g, g.optimalDirection, now); }
test('easy retains current time and harder difficulties decrease time and earned Nitro', () => {
  const games = ['easy', 'medium', 'hard'].map(d => start(d));
  assert.equal(games[0].budget, 15);
  assert.ok(games[1].budget < games[0].budget && games[2].budget < games[1].budget);
  games.forEach(g => { g.nitro = 0; solve(g); });
  assert.deepEqual(games.map(g => g.nitro), [5, 3.75, 2.5]);
  for (const d of ['easy', 'medium', 'hard']) assert.equal(start(d, null, 'survival').remaining, start(d).budget);
});
test('boosts are isolated, persist through phases and double tank holds 200', () => {
  const g = start('medium', 'time');
  assert.equal(g.budget, start('medium').budget + 1.5);
  solve(g); advanceGame(g, 2, near); assert.equal(g.boost, 'time'); assert.equal(g.difficulty, 'medium');
  const tank = start('easy', 'tank');
  assert.equal(tank.nitro, 40); assert.equal(nitroCapacity(tank), 200);
  // Resolve in minutes to test the larger tank without the hours precision ceiling.
  while (tank.stage === 0) { solve(tank); advanceGame(tank, 2, near); }
  tank.nitro = 199; solve(tank, 3); assert.equal(tank.nitro, 200);
  consumeNitro(tank, 1000); assert.equal(tank.nitro, 0);
  assert.equal(nitroCapacity(start()), 100);
});
