const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Absolute active play time; menu pauses and intermissions never enter this value.
export function classifyAdjustment(elapsed) {
  if (elapsed <= 1 + 1e-9) return 'excelente';
  if (elapsed <= 2 + 1e-9) return 'bien';
  if (elapsed <= 3 + 1e-9) return 'insuficiente';
  return 'malo';
}

export function scoreAdjustment({ remaining, budget, optimalSteps, taps, stage = 0, round = 0, streak = 1, mode = 'normal' }) {
  if (![remaining, budget, optimalSteps, taps].every(Number.isFinite)
      || remaining <= 0 || budget <= 0 || optimalSteps < 1 || taps < 1) return 0;
  const elapsed = clamp(budget - remaining, 0, budget);
  const grade = classifyAdjustment(elapsed);
  const reward = grade === 'excelente' ? 22 - 2 * elapsed
    : grade === 'bien' ? 14 - 4 * (elapsed - 1)
    : grade === 'insuficiente' ? 6 - 2 * (elapsed - 2)
    : elapsed <= 5 ? 2 : 1;
  // Slow solves stay small even in later phases, with a long streak or hard mode.
  if (grade === 'malo') return reward * 2;
  const precision = .65 + .35 * clamp(optimalSteps / taps, 0, 1);
  const difficulty = 1 + clamp(stage, 0, 2) * .1 + clamp(round, 0, 2) * .15;
  const chain = 1 + clamp(streak - 1, 0, 10) * .01;
  return 2 * Math.max(1, Math.round(reward * precision * difficulty * chain * (mode === 'hard' ? 1.5 : 1)));
}
