import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, localDay, dailyGoals, recordSolve, claimGoal, exchangeCoins, buyItem, equipItem, refreshDaily, loadProgress, saveProgress, missionPeriod, nextMissionAt, boostLoadout, removeBoost, boostSlots } from '../src/progression.js';
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
test('mission progress refreshes across days while balances and unlocks survive', () => {
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

test('double slot is a permanent expensive purchase, permits two distinct boosts, and rejects a third', () => {
  const p = createProgress(today); p.owned.push('speed', 'lock', 'tank');
  equipItem(p, 'speed'); equipItem(p, 'lock');
  assert.deepEqual(p.boosts, ['lock']);
  p.coins = 599; assert.equal(buyItem(p, 'dual'), false);
  p.coins = 600; assert.equal(buyItem(p, 'dual'), true); assert.equal(p.coins, 0);
  assert.equal(equipItem(p, 'speed'), true); assert.deepEqual(p.boosts, ['lock', 'speed']);
  assert.equal(equipItem(p, 'tank'), false); assert.deepEqual(p.boosts, ['lock', 'speed']);
  assert.equal(equipItem(p, 'dual'), false);
  const storage = memory(); saveProgress(p, storage); assert.deepEqual(loadProgress(storage, today).boosts, ['lock', 'speed']);
  assert.equal(equipItem(p, 'lock'), true); assert.deepEqual(p.boosts, [null, 'speed']);
  equipItem(p, 'none'); assert.deepEqual(p.boosts, []);
});

test('clock sounds require ownership, default to felt and persist independently of boosts', () => {
  const state = createProgress(today), storage = memory();
  assert.equal(state.soundPreset, 'felt');
  assert.equal(equipItem(state, 'sound-wood'), false);
  state.coins = 50;
  assert.equal(buyItem(state, 'sound-wood'), true);
  assert.equal(state.coins, 0);
  assert.equal(equipItem(state, 'sound-wood'), true);
  assert.equal(state.soundPreset, 'wood');
  assert.deepEqual(state.boosts, []);
  saveProgress(state, storage);
  assert.equal(loadProgress(storage, today).soundPreset, 'wood');
  state.soundPreset = 'clock'; saveProgress(state, storage);
  assert.equal(loadProgress(storage, today).soundPreset, 'felt');
});

test('missions reset exactly every four hours, survive reload within a window, and preserve wallet and purchases', () => {
  const start = new Date('2026-10-19T12:00:00Z'), before = new Date('2026-10-19T15:59:59.999Z'), next = new Date('2026-10-19T16:00:00Z');
  const p = createProgress(start), storage = memory(); p.owned.push('dots'); p.coins = 50;
  recordSolve(p, { score: 1800, format: 'classic', perfect: true }, start);
  assert.equal(claimGoal(p, 'score', start), 600); saveProgress(p, storage);
  const restored = loadProgress(storage, before); assert.equal(restored.daily.best, 1800); assert.deepEqual(restored.daily.claimed, ['score']);
  assert.equal(nextMissionAt(before).getTime(), next.getTime());
  refreshDaily(restored, next); assert.equal(restored.daily.period, missionPeriod(next));
  assert.equal(restored.daily.best, 0); assert.deepEqual(restored.daily.claimed, []);
  assert.equal(restored.points, 600); assert.equal(restored.coins, 50); assert.ok(restored.owned.includes('dots'));
  assert.equal(claimGoal(restored, 'score', next), 0);
});
test('boost slots retain their positions and support explicit replacement, removal and swapping', () => {
  const p = createProgress(today), storage = memory(); p.owned.push('dual', 'speed', 'lock', 'tank');
  equipItem(p, 'speed', 0); equipItem(p, 'lock', 1);
  assert.equal(removeBoost(p, 'speed'), true); assert.deepEqual(boostLoadout(p), [null, 'lock']);
  saveProgress(p, storage); const loaded = loadProgress(storage, today); assert.deepEqual(boostLoadout(loaded), [null, 'lock']);
  equipItem(loaded, 'tank', 0); assert.deepEqual(boostLoadout(loaded), ['tank', 'lock']);
  equipItem(loaded, 'speed', 1); assert.deepEqual(boostLoadout(loaded), ['tank', 'speed']);
  equipItem(loaded, 'tank', 1); assert.deepEqual(boostLoadout(loaded), ['speed', 'tank']);
  assert.equal(equipItem(loaded, 'lock', 2), false);
});

test('triple upgrade includes all three slots, persists loadout and prevents a fourth boost', () => {
  const p = createProgress(today), storage = memory();
  p.coins = 1000;
  assert.equal(buyItem(p, 'triple'), true);
  assert.equal(p.coins, 0); assert.equal(boostSlots(p), 3);
  p.owned.push('compass', 'recharge', 'lock', 'speed');
  for (const id of ['compass', 'recharge', 'lock']) assert.equal(equipItem(p, id), true);
  assert.equal(equipItem(p, 'speed'), false);
  assert.equal(removeBoost(p, 'compass'), true);
  assert.deepEqual(boostLoadout(p), [null, 'recharge', 'lock']);
  assert.equal(equipItem(p, 'compass', 2), true);
  saveProgress(p, storage);
  const loaded = loadProgress(storage, today);
  assert.equal(boostSlots(loaded), 3);
  assert.deepEqual(boostLoadout(loaded), [null, 'recharge', 'compass']);
  assert.equal(loaded.owned.includes('dual'), false);
});
