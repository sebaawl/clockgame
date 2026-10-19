export const BACKDROP_MS = 10000;
export const DARK_BACKDROPS = ['#000000', '#071c30', '#1c1033', '#062a2b', '#28132b', '#11243b'];
export const LIGHT_BACKDROPS = ['#ffffff', '#e3f5ff', '#eee8ff', '#e0f8f2', '#ffebf5', '#e8f0ff'];
export function nextBackdrop(current, random = Math.random) {
  const options = DARK_BACKDROPS.map((_, index) => index).filter(index => index !== current);
  return options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))];
}
