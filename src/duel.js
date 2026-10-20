// The standalone duel is a tug of war, always in minutes. Six is the escape line.
export function duelInterval(game) {
  const start = { easy: 300, medium: 250, hard: 210 }[game.difficulty];
  return Math.max(start * .5, start * Math.pow(.98, game.completed));
}
export function prepareDuel(game, now, random = Math.random, grace = 0) {
  game.duelRandom = random;
  const distance = 12 + Math.min(12, Math.floor(random() * 13));
  const side = random() < .5 ? 1 : -1;
  game.duelOffset = distance * side;
  game.position = (game.duelOffset + 60) % 60;
  game.rotation = Math.round(game.rotation / 360) * 360 + game.duelOffset * 6;
  game.optimalDirection = -side;
  game.optimalSteps = distance;
  game.requiredDirection = -side;
  game.requiredSteps = distance;
  game.attemptSteps = game.hardProgress = 0;
  game.perfectRoute = true;
  game.perfect = game.perfectNitro = game.nitroLocked = false;
  game.duelStartedAt = now;
  game.driftDirection = side;
  game.driftInterval = duelInterval(game);
  game.driftNext = now + (grace || game.driftInterval);
  game.flipNext = Infinity;
  game.budget = game.remaining = 12; // Scoring reference, never a countdown.
}
export function duelStep(game, direction) {
  game.duelOffset += direction;
  game.position = (game.duelOffset + 60) % 60;
  game.rotation += direction * 6;
  // Always push away from twelve, including after a player overshoots with Nitro.
  if (game.duelOffset !== 0) game.driftDirection = Math.sign(game.duelOffset);
}
export function escapeDuel(game, now) {
  if (Math.abs(game.duelOffset) < 30) return false;
  game.lives--;
  game.duelEscapes++;
  game.combo = game.hourPerfectStreak = 0;
  if (!game.lives) game.status = 'lost';
  else prepareDuel(game, now, game.duelRandom, 850);
  return true;
}
export function tickDuel(game, now) {
  while (game.status === 'playing' && game.driftNext <= now) {
    const at = game.driftNext;
    duelStep(game, game.driftDirection);
    game.optimalSteps = game.attemptSteps + Math.abs(game.duelOffset);
    game.driftNext += game.driftInterval;
    escapeDuel(game, at);
  }
}
