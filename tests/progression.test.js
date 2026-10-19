import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, localDay, dailyGoals, recordSolve, claimGoal, exchangeCoins, buyItem, equipItem, refreshDaily, loadProgress, saveProgress } from '../src/progression.js';
const today = new Date(2026, 9, 19, 12);
const tomorrow = new Date(2026, 9, 20, 12);
const memory = () => { const entries = new Map(); return { getItem: k => entries.get(k), setItem: (k, v) => entries.set(k, v) }; };

test('goals grant only claimable rewards once; playing score is not spendable currency', () => {
  const p = createProgress(today);
  assert.equal(claimGoal(p, 'score', today), 0);
  recordSolve(p, { score: 1600, format: 'classic', perfect: true }, today);
  assert.equal(p.points, 0); assert.equal(p.daily.perfect, 1);
  assert.equal(claimGoal(p, 'score', today), 600);
  assert.equal(claimGoal(p, 'score', today), 0);
  assert.equal(p.points, 600); assert.equal(p.best, 1600);
});
test('daily progress resets at local midnight while balances and unlocks survive', () => {
  const p = createProgress(today);
  recordSolve(p, { score: 3500, format: 'survival', perfect: true }, today);
  claimGoal(p, 'score', today); buyItem(p, 'dots', 'score'); equipItem(p, 'dots');
  const before = dailyGoals(p, today);
  refreshDaily(p, tomorrow);
  assert.equal(p.daily.day, localDay(tomorrow)); assert.equal(p.daily.best, 0); assert.deepEqual(p.daily.claimed, []);
  assert.equal(p.points, 600); assert.equal(p.cosmetic, 'dots'); assert.equal(p.best, 3500);
  assert.notEqual(before[1].detail, dailyGoals(p, tomorrow)[1].detail);
});
test('coin exchange is atomic and cannot overspend, accept unknown packs or repeat a purchase', () => {
  const p = createProgress(today); p.points = 1200;
  assert.equal(exchangeCoins(p, 'unknown'), 0);
  assert.equal(exchangeCoins(p, 'large'), 90);
  assert.equal(exchangeCoins(p, 'large'), 0);
  assert.equal(p.points, 0); assert.equal(p.coins, 90);
  assert.equal(buyItem(p, 'dots'), true); assert.equal(p.coins, 30);
  assert.equal(buyItem(p, 'dots'), false); assert.equal(p.coins, 30);
  assert.equal(buyItem(p, 'rail'), false); assert.equal(p.coins, 30);
});
test('score unlocks require a high single-run best and never spend currency', () => {
  const p = createProgress(today);
  for (let i = 0; i < 10; i++) recordSolve(p, { score: 500, format: 'classic', perfect: true }, today);
  assert.equal(buyItem(p, 'dots', 'score'), false);
  p.best = 3500; p.coins = 20;
  assert.equal(buyItem(p, 'dots', 'score'), true); assert.equal(p.coins, 20);
  assert.equal(equipItem(p, 'dots'), true); assert.equal(equipItem(p, 'speed'), false);
  assert.equal(equipItem(p, 'none'), true);
});
test('persistence retains equipped purchases and rejects corrupt/negative balances', () => {
  const p = createProgress(today), storage = memory();
  p.best = 9000; buyItem(p, 'tank', 'score'); equipItem(p, 'tank');
  saveProgress(p, storage);
  assert.deepEqual(loadProgress(storage, today), p);
  p.points = -20; p.coins = Infinity; saveProgress(p, storage);
  const loaded = loadProgress(storage, today); assert.equal(loaded.points, 0); assert.equal(loaded.coins, 0);
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.deepEqual(loadProgress(blocked, today), createProgress(today)); assert.equal(saveProgress(p, blocked), false);
});
