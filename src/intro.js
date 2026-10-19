import './intro.css';
import { LOGO_UNITS, LOGO_GLYPHS } from './intro-glyphs.js';
import { clockContour, glyphPath, handFrames, GLYPH_CENTER, GLYPH_RADIUS } from './intro-geometry.js';

const SVG = 'http://www.w3.org/2000/svg';
let played = false;
const node = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};

// All native animations share one timeline origin; the final paths come from
// the actual bundled font, while positions and spacing come from the real h1.
export function playIntro(heading, feedback) {
  if (played || !heading) return;
  played = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelector('.start-content')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    return;
  }
  const text = heading.textContent;
  const oIndex = text.indexOf('o');
  if (oIndex < 0 || [...text].some(char => !LOGO_GLYPHS[char])) return;
  const app = document.querySelector('#app'), wasInert = app.inert;
  const overlay = document.createElement('button');
  overlay.id = 'startup-intro'; overlay.setAttribute('aria-label', 'Saltar introducción');
  const scene = node('svg', { viewBox: `0 0 ${innerWidth} ${innerHeight}`, 'aria-hidden': 'true' });
  const word = node('g', { id: 'intro-word' });
  const dial = node('g', { id: 'intro-dial' });
  const initialPath = clockContour(), targetPath = glyphPath('o');
  const outline = node('path', { id: 'intro-ring', d: initialPath });
  const { x: cx, y: cy } = GLYPH_CENTER;
  const diameter = Math.min(168, innerWidth * .44, innerHeight * .34);
  const initialScale = diameter / (GLYPH_RADIUS * 2);
  const initialTransform = (left = 0, top = 0) => `translate(${innerWidth / 2 - left - cx * initialScale}px, ${innerHeight / 2 - top + cy * initialScale}px) scale(${initialScale}, ${-initialScale})`;
  dial.style.transform = initialTransform();
  const marks = Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI / 6;
    return node('line', { x1: cx + Math.sin(angle) * 200, y1: cy + Math.cos(angle) * 200, x2: cx + Math.sin(angle) * 219, y2: cy + Math.cos(angle) * 219, class: 'intro-mark' });
  });
  const hands = node('g', { id: 'intro-hands' });
  const minute = node('g', { id: 'intro-minute' });
  const hour = node('g', { id: 'intro-hour' });
  minute.append(node('path', { d: `M${cx} ${cy - 10}V${cy + 194}`, class: 'intro-hand' }));
  hour.append(node('path', { d: `M${cx} ${cy}V${cy + 140}`, class: 'intro-hand intro-hour-hand' }));
  hands.append(hour, minute, node('circle', { cx, cy, r: 15 }));
  dial.append(outline, ...marks, hands); word.append(dial); scene.append(word); overlay.append(scene);
  document.body.classList.add('intro-active');
  app.inert = true; document.body.append(overlay);
  feedback?.unlock(); // Decode/prewarm the embedded recording before frame zero.
  const animations = [];
  let finished = false, measurement, fallbackFrame, stopClicks = () => {};
  const cleanup = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(fallbackFrame);
    stopClicks();
    animations.forEach(animation => animation.cancel());
    measurement?.remove(); overlay.remove();
    document.body.classList.remove('intro-active', 'intro-landed');
    app.inert = wasInert;
    window.removeEventListener('resize', cleanup);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('keydown', onKey, true);
  };
  const onVisibility = () => { if (document.hidden) cleanup(); };
  const onKey = event => { if (['Escape', 'Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); cleanup(); } };
  overlay.addEventListener('click', cleanup);
  window.addEventListener('resize', cleanup, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKey, true);

  (async () => {
    await document.fonts.ready;
    if (finished) return;
    // Cancel the existing boot reveal before measuring its final, stable layout.
    document.querySelector('.start-content').getAnimations().forEach(animation => animation.cancel());
    const style = getComputedStyle(heading), header = heading.getBoundingClientRect();
    const headerSize = parseFloat(style.fontSize), size = Math.min(64, innerWidth * .17);
    measurement = document.createElement('span');
    measurement.className = 'intro-measure';
    Object.assign(measurement.style, {
      fontFamily: style.fontFamily, fontWeight: style.fontWeight, fontStyle: style.fontStyle,
      fontKerning: style.fontKerning, fontFeatureSettings: style.fontFeatureSettings,
      fontVariantLigatures: style.fontVariantLigatures, fontStretch: style.fontStretch,
      fontSize: `${size}px`, lineHeight: `${parseFloat(style.lineHeight) / headerSize * size}px`,
      letterSpacing: `${parseFloat(style.letterSpacing) / headerSize * size}px`,
    });
    const content = document.createTextNode(text), baselineProbe = document.createElement('span');
    baselineProbe.className = 'intro-baseline';
    measurement.append(content, baselineProbe); document.body.append(measurement);
    const box = measurement.getBoundingClientRect(), baseline = baselineProbe.getBoundingClientRect().top - box.top;
    const scale = size / LOGO_UNITS;
    const range = document.createRange();
    const letterTransforms = [];
    [...text].forEach((char, index) => {
      range.setStart(content, index); range.setEnd(content, index + 1);
      const x = range.getBoundingClientRect().left - box.left;
      const transform = `translate(${x}px, ${baseline}px) scale(${scale}, ${-scale})`;
      if (index === oIndex) letterTransforms.push(transform);
      else {
        const letter = node('path', { d: glyphPath(char), class: 'intro-letter', 'data-letter': char });
        letter.style.transform = transform; word.append(letter);
      }
    });
    measurement.remove(); measurement = null;
    word.style.transform = `translate(${box.left}px, ${box.top}px)`;
    dial.style.transform = initialTransform(box.left, box.top);
    const menu = [document.querySelector('.menu-best'), ...document.querySelectorAll('.choice-block'), document.querySelector('.home-play')];
    {
      const epoch = document.timeline.currentTime, startedAt = performance.now();
      if (finished) return;
      try {
        const animate = (element, frames, duration, delay = 0, easing = 'cubic-bezier(.22,.8,.25,1)') => {
          const animation = element.animate(frames, { duration, delay, easing, fill: 'both' });
          animation.startTime = epoch; animations.push(animation);
          return animation.finished;
        };
        const promises = [];
        stopClicks = feedback?.introClicks(startedAt) || (() => {});
        promises.push(animate(minute, handFrames(), 1500, 0, 'linear'));
        promises.push(animate(hour, handFrames(1 / 12), 1500, 0, 'linear'));
        promises.push(animate(hands, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.08)' }], 350, 1500));
        marks.forEach((mark, i) => promises.push(animate(mark, [{ opacity: 1 }, { opacity: 0 }], 260, 1500 + i * 12)));
        if (CSS.supports('d', `path("${targetPath}")`)) {
          promises.push(animate(outline, [{ d: `path("${initialPath}")` }, { d: `path("${targetPath}")` }], 600, 1500));
        } else {
          // Older WebViews interpolate the same contour numbers on animation frames.
          const source = initialPath.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
          const target = targetPath.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
          const morph = now => {
            if (finished) return;
            const linear = Math.max(0, Math.min(1, (performance.now() - startedAt - 1500) / 600));
            const t = linear * linear * (3 - 2 * linear); let index = 0;
            if (linear > 0) outline.setAttribute('d', targetPath.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, () => { const i = index++; return source[i] + (target[i] - source[i]) * t; }));
            if (linear < 1) fallbackFrame = requestAnimationFrame(morph);
          };
          fallbackFrame = requestAnimationFrame(morph);
        }
        promises.push(animate(dial, [{ transform: initialTransform(box.left, box.top) }, { transform: letterTransforms[0] }], 600, 1500));
        word.querySelectorAll('.intro-letter').forEach(letter => promises.push(animate(letter, [{ opacity: 0 }, { opacity: 1 }], 570, 1530)));
        const landing = animate(word, [
          { transform: `translate(${box.left}px, ${box.top}px) scale(1)` },
          { transform: `translate(${header.left}px, ${header.top}px) scale(${headerSize / size})` },
        ], 600, 2100);
        promises.push(landing);
        promises.push(animate(overlay, [{ backgroundColor: 'var(--surface)' }, { backgroundColor: 'transparent' }], 1, 2600, 'linear'));
        menu.forEach((element, i) => {
          element.getAnimations().forEach(animation => animation.cancel());
          promises.push(animate(element, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], i === 4 ? 460 : 500, 2600 + i * 60));
        });
        for (const selector of ['.hud', '.app-nav']) {
          const element = document.querySelector(selector);
          element.getAnimations().forEach(animation => animation.cancel());
          promises.push(animate(element, [{ opacity: 0, transform: selector === '.hud' ? 'translateX(-50%) translateY(16px)' : 'translateY(16px)' }, { opacity: 1, transform: selector === '.hud' ? 'translateX(-50%) translateY(0)' : 'translateY(0)' }], 500, selector === '.hud' ? 2600 : 2800));
        }
        landing.then(() => {
          if (finished) return;
          // One frame, one owner: exact vector word out, untouched native h1 in.
          document.body.classList.add('intro-landed');
          overlay.remove(); app.inert = wasInert;
          document.removeEventListener('keydown', onKey, true);
        }).catch(() => {});
        Promise.all(promises).then(cleanup).catch(cleanup);
      } catch { cleanup(); }
    }
  })().catch(cleanup);
}
