export const BACKDROP_MS = 10000;
export const DARK_BACKDROPS = ['#000000', '#071c30', '#1c1033', '#062a2b', '#28132b', '#11243b'];
export const LIGHT_BACKDROPS = ['#ffffff', '#e3f5ff', '#eee8ff', '#e0f8f2', '#ffebf5', '#e8f0ff'];
export function nextBackdrop(current, random = Math.random) {
  const options = DARK_BACKDROPS.map((_, index) => index).filter(index => index !== current);
  return options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))];
}

// Complement the backdrop hue while keeping enough lightness contrast for the hand.
export function backdropColors(index, light = false) {
  if (index === 0) return { accent: light ? '#007fa8' : '#54d8ff', flash: light ? '#000000' : '#ffffff' };
  const hex = (light ? LIGHT_BACKDROPS : DARK_BACKDROPS)[index];
  const [r, g, b] = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = delta === 0 ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 540) % 360;
  const accent = `hsl(${Math.round(hue)} 75% ${light ? 30 : 76}%)`;
  return { accent, flash: accent };
}
