import { tickRhythm, pulseRhythm } from './rhythm.js';
import { prepareChallenge, tickChallenge, retryExact } from './survival.js';
export const STAGES = ['horas', 'minutos', 'segundos'];
export const FLOORS = [7, 5, 3];
export const PHASES = [12, 6, 4];
export const CYCLE_PHASES = PHASES.reduce((sum, n) => sum + n, 0);
export const TOTAL_PHASES = CYCLE_PHASES * FLOORS.length;
export const HARD_TIME_FACTOR = 0.75;
export const NITRO_INITIAL = 40;
export const NITRO_DRAIN = 32;
export const DIFFICULTIES = { easy: { name: 'Fácil', time: 1, recharge: 1 }, medium: { name: 'Media', time: .82, recharge: .75 }, hard: { name: 'Difícil', time: .65, recharge: .5 } };
export const hasBoost = (game, id) => game.boosts?.includes(id) || game.boost === id;
export const nitroDrain = game => NITRO_DRAIN * (hasBoost(game, 'efficient') ? .75 : 1);
export const nitroCapacity = game => hasBoost(game, 'tank') ? 200 : 100;
export const SURVIVAL_CAP = 17;
export const FORMATS = ['classic', 'survival', 'duel', 'rhythm'];
export const continuousTime = game => game.format === 'survival' || game.format === 'duel';
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const positions = stage => [12, 60, 120][stage];
export const phaseBudget = (round, phase, mode = 'normal', stage = 0, difficulty = 'easy') => {
  const floor = [[6, 4, 2.5], [7, 5.5, 4.5], [9, 7, 5.5]][stage][clamp(round, 0, 2)];
  return (12 - (12 - floor) * (phase - 1) / (PHASES[stage] - 1)) * (mode === 'hard' ? HARD_TIME_FACTOR : 1) * (DIFFICULTIES[difficulty]?.time ?? 1);
};
export function createGame() {
  return {
    status: 'menu', difficulty: 'easy', boost: null, boosts: [], mode: 'normal', format: 'classic', round: 0, stage: 0, phase: 1,
    completed: 0, taps: 0, position: 0, rotation: 0, challenge: 'normal', targetClicks: 0, challengeDirection: 0, challengeRetries: 0, extraTurns: 0, driftInterval: 0, driftDirection: 0,
    rhythmHits: 0, rhythmMisses: 0, rhythmErrors: 0, rhythmScore: 0, rhythmTime: 0, rhythmNext: 0, rhythmPeriod: 1100, rhythmGrade: '', rhythmRemaining: 0,
    budget: 12, remaining: 12, deadline: 0, resumeStatus: null,
    requiredDirection: 0, requiredSteps: 0, hardProgress: 0,
    nitro: NITRO_INITIAL, combo: 0, hourPerfectStreak: 0, attemptSteps: 0, optimalSteps: 0,
    optimalDirection: 0, perfectRoute: true, perfect: false, perfectNitro: false, nitroLocked: false, lockUses: 3, lockCooldown: 0,
    lastNitroGain: 0, lastTimeGain: 0, solveRemaining: 12, solveBudget: 12,
  };
}
export function randomPosition(stage, mode = 'normal', random = Math.random) {
  const count = positions(stage);
  const choices = Array.from({ length: count - 1 }, (_, i) => i + 1)
    .filter(position => mode !== 'hard' || position !== count / 2);
  // Positions within the nearest sixth of the dial are rare (about 2%).
  // Every unsolved target remains possible, with no reroll loops.
  const weight = position => Math.min(position, count - position) <= count / 6 ? .035 : 1;
  const total = choices.reduce((sum, position) => sum + weight(position), 0);
  let cursor = clamp(random(), 0, 1) * total;
  for (const position of choices) {
    cursor -= weight(position);
    if (cursor < 0) return position;
  }
  return choices.at(-1);
}
function preparePhase(game, now, random) {
  const count = positions(game.stage);
  game.position = randomPosition(game.stage, game.mode, random);
  const twelve = Math.round(game.rotation / 360) * 360;
  const offset = game.position > count / 2 ? game.position - count : game.position;
  game.rotation = twelve + offset * 360 / count;
  game.requiredDirection = game.position < count / 2 ? 1 : -1;
  game.requiredSteps = game.requiredDirection === 1 ? count - game.position : game.position;
  game.optimalSteps = game.mode === 'hard' ? game.requiredSteps : Math.min(game.position, count - game.position);
  game.optimalDirection = game.mode === 'hard' ? game.requiredDirection : game.position === count / 2 ? 0 : game.position < count / 2 ? -1 : 1;
  game.attemptSteps = 0;
  game.perfectRoute = true;
  game.perfect = game.perfectNitro = game.nitroLocked = false;
  game.lastTimeGain = game.lastNitroGain = 0;
  game.hardProgress = 0;
  prepareChallenge(game, now, count, random);
  if (game.format === 'classic') {
    // Nine deliberate taps per second remains a viable route without spending Nitro.
    game.budget = Math.max(phaseBudget(game.round, game.phase, game.mode, game.stage, game.difficulty), (game.optimalSteps / 9 + .75) * DIFFICULTIES[game.difficulty].time) + (hasBoost(game, 'time') ? 1.5 : 0);
    game.remaining = game.budget;
  } else game.budget = game.remaining;
  game.deadline = now + game.remaining * 1000;
  game.status = 'playing';
  return game;
}
export function startGame(game, now, random = Math.random, mode = 'normal', format = 'classic', options = {}) {
  Object.assign(game, createGame(), { mode: mode === 'hard' ? 'hard' : 'normal', format: FORMATS.includes(format) ? format : 'classic' });
  game.difficulty = Object.hasOwn(DIFFICULTIES, options.difficulty) ? options.difficulty : 'easy';
  game.boosts = [...new Set(options.boosts?.length ? options.boosts : [options.boost])].filter(id => ['speed', 'tank', 'time', 'recharge', 'lock', 'efficient', 'precision', 'compass'].includes(id)).slice(0, 3);
  game.boost = game.boosts[0] || null;
  if (continuousTime(game)) game.remaining = 14 * DIFFICULTIES[game.difficulty].time + (hasBoost(game, 'time') ? 1.5 : 0);
  return preparePhase(game, now, random);
}
// Presentation and control guides do not advance autonomous clocks or beats.
export function beginPlay(game, now) {
  game.status = 'playing';
  game.deadline = now + game.remaining * 1000;
  if (game.driftInterval) {
    game.driftNext = now + game.driftInterval;
    game.flipNext = game.challenge === 'chaos' ? now + game.flipInterval : Infinity;
  }
  if (game.challenge === 'rhythm') game.rhythmNext = now + game.rhythmPeriod;
  return game;
}
export function tickGame(game, now) {
  if (game.status !== 'playing' && !(continuousTime(game) && game.status === 'cleared')) return game;
  if (game.challenge === 'rhythm' && game.status === 'playing') { tickRhythm(game, now); return game; }
  if (game.format === 'rhythm') return game;
  game.remaining = Math.max(0, (game.deadline - now) / 1000);
  if (game.remaining === 0) { game.status = 'lost'; game.combo = 0; }
  else tickChallenge(game, now, positions(game.stage));
  return game;
}
export function settleGame(game, now, { perfectNitro = false, nitroLock = false } = {}) {
  if (game.status !== 'playing') return false;
  tickGame(game, now);
  const rhythm = game.challenge === 'rhythm';
  if (game.status !== 'playing' || (rhythm && game.rhythmHits !== 4) || game.position !== 0 || game.attemptSteps === 0
      || (game.challenge === 'exact' && game.attemptSteps !== game.targetClicks)
      || (!rhythm && game.mode === 'hard' && game.hardProgress < game.requiredSteps)) return false;
  game.solveBudget = game.budget;
  game.solveRemaining = game.remaining;
  game.perfect = game.perfectRoute && (rhythm || game.attemptSteps === game.optimalSteps);
  game.nitroLocked = nitroLock && hasBoost(game, 'lock') && game.lockUses > 0;
  game.perfectNitro = perfectNitro && !game.nitroLocked;
  if (hasBoost(game, 'lock')) {
    if (game.nitroLocked) {
      game.lockUses -= 1;
      if (game.lockUses === 0) game.lockCooldown = 3;
    } else if (game.lockCooldown > 0) {
      game.lockCooldown -= 1;
      if (game.lockCooldown === 0) game.lockUses = 3;
    }
  }
  game.combo += 1;
  const milestone = game.combo % 10 === 0 ? 6 : game.combo % 5 === 0 ? 4 : 0;
  game.lastNitroGain = 2 + (game.perfect ? 3 + (hasBoost(game, 'precision') ? 3 : 0) : 0) + milestone + (game.perfectNitro ? 3 : 0);
  game.lastNitroGain *= DIFFICULTIES[game.difficulty].recharge * (hasBoost(game, 'recharge') ? 2 : 1);
  const previousNitro = game.nitro;
  if (game.stage === 0) {
    game.hourPerfectStreak = game.perfect ? game.hourPerfectStreak + 1 : 0;
    // Unlock six percentage points per consecutive perfect hour, without deleting earned charge.
    const ceiling = Math.max(previousNitro, Math.min(100, NITRO_INITIAL + 6 * game.hourPerfectStreak * (hasBoost(game, 'recharge') ? 2 : 1)));
    game.nitro = clamp(previousNitro + game.lastNitroGain, 0, ceiling);
  } else game.nitro = clamp(previousNitro + game.lastNitroGain, 0, nitroCapacity(game));
  game.lastNitroGain = game.nitro - previousNitro;
  game.completed += 1;
  if (continuousTime(game)) {
    const gain = rhythm ? game.rhythmTime : (Math.max(.7, 1.6 - game.completed * .008) + (game.perfect ? .3 : 0) + (game.challenge === 'exact' ? 1.25 * game.extraTurns : game.driftInterval ? .45 : 0)) * DIFFICULTIES[game.difficulty].time;
    game.lastTimeGain = Math.min(gain, SURVIVAL_CAP - game.remaining);
    game.remaining += game.lastTimeGain;
    game.deadline = now + game.remaining * 1000;
  }
  game.status = 'cleared';
  return true;
}
export function moveGame(game, direction, now, { deferSolve = false } = {}) {
  if (game.status !== 'playing' || ![-1, 1].includes(direction)) return false;
  tickGame(game, now);
  if (game.status !== 'playing') return false;
  const count = positions(game.stage);
  if (game.challenge === 'rhythm') {
    game.taps++;
    game.attemptSteps++;
    if (pulseRhythm(game, now)) {
      game.rotation += 90;
      game.position = (game.rhythmHits % 4) * count / 4;
      settleGame(game, now);
    }
    return true;
  }
  if (!game.optimalDirection) game.optimalDirection = direction;
  if (direction !== game.optimalDirection || (game.position === 0 && game.challenge !== 'exact') || game.attemptSteps >= game.optimalSteps) {
    game.perfectRoute = false;
    game.hourPerfectStreak = 0;
    game.combo = 0;
  }
  game.position = (game.position + direction + count) % count;
  game.rotation += direction * 360 / count;
  game.taps += 1;
  game.attemptSteps += 1;
  game.hardProgress += direction * game.requiredDirection;
  retryExact(game, now, count);
  if (!deferSolve) settleGame(game, now);
  else if (hasBoost(game, 'lock') && game.lockUses > 0 && game.position === 0) settleGame(game, now, { nitroLock: true });
  return true;
}
export function consumeNitro(game, amount) {
  const spent = Math.min(game.nitro, Math.max(0, amount));
  game.nitro = Math.max(0, game.nitro - spent);
  return spent;
}
export function advanceGame(game, now, random = Math.random) {
  if (game.status !== 'cleared') return game;
  const previousStage = game.stage;
  if (game.format !== 'classic') {
    tickGame(game, now);
    if (game.status === 'lost') return game;
    const within = game.completed % CYCLE_PHASES;
    game.stage = within < PHASES[0] ? 0 : within < PHASES[0] + PHASES[1] ? 1 : 2;
    game.phase = within - PHASES.slice(0, game.stage).reduce((sum, n) => sum + n, 0) + 1;
    game.round = Math.floor(game.completed / CYCLE_PHASES);
  } else if (game.phase < PHASES[game.stage]) game.phase += 1;
  else if (game.stage < 2) { game.stage += 1; game.phase = 1; }
  else if (game.round < 2) { game.round += 1; game.stage = 0; game.phase = 1; }
  else { game.status = 'won'; return game; }
  if (game.stage !== previousStage) game.hourPerfectStreak = 0;
  return preparePhase(game, now, random);
}
export function pauseGame(game, now) {
  if (!['playing', 'cleared', 'break'].includes(game.status)) return game;
  tickGame(game, now);
  if (game.status === 'lost') return game;
  game.rhythmRemaining = game.rhythmNext - now;
  game.driftRemaining = Math.max(0, game.driftNext - now);
  game.flipRemaining = Math.max(0, game.flipNext - now);
  game.resumeStatus = game.status;
  game.status = 'paused';
  return game;
}
export function resumeGame(game, now) {
  if (game.status !== 'paused') return game;
  game.deadline = now + game.remaining * 1000;
  game.rhythmNext = now + game.rhythmRemaining;
  game.driftNext = now + game.driftRemaining;
  game.flipNext = now + game.flipRemaining;
  game.status = game.resumeStatus || 'playing';
  game.resumeStatus = null;
  return game;
}
