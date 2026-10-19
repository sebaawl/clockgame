// Special clocks are spaced between ordinary solves; classic never uses them.
export function prepareChallenge(game, now, count, random) {
  Object.assign(game, { challenge: 'normal', targetClicks: 0, challengeDirection: 0, challengeRetries: 0, extraTurns: 0,
    driftDirection: 0, driftNext: 0, flipNext: Infinity, driftInterval: 0, flipInterval: 0 });
  if (game.format !== 'survival') return;
  const phase = game.phase;
  game.challenge = game.stage === 0 && phase === 3 ? 'exact' : phase === [6, 3, 2][game.stage] ? 'duel' : phase === [9, 6, 4][game.stage] ? 'chaos' : 'normal';
  if (game.challenge === 'exact') {
    const direction = game.mode === 'hard' ? game.requiredDirection : random() < .5 ? -1 : 1;
    game.challengeDirection = direction;
    game.extraTurns = random() < .35 ? 2 : 1;
    game.targetClicks = count * game.extraTurns + (direction === 1 ? count - game.position : game.position);
    game.optimalSteps = game.targetClicks;
    game.optimalDirection = direction;
    game.remaining = Math.min(17, game.remaining + (1 + game.extraTurns) * ({ easy: 1, medium: .82, hard: .65 }[game.difficulty]));
  } else if (game.challenge !== 'normal') {
    game.driftDirection = random() < .5 ? -1 : 1;
    game.driftInterval = [900, 210, 120][game.stage] * ({ easy: 1, medium: .88, hard: .76 }[game.difficulty]);
    game.flipInterval = [1350, 1050, 900][game.stage];
    game.driftNext = now + game.driftInterval;
    game.flipNext = game.challenge === 'chaos' ? now + game.flipInterval : Infinity;
  }
}
export function tickChallenge(game, now, count) {
  if (!game.driftInterval || game.status !== 'playing') return;
  // Process elapsed ticks and reversals in their timestamp order, independent of FPS.
  while (Math.min(game.driftNext, game.flipNext) <= now) {
    if (game.flipNext <= game.driftNext) {
      game.driftDirection *= -1;
      game.flipNext += game.flipInterval;
    } else {
      const direction = game.driftDirection;
      game.position = (game.position + direction + count) % count;
      game.rotation += direction * 360 / count;
      game.hardProgress += direction * game.requiredDirection;
      if (game.optimalDirection) game.optimalSteps = Math.max(game.attemptSteps, game.optimalSteps - direction * game.optimalDirection);
      game.driftNext += game.driftInterval;
    }
  }
}
export function retryExact(game, now, count) {
  if (game.challenge !== 'exact' || game.attemptSteps < game.targetClicks || game.position === 0) return;
  game.challengeRetries += 1;
  game.combo = game.hourPerfectStreak = 0;
  game.perfectRoute = false;
  game.attemptSteps = 0;
  game.targetClicks = count * game.extraTurns + (game.challengeDirection === 1 ? count - game.position : game.position || count);
  game.optimalSteps = game.targetClicks;
  game.requiredSteps = game.targetClicks - count * game.extraTurns;
  game.hardProgress = 0;
  // A missed count costs time, but gives another solvable target from here.
  game.remaining = Math.max(0, game.remaining - 1);
  game.deadline = now + game.remaining * 1000;
  if (!game.remaining) game.status = 'lost';
}

// Reachability includes parity: unused moves can be spent in opposite pairs.
export function exactGuide(game, count = 12) {
  if (game.format !== 'survival' || game.challenge !== 'exact') return null;
  const left = game.targetClicks - game.attemptSteps;
  const reachable = (position, steps) => {
    const distance = Math.min(position, count - position);
    return steps >= distance && (steps - distance) % 2 === 0;
  };
  if (left === 0 && game.position === 0) return { state: 'release', direction: 0 };
  if (!reachable(game.position, left)) return { state: 'lost', direction: 0 };
  const directions = [-1, 1].filter(dir => reachable((game.position + dir + count) % count, left - 1));
  const distance = Math.min(game.position, count - game.position);
  const forced = directions.length === 1 || left === distance;
  const direction = directions.includes(game.challengeDirection) ? game.challengeDirection : directions[0];
  return { state: forced ? 'turn' : 'free', direction };
}
