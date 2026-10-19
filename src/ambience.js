export const BACKDROP_MS = 10000;
// Eighteen hue families, from deep ink to warm plum, with paired light surfaces.
const HUES = Array.from({ length: 18 }, (_, i) => i * 20);
export const DARK_BACKDROPS = ['#000000', ...HUES.map(h => `hsl(${h} 62% 11%)`)];
export const LIGHT_BACKDROPS = ['#ffffff', ...HUES.map(h => `hsl(${h} 65% 94%)`)];
export function nextBackdrop(current, random = Math.random) {
  const options = DARK_BACKDROPS.map((_, index) => index).filter(index => index !== current);
  return options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))];
}

// Complement the backdrop hue while keeping enough lightness contrast for the hand.
export function backdropColors(index, light = false) {
  if (index === 0) return { accent: light ? '#007fa8' : '#54d8ff', flash: light ? '#000000' : '#ffffff' };
  const hue = (HUES[index - 1] + 180) % 360;
  const accent = `hsl(${Math.round(hue)} 75% ${light ? 30 : 76}%)`;
  return { accent, flash: accent };
}
