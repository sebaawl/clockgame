import './style.css';
import {
  createGame, startGame, tickGame, moveGame, advanceGame,
  pauseGame, resumeGame, retryPhase, STAGES,
} from './game.js';

const SUCCESS_MS = 1000;
const game = createGame();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let advanceTimer;
let advanceAt = 0;
let transitionRemaining = SUCCESS_MS;
let glowAnimation;
let bumpAnimation;

const ticks = Array.from({ length: 12 }, (_, i) => `
  <line x1="160" y1="35" x2="160" y2="${i % 3 === 0 ? 48 : 42}"
    transform="rotate(${i * 30} 160 160)" class="tick" />
`).join('');

document.querySelector('#app').innerHTML = `
  <main class="game" aria-label="clocking">
    <h1 class="sr-only">clocking</h1>
    <p class="sr-only" id="instructions">Lleva la manecilla a las doce. Toca la mitad izquierda para girar hacia atrás y la derecha para avanzar. El primer toque empieza la partida. Toca el contador para pausar. Si se acaba el tiempo, toca para repetir la fase. También puedes usar las flechas y la barra espaciadora.</p>
    <div id="success-glow" class="success-glow" aria-hidden="true"></div>
    <button id="timer" class="timer" aria-describedby="instructions" aria-label="10 segundos. Toca para empezar."><span id="time">10.0</span></button>
    <div class="clock-wrap" id="clock-wrap">
      <svg id="clock" class="clock" viewBox="0 0 320 320" role="img" aria-label="Reloj analógico. Objetivo: las doce.">
        <circle class="clock-face" cx="160" cy="160" r="144" />
        <g class="ticks">${ticks}</g>
        <line class="fixed-hand" x1="160" y1="160" x2="160" y2="76" />
        <g id="active-hand" class="active-hand">
          <line id="hand-line" class="hand-line" x1="160" y1="171" x2="160" y2="103" />
        </g>
        <circle class="center" cx="160" cy="160" r="6" />
      </svg>
    </div>
    <div class="controls" aria-label="Controles del reloj">
      <button id="tap-left" class="tap-zone" aria-label="Girar en sentido antihorario" aria-describedby="instructions"></button>
      <button id="tap-right" class="tap-zone" aria-label="Girar en sentido horario" aria-describedby="instructions"></button>
    </div>
    <p class="sr-only" id="announcer" role="status" aria-live="polite" aria-atomic="true"></p>
  </main>
`;

const timer = document.getElementById('timer');
const time = document.getElementById('time');
const clock = document.getElementById('clock');
const clockWrap = document.getElementById('clock-wrap');
const hand = document.getElementById('active-hand');
const handLine = document.getElementById('hand-line');
const glow = document.getElementById('success-glow');
const announcer = document.getElementById('announcer');

function announce(message) {
  announcer.textContent = message;
}

function displayTime() {
  time.textContent = (Math.ceil(game.remaining * 10) / 10).toFixed(1);
  const action = game.status === 'playing' ? 'Toca para pausar.'
    : game.status === 'paused' ? 'En pausa. Toca para continuar.'
    : game.status === 'lost' ? 'Toca para repetir la fase.'
    : game.status === 'won' ? 'Partida completada. Toca para volver a jugar.'
    : game.status === 'ready' ? 'Toca para empezar.' : 'Reloj ajustado.';
  timer.setAttribute('aria-label', `${time.textContent.replace('.', ',')} segundos. ${action}`);
}

function render() {
  document.body.dataset.state = game.status;
  document.body.dataset.stage = STAGES[game.stage];
  document.body.dataset.phase = String(game.phase);
  document.body.dataset.round = String(game.round + 1);
  hand.style.transform = `rotate(${game.rotation}deg)`;
  handLine.setAttribute('y2', [103, 83, 65][game.stage]);
  handLine.style.strokeWidth = [6, 5, 3.5][game.stage];
  clock.setAttribute('aria-label', `Manecilla en ${['hora', 'minuto', 'segundo'][game.stage]} ${game.position}. Objetivo: las doce. ${game.status === 'cleared' ? 'Reloj ajustado.' : ''}`);
  displayTime();
}

function prepareReadyGame() {
  clearTimeout(advanceTimer);
  glowAnimation?.cancel();
  startGame(game, performance.now());
  // Show the actual starting position without consuming the introduction timer.
  game.status = 'ready';
  transitionRemaining = SUCCESS_MS;
  render();
}

function begin() {
  game.status = 'playing';
  game.deadline = performance.now() + game.remaining * 1000;
  announce('Diez segundos. Lleva el reloj a las doce.');
}

function positionGlow() {
  const rect = clockWrap.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  glow.style.left = `${x}px`;
  glow.style.top = `${y}px`;
  glow.style.width = `${radius * 3.2}px`;
  glow.style.height = `${radius * 3.2}px`;
}

function celebrate() {
  positionGlow();
  glowAnimation?.cancel();
  const frames = reducedMotion.matches ? [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
    { opacity: 0.12, transform: 'translate(-50%, -50%) scale(1)', offset: 0.4 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
  ] : [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.03)' },
    { opacity: 0.85, transform: 'translate(-50%, -50%) scale(0.55)', offset: 0.38 },
    { opacity: 0.55, transform: 'translate(-50%, -50%) scale(1)', offset: 0.7 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.1)' },
  ];
  glowAnimation = glow.animate(frames, {
    duration: SUCCESS_MS,
    easing: 'cubic-bezier(.2,.55,.3,1)',
  });
  transitionRemaining = SUCCESS_MS;
  scheduleAdvance();
}

function scheduleAdvance() {
  clearTimeout(advanceTimer);
  advanceAt = performance.now() + transitionRemaining;
  advanceTimer = setTimeout(() => {
    if (game.status !== 'cleared') return;
    glowAnimation?.cancel();
    const wasTutorial = game.tutorial;
    const oldStage = game.stage;
    const oldRound = game.round;
    advanceGame(game, performance.now());
    render();
    if (game.status === 'won') announce('Has completado las 270 fases. Toca para volver a jugar.');
    else announce(`${wasTutorial || oldStage !== game.stage || oldRound !== game.round ? `Tanda ${game.round + 1}. ${STAGES[game.stage]}. ` : ''}Fase ${game.phase} de 30. ${game.budget.toFixed(1)} segundos.`);
  }, transitionRemaining);
}

function bump() {
  if (reducedMotion.matches) return;
  bumpAnimation?.cancel();
  bumpAnimation = clockWrap.animate([
    { transform: 'translate(-50%, -50%) scale(1)' },
    { transform: 'translate(-50%, -50%) scale(.955)', offset: 0.35 },
    { transform: 'translate(-50%, -50%) scale(1)' },
  ], { duration: 170, easing: 'cubic-bezier(.2,.8,.3,1)' });
}

function lose() {
  clearTimeout(advanceTimer);
  render();
  announce('Se acabó el tiempo. Toca cualquier mitad para repetir esta fase.');
}

function pause() {
  if (!['playing', 'cleared'].includes(game.status)) return;
  if (game.status === 'cleared') {
    transitionRemaining = Math.max(0, advanceAt - performance.now());
    glowAnimation?.pause();
  }
  pauseGame(game, performance.now());
  clearTimeout(advanceTimer);
  render();
  announce(game.status === 'lost' ? 'Se acabó el tiempo. Toca para reintentar.' : 'En pausa. Toca para continuar.');
}

function resume() {
  resumeGame(game, performance.now());
  if (game.status === 'cleared') {
    glowAnimation?.play();
    scheduleAdvance();
  }
  render();
}

function tap(direction) {
  if (game.status === 'paused') {
    resume();
    return;
  }
  if (game.status === 'won') prepareReadyGame();
  if (game.status === 'ready') begin();
  if (game.status === 'lost') retryPhase(game, performance.now());
  const before = game.status;
  if (!moveGame(game, direction, performance.now())) {
    if (before !== game.status) lose();
    return;
  }
  bump();
  render();
  if (game.status === 'cleared') {
    announce('Las doce.');
    celebrate();
  }
}

function togglePause() {
  if (game.status === 'paused') resume();
  else if (['playing', 'cleared'].includes(game.status)) pause();
  else if (game.status === 'ready') { begin(); render(); }
  else if (game.status === 'lost') { retryPhase(game, performance.now()); render(); }
  else if (game.status === 'won') prepareReadyGame();
}

for (const [id, direction] of [['tap-left', -1], ['tap-right', 1]]) {
  const zone = document.getElementById(id);
  zone.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    event.preventDefault();
    tap(direction);
  });
  zone.addEventListener('click', (event) => {
    if (event.detail === 0) tap(direction);
  });
}

timer.addEventListener('click', togglePause);

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    tap(event.key === 'ArrowLeft' ? -1 : 1);
  } else if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) togglePause();
  } else if (event.key === 'Escape') pause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('resize', positionGlow);

function frame() {
  if (game.status === 'playing') {
    tickGame(game, performance.now());
    if (game.status === 'lost') lose();
    else displayTime();
  }
  requestAnimationFrame(frame);
}

prepareReadyGame();
requestAnimationFrame(frame);
