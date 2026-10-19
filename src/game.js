export const STAGES = ['horas', 'minutos', 'segundos'];
export const FLOORS = [7, 5, 3];
export const PHASES = 30;
export const TOTAL_PHASES = 270;

export const positions = (stage) => stage === 0 ? 12 : 60;
export const phaseBudget = (round, phase) => 15 - (15 - FLOORS[round]) * (phase - 1) / (PHASES - 1);

export function createGame() {
  return {
    status: 'ready', tutorial: true, round: 0, stage: 0, phase: 1,
    completed: 0, taps: 0, position: 10, rotation: -60,
    budget: 10, remaining: 10, deadline: 0, resumeStatus: null,
  };
}

function preparePhase(game, now, random) {
  const count = positions(game.stage);
  // Small early offsets teach the controls; later phases can use the whole dial.
  const maxDistance = Math.min(count / 2, game.tutorial ? 2 : 2 + Math.floor((game.phase - 1) * (count / 2 - 2) / 29));
  const distance = 1 + Math.floor(random() * maxDistance);
  const signedDistance = random() < 0.5 ? -distance : distance;
  game.position = (signedDistance + count) % count;
  game.rotation = signedDistance * 360 / count;
  game.budget = game.tutorial ? 10 : phaseBudget(game.round, game.phase);
  game.remaining = game.budget;
  game.deadline = now + game.budget * 1000;
  game.status = 'playing';
  return game;
}

export function startGame(game, now, random = Math.random) {
  Object.assign(game, createGame());
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
  if (game.position === 0) {
    game.status = 'cleared';
    if (!game.tutorial) game.completed += 1;
  }
  return true;
}

export function advanceGame(game, now, random = Math.random) {
  if (game.status !== 'cleared') return game;
  if (game.tutorial) {
    game.tutorial = false;
  } else if (game.phase < PHASES) {
    game.phase += 1;
  } else if (game.stage < 2) {
    game.stage += 1;
    game.phase = 1;
  } else if (game.round < 2) {
    game.round += 1;
    game.stage = 0;
    game.phase = 1;
  } else {
    game.status = 'won';
    return game;
  }
  return preparePhase(game, now, random);
}

export function pauseGame(game, now) {
  if (game.status !== 'playing' && game.status !== 'cleared') return game;
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

export function retryPhase(game, now, random = Math.random) {
  if (game.status !== 'lost') return game;
  return preparePhase(game, now, random);
}
