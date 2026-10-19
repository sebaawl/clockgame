import './intro.css';

// A single opening sequence per document. The real heading stays in layout so
// the animated word can land exactly on it on any screen size.
export function playIntro(heading) {
  if (!heading || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const overlay = document.createElement('button');
  overlay.id = 'startup-intro';
  overlay.setAttribute('aria-label', 'Saltar introducción');
  overlay.innerHTML = `<span class="intro-word" aria-hidden="true"><span class="intro-letters">cl</span><span class="intro-o"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/><g class="intro-hands"><path d="M50 50V22"/><path class="intro-spinner" d="M50 50V14"/><circle class="intro-pin" cx="50" cy="50" r="3"/></g></svg></span><span class="intro-letters">cking</span></span>`;
  document.body.classList.add('intro-active');
  document.body.append(overlay);
  const animations = [];
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    animations.forEach(animation => animation.cancel());
    overlay.remove();
    document.body.classList.remove('intro-active');
    window.removeEventListener('resize', cleanup);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const onVisibility = () => { if (document.hidden) cleanup(); };
  overlay.addEventListener('click', cleanup);
  window.addEventListener('resize', cleanup, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
  const animate = (element, frames, duration, extra = {}) => {
    const animation = element.animate(frames, { duration, fill: 'both', easing: 'cubic-bezier(.22,.8,.25,1)', ...extra });
    animations.push(animation);
    return animation.finished;
  };
  (async () => {
    await document.fonts.ready;
    if (finished) return;
    const word = overlay.querySelector('.intro-word');
    const dial = overlay.querySelector('.intro-o');
    const letters = overlay.querySelectorAll('.intro-letters');
    const bounds = dial.getBoundingClientRect();
    const offset = innerWidth / 2 - (bounds.left + bounds.width / 2);
    const departure = `translateX(${offset}px) scale(3.4)`;
    await Promise.all([animate(overlay.querySelector('.intro-spinner'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], 850),
    animate(dial, [{ transform: departure, opacity: 0 }, { transform: departure, opacity: 1, offset: .22 }, { transform: departure, opacity: 1 }], 900)]);
    if (finished) return;
    letters.forEach(element => animate(element, [{ opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0)' }], 420).catch(() => {}));
    animate(overlay.querySelector('.intro-hands'), [{ opacity: 1 }, { opacity: 0 }], 300).catch(() => {});
    await animate(dial, [{ transform: departure }, { transform: 'translateX(0) scale(1)' }], 520);
    if (finished) return;
    const from = word.getBoundingClientRect(), target = heading.getBoundingClientRect();
    const dx = target.left + target.width / 2 - (from.left + from.width / 2);
    const dy = target.top + target.height / 2 - (from.top + from.height / 2);
    await animate(word, [
      { transform: 'translate(0, 0) scale(1)', offset: 0 },
      { transform: 'translate(0, 0) scale(1)', offset: .25 },
      { transform: `translate(${dx}px, ${dy}px) scale(${target.width / from.width})`, offset: 1 },
    ], 800);
    cleanup();
  })().catch(cleanup);
}
