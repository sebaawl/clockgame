export const BACKDROP_MS = 7500;
// Deliberately varied saturation and brightness, rather than a near-black hue wheel.
export const PALETTES = [
  ['Cereza', 0, 70, 18, 92], ['Terracota', 18, 76, 18, 91],
  ['Ámbar', 34, 78, 17, 91], ['Miel', 48, 73, 15, 91],
  ['Lima', 74, 60, 15, 90], ['Bosque', 108, 48, 17, 91],
  ['Jade', 146, 65, 17, 91], ['Laguna', 172, 70, 18, 90],
  ['Petróleo', 194, 78, 20, 90], ['Océano', 216, 72, 21, 92],
  ['Índigo', 238, 60, 21, 92], ['Lavanda', 260, 57, 22, 92],
  ['Orquídea', 282, 61, 20, 92], ['Frambuesa', 310, 65, 19, 92],
  ['Rosa', 336, 70, 18, 92],
].map(([name, hue, saturation, dark, light]) => ({ name, hue, saturation, dark, light }));
export const DARK_BACKDROPS = ['#000000', ...PALETTES.map(p => `hsl(${p.hue} ${p.saturation}% ${p.dark}%)`)];
export const LIGHT_BACKDROPS = ['#ffffff', ...PALETTES.map(p => `hsl(${p.hue} ${p.saturation}% ${p.light}%)`)];
export function nextBackdrop(current, random = Math.random) {
  const options = DARK_BACKDROPS.map((_, index) => index).filter(index => index !== current);
  return options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))];
}
// Each run tours every colored palette before reshuffling. Neutral is reserved
// for the opening and a broken streak, never an accidental random selection.
export function createPaletteSequence(random = Math.random) {
  let bag = [];
  return {
    reset() { bag = []; },
    next(current = 0) {
      if (!bag.length) {
        bag = PALETTES.map((_, i) => i + 1);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.at(-1) === current) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      }
      return bag.pop();
    },
  };
}
export function backdropColors(index, light = false) {
  if (index === 0) return { accent: light ? '#007fa8' : '#54d8ff', flash: light ? '#000000' : '#ffffff' };
  const hue = (PALETTES[index - 1].hue + 180) % 360;
  const accent = `hsl(${hue} 75% ${light ? 30 : 76}%)`;
  return { accent, flash: accent, overlay: light ? `hsl(${hue} 75% 70%)` : accent };
}
