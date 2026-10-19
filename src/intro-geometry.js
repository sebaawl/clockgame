import { LOGO_GLYPHS } from './intro-glyphs.js';

export const GLYPH_CENTER = { x: 318, y: 279 };
export const GLYPH_RADIUS = 290;
export const glyphPath = char => LOGO_GLYPHS[char]?.map(([command, ...numbers]) => command + numbers.join(' ')).join('');

// Match the o's cubic topology and winding. The end shape is the exact font
// outline, including its asymmetric curves and narrower inner counter.
export function clockContour() {
  const contours = [];
  let contour;
  for (const command of LOGO_GLYPHS.o) {
    if (command[0] === 'M') { contour = []; contours.push(contour); }
    contour.push(command);
  }
  const { x: cx, y: cy } = GLYPH_CENTER;
  return contours.map((commands, index) => {
    const count = commands.filter(c => c[0] === 'C').length;
    const radius = index ? 235 : GLYPH_RADIUS;
    const start = index ? 0 : Math.PI;
    const delta = (index ? 1 : -1) * Math.PI * 2 / count;
    let path = `M${cx + radius * Math.cos(start)} ${cy + radius * Math.sin(start)}`;
    for (let i = 0; i < count; i++) {
      const a = start + i * delta, b = a + delta, k = 4 / 3 * Math.tan(delta / 4);
      const x1 = cx + radius * (Math.cos(a) - k * Math.sin(a));
      const y1 = cy + radius * (Math.sin(a) + k * Math.cos(a));
      const x2 = cx + radius * (Math.cos(b) + k * Math.sin(b));
      const y2 = cy + radius * (Math.sin(b) - k * Math.cos(b));
      path += `C${x1} ${y1} ${x2} ${y2} ${cx + radius * Math.cos(b)} ${cy + radius * Math.sin(b)}`;
    }
    return path + 'Z';
  }).join('');
}

// Twelve landings at 125 ms intervals, with a short, springy mechanical move.
export function handFrames(ratio = 1) {
  const frames = [{ transform: 'rotate(0deg)', offset: 0 }];
  for (let i = 1; i <= 12; i++) {
    frames.push({ transform: `rotate(${-30 * (i - 1) * ratio}deg)`, offset: (i - 1 + .56) / 12, easing: 'cubic-bezier(.2,.85,.3,1)' });
    frames.push({ transform: `rotate(${-(30 * i + 1.4) * ratio}deg)`, offset: (i - .12) / 12, easing: 'ease-out' });
    frames.push({ transform: `rotate(${-30 * i * ratio}deg)`, offset: i / 12 });
  }
  return frames;
}
