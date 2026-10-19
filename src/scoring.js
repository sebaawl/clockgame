const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Extra taps never earn points: they reduce the precision bonus.
export function scoreAdjustment({ remaining, budget, optimalSteps, taps, stage, round, streak, mode = 'normal' }) {
  if (budget <= 0 || optimalSteps < 1 || taps < 1) return 0;
  const speed = Math.round(4 * clamp(remaining / budget, 0, 1));
  const precision = Math.round(1 * clamp(optimalSteps / taps, 0, 1));
  const difficulty = 1 + clamp(stage, 0, 2) * 0.15 + clamp(round, 0, 2) * 0.2;
  const chain = 1 + Math.min(Math.max(streak - 1, 0), 10) * 0.02;
  return Math.round((3 + speed + precision) * difficulty * chain * (mode === 'hard' ? 1.5 : 1));
}
