import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/instrument-serif/400-italic.css';
import './style.css';
import { createGame, startGame, tickGame, moveGame, advanceGame, pauseGame, resumeGame, retryPhase, STAGES, FLOORS, TOTAL_PHASES } from './game.js';

const icons = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m9 5 10 7-10 7V5Z"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  left: '<path d="M5 10a8 8 0 1 1 2 9M5 4v6h6"/>',
  right: '<path d="M19 10a8 8 0 1 0-2 9m2-15v6h-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const pad = (value) => String(value).padStart(2, '0');
const storage = {
  get(key, fallback) { try { return localStorage.getItem(`clocking:${key}`) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`clocking:${key}`, String(value)); } catch { /* Game also works without storage. */ } },
};
let best = Math.min(TOTAL_PHASES, Math.max(0, Number(storage.get('best', 0)) || 0));
let soundOn = storage.get('sound', 'false') === 'true';
let audioContext;
let advanceTimer;
let helpPaused = false;
const game = createGame();

const ticks = Array.from({ length: 60 }, (_, i) => {
  const major = i % 5 === 0;
  return `<line x1="200" y1="${major ? 35 : 38}" x2="200" y2="${major ? 49 : 44}" transform="rotate(${i * 6} 200 200)" class="tick ${major ? 'major' : ''}"/>`;
}).join('');

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="clocking, inicio">clocking<span>.</span></a>
      <span class="header-note"><span class="tiny-clock"></span> un pequeño respiro para tu mente</span>
      <nav class="header-actions" aria-label="Opciones de juego">
        <button id="sound-button" class="icon-button" aria-label="Activar sonido" aria-pressed="false">${icon('muted')}</button>
        <button id="help-button" class="icon-button help-button" aria-label="Cómo jugar"><span aria-hidden="true">?</span></button>
      </nav>
    </header>

    <main>
      <section class="intro" aria-labelledby="main-title">
        <div class="eyebrow"><span class="accent-dot"></span><span id="eyebrow-text">MENOS RUIDO. MÁS MOMENTO.</span></div>
        <h1 id="main-title">Todo a su <em>tiempo.</em></h1>
        <p id="intro-description">Un reloj desajustado. Dos direcciones. Un solo destino.</p>
      </section>

      <section id="playfield" class="playfield" aria-label="Juego del reloj">
        <div class="tap-zones" id="tap-zones" hidden>
          <button class="tap-zone tap-left" id="tap-left" aria-label="Girar en sentido antihorario. Flecha izquierda."></button>
          <button class="tap-zone tap-right" id="tap-right" aria-label="Girar en sentido horario. Flecha derecha."></button>
        </div>

        <aside class="stage-info">
          <div class="section-label"><span class="short-rule"></span><span id="stage-label">PRIMER CONTACTO</span></div>
          <h2 id="stage-heading">Encuentra<br>las doce.</h2>
          <p class="stage-description" id="stage-description">Un toque, una hora.<br>Así de sencillo.</p>
          <div class="phase-progress">
            <div class="phase-label"><span id="phase-label">UN AJUSTE PARA EMPEZAR</span><span id="phase-total"></span></div>
            <div class="phase-dots" id="phase-dots" aria-hidden="true"></div>
          </div>
        </aside>

        <div class="clock-column">
          <div class="clock-wrap" id="clock-wrap">
            <svg class="clock" id="clock" viewBox="0 0 400 400" role="img" aria-label="Reloj desajustado. La manecilla está en las diez.">
              <circle class="clock-face" cx="200" cy="200" r="187"/>
              <circle class="inner-ring" cx="200" cy="200" r="177"/>
              <g>${ticks}</g>
              <path class="target-notch" d="M200 3v8"/>
              <text class="clock-number twelve" x="200" y="79">12</text>
              <text class="clock-number" x="328" y="207">3</text>
              <text class="clock-number" x="200" y="336">6</text>
              <text class="clock-number" x="72" y="207">9</text>
              <line class="fixed-hand" x1="200" y1="210" x2="200" y2="101"/>
              <g id="active-hand" class="active-hand" style="transform: rotate(-60deg)">
                <line id="hand-line" class="hand-line" x1="200" y1="218" x2="200" y2="112"/>
                <circle class="hand-end" id="hand-end" cx="200" cy="112" r="2.7"/>
              </g>
              <circle class="center-outer" cx="200" cy="200" r="8"/>
              <circle class="center-inner" cx="200" cy="200" r="2.5"/>
            </svg>
            <div class="paused-cover" id="paused-cover" hidden><span>${icon('pause')}</span><p>Un pequeño respiro.</p></div>
          </div>
          <div class="clock-caption" id="clock-caption"><span class="caption-dot"></span><span id="feedback">Todo empieza con un toque.</span></div>
        </div>

        <aside class="timer-info">
          <div class="section-label" id="timer-label">TU TIEMPO</div>
          <div class="timer" id="timer" aria-label="10 segundos"><span id="timer-whole">10</span><span class="timer-fraction" id="timer-fraction">,0</span><span class="timer-unit">s</span></div>
          <div class="time-track" role="progressbar" id="time-progress" aria-label="Tiempo restante" aria-valuemin="0" aria-valuemax="10" aria-valuenow="10"><span id="time-fill"></span></div>
          <p id="timer-note">Respira. El tiempo empieza<br>cuando tú decidas.</p>
          <div class="round-label"><span class="round-dot"></span><span id="round-label">TANDA 01</span><span class="round-divider">/</span><span>03</span></div>
        </aside>
      </section>

      <div class="action-area">
        <button class="primary-button" id="main-action"><span>Empezar a jugar</span>${icon('arrow')}</button>
        <button class="restart-button" id="restart-button" hidden>${icon('reset')} Empezar de cero</button>
        <p class="action-note" id="action-note">Diez segundos. Tú y el reloj.</p>
      </div>

      <div class="control-hints" aria-hidden="true">
        <span>${icon('left')}<span>IZQUIERDA<span class="hint-detail"> · ANTIHORARIO</span></span><kbd>←</kbd></span>
        <span class="control-center">dos lados, un mismo destino</span>
        <span><kbd>→</kbd><span>DERECHA<span class="hint-detail"> · HORARIO</span></span>${icon('right')}</span>
      </div>

      <section class="journey" aria-label="Progreso de la tanda">
        <div class="journey-header"><span>EL CAMINO A LAS DOCE</span><span id="best-label">TU MEJOR MARCA <b>${pad(best)}</b><span class="best-denominator"> / 270</span></span></div>
        <div class="stage-list">
          ${STAGES.map((stage, i) => `<div class="stage-card ${i === 0 ? 'current' : ''}" data-stage="${i}"><span class="stage-index">0${i + 1}</span><div class="stage-card-text"><h3>${stage[0].toUpperCase() + stage.slice(1)}</h3><p>30 fases <span>· ${['Encuentra el ritmo', 'Afina tu precisión', 'Confía en tu pulso'][i]}</span></p></div><span class="stage-card-status">${i === 0 ? '<span class="status-dot"></span>' : '—'}</span><span class="stage-line"></span></div>`).join('')}
        </div>
      </section>
    </main>

    <footer class="site-footer"><span>EL TIEMPO VUELA. TÚ MARCAS EL RITMO.</span><span class="footer-mark">sin prisa, hasta que la haya<span>.</span></span></footer>
    <p class="sr-only" id="announcer" role="status" aria-live="polite" aria-atomic="true"></p>
  </div>

  <dialog id="help-dialog" aria-labelledby="help-title">
    <button class="icon-button close-dialog" id="close-help" aria-label="Cerrar instrucciones">${icon('close')}</button>
    <div class="eyebrow"><span class="accent-dot"></span>ASÍ SE JUEGA</div>
    <h2 id="help-title">Un reloj.<br>Dos <em>direcciones.</em></h2>
    <p class="help-intro">Lleva la manecilla coral a las 12 antes de que se agote el tiempo.</p>
    <div class="help-controls"><div>${icon('left')}<strong>Mitad izquierda</strong><span>Gira hacia atrás</span><kbd>←</kbd></div><div>${icon('right')}<strong>Mitad derecha</strong><span>Gira hacia delante</span><kbd>→</kbd></div></div>
    <ol class="help-steps"><li><span>01</span><p><strong>Primero, un pequeño ensayo.</strong> Tienes 10 segundos para encontrar las doce.</p></li><li><span>02</span><p><strong>Horas, minutos y segundos.</strong> 30 fases por etapa. Cada fase tiene su propio reloj: empieza en 15 segundos y el límite se va reduciendo.</p></li><li><span>03</span><p><strong>Tres tandas. Un poco más de pulso.</strong> La última fase de cada etapa baja a 7, 5 y 3 segundos según la tanda. Al cambiar de etapa, vuelves a 15.</p></li></ol>
    <p class="help-tip">Puedes pausar cuando quieras con el botón o la barra espaciadora. Si se acaba el tiempo, repite la fase sin perder tu avance.</p>
    <button class="primary-button" id="understood"><span>Ya lo tengo</span>${icon('arrow')}</button>
  </dialog>
`;

const $ = (id) => document.getElementById(id);
const nodes = Object.fromEntries(['main-title', 'eyebrow-text', 'intro-description', 'tap-zones', 'stage-label', 'stage-heading', 'stage-description', 'phase-label', 'phase-total', 'phase-dots', 'clock', 'active-hand', 'hand-line', 'hand-end', 'clock-wrap', 'clock-caption', 'feedback', 'timer', 'timer-whole', 'timer-fraction', 'time-fill', 'time-progress', 'timer-note', 'round-label', 'main-action', 'action-note', 'restart-button', 'paused-cover', 'announcer'].map(id => [id, $(id)]));

function tone(kind = 'tap') {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(kind === 'success' ? 740 : kind === 'lost' ? 180 : 440, now);
    if (kind === 'success') oscillator.frequency.exponentialRampToValueAtTime(1108, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch { /* Sound is optional on browsers without Web Audio. */ }
}

function updateSound() {
  $('sound-button').innerHTML = icon(soundOn ? 'sound' : 'muted');
  $('sound-button').setAttribute('aria-pressed', String(soundOn));
  $('sound-button').setAttribute('aria-label', soundOn ? 'Desactivar sonido' : 'Activar sonido');
}

function updateTimer() {
  const display = (Math.ceil(game.remaining * 10) / 10).toFixed(1).split('.');
  nodes['timer-whole'].textContent = display[0];
  nodes['timer-fraction'].textContent = `,${display[1]}`;
  nodes.timer.setAttribute('aria-label', `${display[0]},${display[1]} segundos`);
  nodes['time-fill'].style.transform = `scaleX(${game.remaining / game.budget})`;
  nodes['time-progress'].setAttribute('aria-valuenow', game.remaining.toFixed(1));
  nodes['time-progress'].setAttribute('aria-valuemax', game.budget.toFixed(1));
  nodes.timer.classList.toggle('urgent', game.remaining <= 3 && game.status !== 'ready');
}

function updateClock() {
  const length = [88, 116, 134][game.stage];
  nodes['active-hand'].style.transform = `rotate(${game.rotation}deg)`;
  nodes['hand-line'].setAttribute('y2', 200 - length);
  nodes['hand-end'].setAttribute('cy', 200 - length);
  nodes.clock.classList.toggle('second-hand', game.stage === 2);
  const unit = ['hora', 'minuto', 'segundo'][game.stage];
  nodes.clock.setAttribute('aria-label', `Manecilla en ${unit} ${game.position}. Objetivo: las doce. ${game.status === 'cleared' ? 'Ajustado.' : ''}`);
}

function recordBest() {
  if (game.completed <= best) return;
  best = game.completed;
  storage.set('best', best);
  $('best-label').innerHTML = `TU MEJOR MARCA <b>${pad(best)}</b><span class="best-denominator"> / 270</span>`;
}

function render() {
  const { status, tutorial, stage, phase, round } = game;
  const active = status === 'playing';
  const atRest = status === 'ready';
  document.body.dataset.state = status;
  nodes['tap-zones'].hidden = !active;
  nodes['paused-cover'].hidden = status !== 'paused';
  nodes['clock-wrap'].classList.toggle('is-success', status === 'cleared' || status === 'won');
  nodes['clock-wrap'].classList.toggle('is-lost', status === 'lost');

  const titles = {
    ready: 'Todo a su <em>tiempo.</em>', playing: 'Encuentra las <em>doce.</em>',
    cleared: 'Justo a <em>tiempo.</em>', paused: 'El tiempo puede <em>esperar.</em>',
    lost: 'Una vuelta <em>más.</em>', won: 'Este es tu <em>momento.</em>',
  };
  nodes['main-title'].innerHTML = titles[status];
  nodes['eyebrow-text'].textContent = status === 'won' ? '270 AJUSTES. TODO EN SU SITIO.' : atRest ? 'MENOS RUIDO. MÁS MOMENTO.' : tutorial ? 'UN PEQUEÑO ENSAYO ANTES DE EMPEZAR' : `TANDA ${pad(round + 1)} · ${STAGES[stage].toUpperCase()}`;
  nodes['intro-description'].textContent = status === 'lost' ? 'A veces hace falta otro intento. Conservas tu avance.' : status === 'paused' ? 'Respira. Seguimos cuando tú quieras.' : status === 'won' ? 'Horas, minutos y segundos. Has encontrado tu ritmo.' : atRest ? 'Un reloj desajustado. Dos direcciones. Un solo destino.' : 'Toca a la izquierda para volver. A la derecha para avanzar.';
  nodes['stage-label'].textContent = tutorial ? 'PRIMER CONTACTO' : `ETAPA ${pad(stage + 1)} / 03`;
  nodes['stage-heading'].innerHTML = atRest ? 'Encuentra <br>las doce.' : ['Las horas.', 'Los minutos.', 'Los segundos.'][stage];
  nodes['stage-description'].innerHTML = [`Un toque, una hora.<br>Así de sencillo.`, 'Un toque, un minuto.<br>Un poco más de precisión.', 'Un toque, un segundo.<br>Es cuestión de pulso.'][stage];
  nodes['phase-label'].textContent = tutorial ? 'UN AJUSTE PARA EMPEZAR' : `FASE ${pad(phase)}`;
  nodes['phase-total'].textContent = tutorial ? '' : '/ 30';
  nodes['phase-dots'].innerHTML = Array.from({ length: 30 }, (_, i) => `<span class="${!tutorial && i < phase - 1 ? 'done' : !tutorial && i === phase - 1 ? 'current' : ''}"></span>`).join('');
  nodes['phase-dots'].classList.toggle('preview-dots', tutorial);
  nodes['round-label'].textContent = `TANDA ${pad(round + 1)}`;
  nodes['timer-note'].innerHTML = atRest ? 'Respira. El tiempo empieza<br>cuando tú decidas.' : status === 'lost' ? 'No pasa nada.<br>Vuelve a encontrar tu ritmo.' : status === 'paused' ? 'Tu tiempo está a salvo.<br>No hay ninguna prisa.' : tutorial ? 'Tu primer ajuste.<br>El resto llega después.' : `De 15 a ${FLOORS[round]} segundos.<br>Cada fase, un poco menos.`;

  const feedback = { ready: 'Todo empieza con un toque.', playing: tutorial ? 'Lleva la manecilla coral a las 12.' : 'Cada toque te acerca.', cleared: tutorial ? 'Eso es. Ya tienes el ritmo.' : phase === 30 ? 'Etapa completada. Respira.' : 'Las doce. Todo en su sitio.', paused: 'Un momento para ti.', lost: 'El reloj te da otra oportunidad.', won: 'No sobra ni un segundo.' };
  nodes.feedback.textContent = feedback[status];
  nodes['clock-caption'].classList.toggle('positive', status === 'cleared' || status === 'won');
  const actions = { ready: ['Empezar a jugar', 'arrow'], playing: ['Pausar', 'pause'], cleared: ['Justo a tiempo', 'arrow'], paused: ['Seguir jugando', 'play'], lost: ['Repetir esta fase', 'reset'], won: ['Volver a jugar', 'reset'] };
  nodes['main-action'].innerHTML = `<span>${actions[status][0]}</span>${icon(actions[status][1])}`;
  nodes['main-action'].classList.toggle('secondary-button', active || status === 'cleared');
  nodes['main-action'].disabled = status === 'cleared';
  nodes['restart-button'].hidden = !['paused', 'lost'].includes(status);
  nodes['action-note'].textContent = atRest ? 'Diez segundos. Tú y el reloj.' : active ? 'También puedes usar ← y → · Espacio para pausar' : status === 'lost' ? 'Mismo reto. Una nueva oportunidad.' : status === 'paused' ? 'Tu avance sigue aquí.' : status === 'won' ? `${game.taps} toques para encontrar tu momento.` : tutorial ? 'Empezamos con las horas. 15 segundos.' : 'Un respiro y seguimos.';

  document.querySelectorAll('.stage-card').forEach((card, i) => {
    const done = i < stage || status === 'won';
    card.classList.toggle('current', i === stage && status !== 'won');
    card.classList.toggle('completed', done);
    card.setAttribute('aria-current', i === stage ? 'step' : 'false');
    card.querySelector('.stage-card-status').innerHTML = done ? '<span class="stage-check">✓</span>' : i === stage ? '<span class="status-dot"></span>' : '—';
    card.querySelector('.stage-line').style.transform = `scaleX(${done ? 1 : i === stage && !tutorial ? (phase - 1 + (status === 'cleared' ? 1 : 0)) / 30 : 0})`;
  });
  updateClock();
  updateTimer();
  recordBest();
}

function announce(message) { nodes.announcer.textContent = message; }

function scheduleAdvance() {
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    if (game.status !== 'cleared') return;
    const previousStage = game.stage;
    const previousRound = game.round;
    const wasTutorial = game.tutorial;
    advanceGame(game, performance.now());
    render();
    if (game.status === 'won') {
      tone('success');
      announce('Has completado las tres tandas y los 270 ajustes. Puedes volver a jugar.');
      nodes['main-action'].focus({ preventScroll: true });
    } else {
      announce(`${wasTutorial || previousStage !== game.stage || previousRound !== game.round ? `Etapa ${STAGES[game.stage]}. ` : ''}Fase ${game.phase} de 30. ${game.budget.toFixed(1)} segundos.`);
    }
  }, game.tutorial || game.phase === 30 ? 1200 : 620);
}

function tap(direction) {
  if ($('help-dialog').open) return;
  const previousStatus = game.status;
  if (!moveGame(game, direction, performance.now())) {
    if (previousStatus !== game.status) handleLoss();
    return;
  }
  updateClock();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes['clock-wrap'].animate([{ transform: 'scale(1)' }, { transform: 'scale(.976)' }, { transform: 'scale(1)' }], { duration: 190, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
  if (game.status === 'cleared') {
    tone('success');
    try { navigator.vibrate?.(15); } catch { /* Haptics are optional. */ }
    render();
    announce('Reloj ajustado. Las doce.');
    scheduleAdvance();
  } else tone();
}

function handleLoss() {
  clearTimeout(advanceTimer);
  tone('lost');
  render();
  announce('Se acabó el tiempo. Puedes repetir esta fase sin perder tu avance.');
  nodes['main-action'].focus({ preventScroll: true });
}

function pause() {
  pauseGame(game, performance.now());
  clearTimeout(advanceTimer);
  render();
  announce(game.status === 'lost' ? 'Se acabó el tiempo.' : 'Juego en pausa.');
}

function mainAction() {
  if (['ready', 'won'].includes(game.status)) {
    startGame(game, performance.now());
    tone();
    announce('Ensayo. Tienes diez segundos. Lleva la manecilla a las doce.');
  } else if (game.status === 'playing') {
    pause();
    return;
  } else if (game.status === 'paused') {
    resumeGame(game, performance.now());
    if (game.status === 'cleared') scheduleAdvance();
  } else if (game.status === 'lost') {
    retryPhase(game, performance.now());
    announce(`Repetimos la fase. ${game.budget.toFixed(1)} segundos.`);
  }
  render();
}

nodes['main-action'].addEventListener('click', mainAction);
nodes['restart-button'].addEventListener('click', () => {
  clearTimeout(advanceTimer);
  Object.assign(game, createGame());
  render();
  nodes['main-action'].focus({ preventScroll: true });
});

for (const [id, direction] of [['tap-left', -1], ['tap-right', 1]]) {
  $(id).addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    event.preventDefault();
    tap(direction);
  });
  // Keyboard and assistive-technology activations do not emit pointerdown.
  $(id).addEventListener('click', (event) => { if (event.detail === 0) tap(direction); });
}

// The whole screen is a control surface, apart from explicit interface buttons.
document.addEventListener('pointerdown', (event) => {
  if (game.status !== 'playing' || $('help-dialog').open || event.isPrimary === false || event.button !== 0) return;
  if (event.target.closest('button, a, dialog')) return;
  tap(event.clientX < window.innerWidth / 2 ? -1 : 1);
});

$('sound-button').addEventListener('click', () => {
  soundOn = !soundOn;
  storage.set('sound', soundOn);
  updateSound();
  if (soundOn) tone('success');
});

function openHelp() {
  helpPaused = ['playing', 'cleared'].includes(game.status);
  if (helpPaused) pause();
  $('help-dialog').showModal();
}
function closeHelp() { $('help-dialog').close(); }
$('help-button').addEventListener('click', openHelp);
$('close-help').addEventListener('click', closeHelp);
$('understood').addEventListener('click', closeHelp);
$('help-dialog').addEventListener('click', (event) => {
  if (event.target !== $('help-dialog')) return;
  const rect = $('help-dialog').getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeHelp();
});
$('help-dialog').addEventListener('close', () => {
  if (helpPaused) {
    // Resume explicitly, so closing instructions never starts a surprise countdown.
    nodes['main-action'].focus({ preventScroll: true });
    helpPaused = false;
  }
});

document.addEventListener('keydown', (event) => {
  if ($('help-dialog').open || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    tap(event.key === 'ArrowLeft' ? -1 : 1);
  } else if (event.code === 'Space' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') {
    event.preventDefault();
    if (!event.repeat) mainAction();
  } else if (event.key === 'Escape' && ['playing', 'cleared'].includes(game.status)) pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['playing', 'cleared'].includes(game.status)) pause();
});

function frame() {
  if (game.status === 'playing') {
    tickGame(game, performance.now());
    if (game.status === 'lost') handleLoss();
    else updateTimer();
  }
  requestAnimationFrame(frame);
}
updateSound();
render();
requestAnimationFrame(frame);
