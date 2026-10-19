export const STAGES = ['horas', 'minutos', 'segundos'];
export const FLOORS = [7, 5, 3];
export const PHASES = 10;
export const TOTAL_PHASES = PHASES * STAGES.length * FLOORS.length;
export const HARD_TIME_FACTOR = 0.8;
export const NITRO_INITIAL = 40;
export const NITRO_DRAIN = 32;
export const DIFFICULTIES = { easy: { name: 'Fácil', time: 1, recharge: 1 }, medium: { name: 'Media', time: .82, recharge: .75 }, hard: { name: 'Difícil', time: .65, recharge: .5 } };
export const hasBoost = (game, id) => game.boosts?.includes(id) || game.boost === id;
export const nitroDrain = game => NITRO_DRAIN * (hasBoost(game, 'efficient') ? .75 : 1);
export const nitroCapacity = game => hasBoost(game, 'tank') ? 200 : 100;
export const SURVIVAL_CAP = 25;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const positions = stage => [12, 60, 120][stage];
export const phaseBudget = (round, phase, mode = 'normal', stage = 0, difficulty = 'easy') => {
  const floor = [[7, 5, 3], [9, 7, 6], [12, 10, 9]][stage][clamp(round, 0, 2)];
  return (15 - (15 - floor) * (phase - 1) / (PHASES - 1)) * (mode === 'hard' ? HARD_TIME_FACTOR : 1) * (DIFFICULTIES[difficulty]?.time ?? 1);
};
export function createGame() {
  return {
    status: 'menu', difficulty: 'easy', boost: null, boosts: [], mode: 'normal', format: 'classic', round: 0, stage: 0, phase: 1,
    completed: 0, taps: 0, position: 0, rotation: 0,
    budget: 15, remaining: 15, deadline: 0, resumeStatus: null,
    requiredDirection: 0, requiredSteps: 0, hardProgress: 0,
    nitro: NITRO_INITIAL, combo: 0, hourPerfectStreak: 0, attemptSteps: 0, optimalSteps: 0,
    optimalDirection: 0, perfectRoute: true, perfect: false, perfectNitro: false, nitroLocked: false, lockUses: 3, lockCooldown: 0,
    lastNitroGain: 0, lastTimeGain: 0, solveRemaining: 15, solveBudget: 15,
  };
}
export function randomPosition(stage, mode = 'normal', random = Math.random) {
  const count = positions(stage);
  const choices = Array.from({ length: count - 1 }, (_, i) => i + 1)
    .filter(position => mode !== 'hard' || position !== count / 2);
  return choices[clamp(Math.floor(random() * choices.length), 0, choices.length - 1)];
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
  Object.assign(game, createGame(), { mode: mode === 'hard' ? 'hard' : 'normal', format: format === 'survival' ? 'survival' : 'classic' });
  game.difficulty = Object.hasOwn(DIFFICULTIES, options.difficulty) ? options.difficulty : 'easy';
  game.boosts = [...new Set(options.boosts?.length ? options.boosts : [options.boost])].filter(id => ['speed', 'tank', 'time', 'recharge', 'lock', 'efficient', 'precision'].includes(id)).slice(0, 2);
  game.boost = game.boosts[0] || null;
  if (game.format === 'survival') game.remaining = 15 * DIFFICULTIES[game.difficulty].time + (hasBoost(game, 'time') ? 1.5 : 0);
  return preparePhase(game, now, random);
}
export function tickGame(game, now) {
  if (game.status !== 'playing' && !(game.format === 'survival' && game.status === 'cleared')) return game;
  game.remaining = Math.max(0, (game.deadline - now) / 1000);
  if (game.remaining === 0) { game.status = 'lost'; game.combo = 0; }
  return game;
}
export function settleGame(game, now, { perfectNitro = false, nitroLock = false } = {}) {
  if (game.status !== 'playing') return false;
  tickGame(game, now);
  if (game.status !== 'playing' || game.position !== 0 || game.attemptSteps === 0
      || (game.mode === 'hard' && game.hardProgress < game.requiredSteps)) return false;
  game.solveBudget = game.budget;
  game.solveRemaining = game.remaining;
  game.perfect = game.perfectRoute && game.attemptSteps === game.optimalSteps;
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
  if (game.format === 'survival') {
    const gain = (Math.max(1.3, 3.1 - game.completed * .015) + (game.perfect ? .6 : 0)) * DIFFICULTIES[game.difficulty].time;
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
  if (!game.optimalDirection) game.optimalDirection = direction;
  if (direction !== game.optimalDirection || game.position === 0 || game.attemptSteps >= game.optimalSteps) {
    game.perfectRoute = false;
    game.hourPerfectStreak = 0;
    game.combo = 0;
  }
  game.position = (game.position + direction + count) % count;
  game.rotation += direction * 360 / count;
  game.taps += 1;
  game.attemptSteps += 1;
  game.hardProgress += direction * game.requiredDirection;
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
  if (game.format === 'survival') {
    tickGame(game, now);
    if (game.status === 'lost') return game;
    game.phase = game.completed % PHASES + 1;
    game.stage = Math.floor(game.completed / PHASES) % 3;
    game.round = Math.floor(game.completed / (PHASES * 3));
  } else if (game.phase < PHASES) game.phase += 1;
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
  game.resumeStatus = game.status;
  game.status = 'paused';
  return game;
}
export function resumeGame(game, now) {
  if (game.status !== 'paused') return game;
  game.deadline = now + game.remaining * 1000;
  game.status = game.resumeStatus || 'playing';
  game.resumeStatus = null;
  return game;
}
