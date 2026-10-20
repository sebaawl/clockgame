// A beat is owned once: early taps, late taps and unattended beats all count.
export const RHYTHM_WINDOW = 170;
export const rhythmWindow = game => Math.min(RHYTHM_WINDOW, game.rhythmPeriod * .3);
export function rhythmPeriod(game) {
  const start = { easy: 1600, medium: 1400, hard: 1200 }[game.difficulty];
  const floor = { easy: 500, medium: 440, hard: 380 }[game.difficulty];
  return Math.max(floor, start * Math.pow(.986, game.rhythmHits));
}
export function prepareRhythm(game, now) {
  Object.assign(game, { position: 0, rotation: Math.round(game.rotation / 360) * 360,
    rhythmLastTarget: -Infinity, rhythmHits: 0, rhythmErrors: 0, rhythmScore: 0, rhythmTime: 0, rhythmGrade: '',
    rhythmPeriod: { easy: 1100, medium: 950, hard: 800 }[game.difficulty],
    rhythmMisses: game.format === 'rhythm' ? game.rhythmMisses || 0 : 0 });
  if (game.format === 'rhythm') game.rhythmPeriod = rhythmPeriod(game);
  game.rhythmNext = now + game.rhythmPeriod;
  game.optimalSteps = 4;
}
export function rhythmGrade(error, window = RHYTHM_WINDOW) {
  if (error > window) return null;
  return error <= 45 ? { label: 'EXACTO', points: 48, time: .65 }
    : error <= 95 ? { label: 'BIEN', points: 28, time: .35 }
    : error <= RHYTHM_WINDOW ? { label: 'JUSTO', points: 12, time: .15 } : null;
}
export function missRhythm(game) {
  game.rhythmMisses++;
  game.rhythmErrors++;
  game.rhythmGrade = 'FUERA DE PULSO';
  game.combo = game.hourPerfectStreak = 0;
  game.perfectRoute = false;
  if (game.rhythmMisses >= 3) game.status = 'lost';
}
export function tickRhythm(game, now) {
  while (game.status === 'playing' && now > game.rhythmNext + rhythmWindow(game)) {
    game.rhythmLastTarget = game.rhythmNext;
    missRhythm(game);
    game.rhythmNext += game.rhythmPeriod;
  }
}
export function pulseRhythm(game, now) {
  // A late press belongs to the beat just missed, not a second early failure.
  // The brief ownership window also filters contact bounce and repeated events.
  if (game.rhythmLastTarget !== -Infinity && now < game.rhythmNext - game.rhythmPeriod / 2) return false;
  game.rhythmLastTarget = game.rhythmNext;
  const grade = rhythmGrade(Math.abs(now - game.rhythmNext), rhythmWindow(game));
  if (!grade) { game.rhythmNext += game.rhythmPeriod; missRhythm(game); return false; }
  game.rhythmHits++;
  if (game.format === 'rhythm') game.rhythmPeriod = rhythmPeriod(game);
  game.rhythmNext += game.rhythmPeriod;
  game.rhythmScore += grade.points;
  game.rhythmTime += grade.time;
  game.rhythmGrade = grade.label;
  if (grade.label !== 'EXACTO') game.perfectRoute = false;
  return true;
}
