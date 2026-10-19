export const STAGES = ['horas', 'minutos', 'segundos'];
export const FLOORS = [7, 5, 3];
export const PHASES = 10;
export const TOTAL_PHASES = PHASES * STAGES.length * FLOORS.length;
export const HARD_TIME_FACTOR = 0.8;

export const positions = stage => [12, 60, 120][stage];
export const phaseBudget = (round, phase, mode = 'normal') => (
  15 - (15 - FLOORS[round]) * (phase - 1) / (PHASES - 1)
) * (mode === 'hard' ? HARD_TIME_FACTOR : 1);

export function createGame() {
  return {
    status: 'menu', mode: 'normal', round: 0, stage: 0, phase: 1,
    completed: 0, taps: 0, position: 0, rotation: 0,
    budget: 15, remaining: 15, deadline: 0, resumeStatus: null,
    requiredDirection: 0, requiredSteps: 0, hardProgress: 0,
  };
}

export function randomPosition(stage, mode = 'normal', random = Math.random) {
  const count = positions(stage);
  // Every unsolved position can appear. Hard mode avoids an ambiguous 180° tie.
  const choices = Array.from({ length: count - 1 }, (_, i) => i + 1)
    .filter(position => mode !== 'hard' || position !== count / 2);
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}

function preparePhase(game, now, random) {
  const count = positions(game.stage);
  game.position = randomPosition(game.stage, game.mode, random);
  // Preserve the solved revolution, then depart from twelve by the shortest arc.
  const twelve = Math.round(game.rotation / 360) * 360;
  const offset = game.position > count / 2 ? game.position - count : game.position;
  game.rotation = twelve + offset * 360 / count;
  game.requiredDirection = game.position < count / 2 ? 1 : -1;
  game.requiredSteps = game.requiredDirection === 1 ? count - game.position : game.position;
  game.hardProgress = 0;
  game.budget = phaseBudget(game.round, game.phase, game.mode);
  game.remaining = game.budget;
  game.deadline = now + game.budget * 1000;
  game.status = 'playing';
  return game;
}

export function startGame(game, now, random = Math.random, mode = 'normal') {
  Object.assign(game, createGame(), { mode: mode === 'hard' ? 'hard' : 'normal' });
  return preparePhase(game, now, random);
}

export function tickGame(game, now) {
  if (game.status !== 'playing') return game;
  game.remaining = Math.max(0, (game.deadline - now) / 1000);
  if (game.remaining === 0) game.status = 'lost';
  return game;
}

export function moveGame(game, direction, now) {
  if (game.status !== 'playing' || ![-1, 1].includes(direction)) return false;
  tickGame(game, now);
  if (game.status !== 'playing') return false;
  const count = positions(game.stage);
  game.position = (game.position + direction + count) % count;
  game.rotation += direction * 360 / count;
  game.taps += 1;
  // Net signed travel prevents a short-path solve or a last-tap reversal bypass.
  game.hardProgress += direction * game.requiredDirection;
  const validRoute = game.mode !== 'hard' || game.hardProgress >= game.requiredSteps;
  if (game.position === 0 && validRoute) {
    game.status = 'cleared';
    game.completed += 1;
  }
  return true;
}

export function advanceGame(game, now, random = Math.random) {
  if (game.status !== 'cleared') return game;
  if (game.phase < PHASES) game.phase += 1;
  else if (game.stage < 2) { game.stage += 1; game.phase = 1; }
  else if (game.round < 2) { game.round += 1; game.stage = 0; game.phase = 1; }
  else { game.status = 'won'; return game; }
  return preparePhase(game, now, random);
}

export function pauseGame(game, now) {
  if (!['playing', 'cleared', 'break'].includes(game.status)) return game;
  if (game.status === 'playing') tickGame(game, now);
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
