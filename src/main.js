import '@fontsource/poppins/latin-300.css';
import '@fontsource/poppins/latin-700.css';
import './style.css';
import './store.css';
import { createStore } from './store.js';
import { loadProgress, saveProgress, recordSolve, dailyGoals } from './progression.js';
import { createGame, startGame, tickGame, moveGame, advanceGame, pauseGame, resumeGame, positions, STAGES, PHASES, settleGame, consumeNitro, DIFFICULTIES, nitroCapacity } from './game.js';
import { scoreAdjustment } from './scoring.js';
import { createFeedback } from './feedback.js';
import { createNitroControl, NITRO_SPEED } from './nitro.js';
import { BACKDROP_MS, DARK_BACKDROPS, LIGHT_BACKDROPS, nextBackdrop, backdropColors } from './ambience.js';

const SUCCESS_MS = 1000;
const BREAK_MS = 3000;
const CYCLE_NAMES = ['HORA', 'MINUTO', 'SEGUNDO'];
let backdropIndex = 0;
let backdropElapsed = 0;
let lastBackdropAt = null;
const SOUND_PRESETS = ['felt', 'wood', 'clock'];
const preferences = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('clocking:preferences') || '{}');
    return { difficulty: Object.hasOwn(DIFFICULTIES, saved.difficulty) ? saved.difficulty : 'easy', format: saved.format === 'survival' ? 'survival' : 'classic', flash: saved.flash !== false, successSound: saved.successSound !== false, soundPreset: SOUND_PRESETS.includes(saved.soundPreset) ? saved.soundPreset : 'felt', sound: saved.sound !== false, vibration: saved.vibration !== false, theme: saved.theme === 'light' ? 'light' : 'dark', mode: saved.mode === 'hard' ? 'hard' : 'normal' };
  } catch { return { difficulty: 'easy', format: 'classic', flash: true, successSound: true, soundPreset: 'felt', sound: true, vibration: true, theme: 'dark', mode: 'normal' }; }
})();
const feedback = createFeedback(() => preferences);
const game = createGame();
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const progress = loadProgress(storage);
try {
  for (const format of ['classic', 'survival']) for (const mode of ['normal', 'hard']) progress.best = Math.max(progress.best, Number(localStorage.getItem(`clocking:best:${format}:${mode}`)) || 0);
} catch {}
let selectedDifficulty = preferences.difficulty;
let runCosmetic = progress.cosmetic;
let paintedCosmetic;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let selectedMode = preferences.mode;
let selectedFormat = preferences.format;
let nitroRunning = false;
let nitroDirection = 1;
let lastWarning = -Infinity;
let dangerAnnounced = false;
let advanceTimer;
let advanceAt = 0;
let transitionRemaining = SUCCESS_MS;
let glowAnimation;
let bumpAnimation;
let breakTimer;
let breakAt = 0;
let breakRemaining = BREAK_MS;
let points = 0;
let streak = 0;
let attemptTaps = 0;
let optimalSteps = 1;
let lossStarted = false;
let comboAnimation;
let resumeAfterSettings = false;
let settingsMotion;
let settingsCloseTimer;
let needsControlGuide = false;
let launchTimer;
let launchAnimation;

const ticks = Array.from({ length: 12 }, (_, i) => `<line x1="160" y1="35" x2="160" y2="${i % 3 === 0 ? 48 : 42}" transform="rotate(${i * 30} 160 160)" class="tick" />`).join('');
const gear = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3.4-1.2 1.8v3l1.2 1.8-2 3.4-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3.4L4.2 12V9L3 7.2l2-3.4L7 4Z" transform="translate(0 1)"/><circle cx="12" cy="12" r="3.1"/></svg>';

const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const homeIcon = icon('<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7"/>');
const restartIcon = icon('<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>');
let selectorMotion;
let descriptionMotion;

document.querySelector('#app').innerHTML = `
  <main class="game" aria-label="clocking">
    <p class="sr-only" id="instructions">Lleva el reloj a las doce con las mitades izquierda y derecha de la pantalla. El botón de ajustes pausa la partida. Espacio también pausa. Mantén 0,15 segundos para activar Nitro y suelta en las doce; no se detiene automáticamente. En el recorrido contraintuitivo solo cuenta completar el camino largo.</p>
    <div id="success-glow" class="success-glow" aria-hidden="true"></div>
    <div class="hud" id="hud"><div class="hud-row">
      <div id="cycle-label" class="cycle-label">HORA</div>
      <button id="timer" class="timer" aria-describedby="instructions"><span id="time">15.0</span></button>
      <button id="settings-button" class="settings-trigger" aria-label="Abrir ajustes" type="button">${gear}</button>
    </div></div>
    <div class="score-panel" id="score-panel"><output id="score" aria-label="Puntaje: 0">0</output><span class="points-label">${gear} PUNTOS</span></div>
    <div class="clock-wrap" id="clock-wrap">
      <svg id="clock" class="clock" viewBox="0 0 320 320" role="img" aria-label="Reloj analógico. Objetivo: las doce.">
        <circle class="clock-face" cx="160" cy="160" r="144" /><rect class="square-face" x="16" y="16" width="288" height="288" rx="48"/><circle class="inner-face" cx="160" cy="160" r="129"/>
        <g class="ticks">${ticks}</g>
        <g id="nitro-trail" class="nitro-trail" aria-hidden="true">${[1, 2, 3].map(i => `<g id="trail-${i}" class="trail-mark"><line x1="160" y1="160" x2="160" y2="103"/></g>`).join('')}</g>
        <line class="fixed-hand" x1="160" y1="160" x2="160" y2="76" />
        <g id="active-hand" class="active-hand"><line id="hand-line" class="hand-line" x1="160" y1="171" x2="160" y2="103" /></g>
        <circle class="center" cx="160" cy="160" r="8" />
      </svg>
    </div>
    <div id="resources" class="resources" hidden>
      <div class="resource-labels"><span id="combo" class="combo-count" aria-label="Combo: 0">×0</span><span>NITRO <output id="nitro-value">40%</output></span></div>
      <div id="nitro-meter" class="nitro-meter" role="progressbar" aria-label="Carga de Nitro" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40"><span id="nitro-fill"></span></div>
      <span id="nitro-message" class="nitro-message" aria-live="polite"></span>
    </div>
    <div class="controls" id="controls" aria-label="Controles del reloj">
      <button id="tap-left" class="tap-zone" aria-label="Girar en sentido antihorario" aria-describedby="instructions"></button>
      <button id="tap-right" class="tap-zone" aria-label="Girar en sentido horario" aria-describedby="instructions"></button>
    </div>
    <div id="control-guide" class="control-guide" hidden aria-hidden="true">
      <div class="guide-half guide-left"><div class="guide-control"><span class="guide-arrow"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="24" cy="24" r="20" class="guide-clock-face"/><g class="guide-clock-hand"><path d="M24 27V10"/></g><circle cx="24" cy="24" r="2.8" fill="currentColor" stroke="none"/></svg></span></div></div>
      <div class="guide-half guide-right"><div class="guide-control"><span class="guide-arrow"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="24" cy="24" r="20" class="guide-clock-face"/><g class="guide-clock-hand"><path d="M24 27V10"/></g><circle cx="24" cy="24" r="2.8" fill="currentColor" stroke="none"/></svg></span></div></div>
      <div id="guide-best" class="guide-best"><span>RÉCORD</span><strong>0</strong></div>
    </div>
    <section id="start-menu" class="start-menu" aria-labelledby="start-title">
      <div class="start-content">
        <p class="menu-kicker">ELIGE EL MODO</p><h1 id="start-title">clocking</h1>
        <div class="format-options" role="group" aria-label="Tipo de partida"><button id="format-classic" class="format-option" aria-pressed="true" type="button">Clásico</button><button id="format-survival" class="format-option" aria-pressed="false" type="button">Supervivencia</button></div>
        <div class="difficulty-picker" role="group" aria-label="Dificultad"><span class="difficulty-marker"></span>${Object.entries(DIFFICULTIES).map(([id, d]) => `<button data-difficulty="${id}" type="button" aria-pressed="false">${d.name}</button>`).join('')}</div>
        <div class="mode-options" role="group" aria-label="Recorrido">
          <svg id="mode-selector" class="mode-selector" aria-hidden="true"><rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="12" pathLength="100"/></svg>
          <button id="mode-normal" class="mode-option" type="button" aria-pressed="true"><strong>Normal</strong><span>Gira hasta las doce.</span></button>
          <button id="mode-hard" class="mode-option" type="button" aria-pressed="false"><strong>Contraintuitivo</strong><span>Ve por el camino largo.</span></button>
        </div>
        <p id="mode-description" class="mode-description">15 segundos. Encuentra las doce.</p>
        <div id="menu-best" class="menu-best"><span>RÉCORD</span><strong>0</strong></div><button id="start-game" class="primary-action" type="button">Jugar</button><div class="progress-actions"><button id="open-store" type="button">Tienda <span id="menu-coins">0</span></button><button id="open-daily" type="button">${gear} Metas <span id="daily-ready"></span></button></div><p class="equipped-note" id="equipped-note"></p>
      </div>
    </section>
    <div class="intermission" id="intermission" hidden role="status" aria-live="polite" aria-atomic="true"><div class="break-copy"><p id="break-kicker" class="break-kicker">COMENZAMOS</p><p id="break-title" class="break-title">HORA</p><p id="break-detail" class="break-detail">FASE 1</p></div></div>
    <section id="game-over" class="game-over" hidden aria-label="Fin de la partida"><div id="result-panel" class="result-panel">
      <p class="result-kicker" id="result-kicker">SE ACABÓ EL TIEMPO</p><h2 id="result-title">Se te pasó<br>la hora.</h2>
      <output id="final-score" class="final-score" aria-label="Puntaje final">0</output><p class="result-unit">${gear} PUNTOS</p><p id="result-mode" class="result-mode">NORMAL</p><p id="best-score" class="best-score"></p>
      <button id="restart-game" class="primary-action" type="button">Reintentar</button><button id="result-daily" class="text-action" type="button">Metas diarias</button><button id="change-mode" class="text-action" type="button">Cambiar modo</button>
    </div></section>
    <div id="combo-celebration" class="combo-celebration" hidden aria-hidden="true"><span>COMBO</span><strong id="combo-big">5×</strong></div>
    <p class="sr-only" id="announcer" role="status" aria-live="polite" aria-atomic="true"></p>
  </main>
  <dialog id="settings" class="settings" aria-labelledby="settings-title">
    <div class="sheet-handle" aria-hidden="true"></div>
    <div class="settings-heading"><h2 id="settings-title">Ajustes</h2></div>
    <p class="settings-note">Tu tiempo está en pausa.</p>
    <label class="setting-row" for="setting-sound"><span><strong>Sonido</strong></span><input id="setting-sound" type="checkbox" role="switch"></label>
    <label class="setting-row" for="setting-success"><span><strong>Sonido de acierto</strong></span><input id="setting-success" type="checkbox" role="switch"></label>
    <label class="setting-row" for="setting-flash"><span><strong>Destello de acierto</strong></span><input id="setting-flash" type="checkbox" role="switch"></label>
    <fieldset class="sound-picker"><legend>Sonido del reloj</legend><div class="sound-options" role="group" aria-label="Sonido del reloj">
      ${[['felt', 'Amortiguado'], ['wood', 'Grave'], ['clock', 'Mecánico']].map(([id, name]) => `<button class="sound-option" data-sound="${id}" aria-pressed="false" type="button">${name}</button>`).join('')}
    </div></fieldset>
    <label class="setting-row" for="setting-vibration"><span><strong>Vibración</strong></span><input id="setting-vibration" type="checkbox" role="switch"></label>
    <label class="setting-row" for="setting-light"><span><strong>Modo claro</strong></span><input id="setting-light" type="checkbox" role="switch"></label>
    <div class="settings-actions">
      <button id="menu-settings" class="icon-action home-action" type="button" aria-label="Volver al menú" title="Volver al menú">${homeIcon}</button>
      <button id="restart-settings" class="icon-action restart-action" type="button" aria-label="Reiniciar partida" title="Reiniciar partida">${restartIcon}</button>
    </div>
    <button id="continue-game" class="primary-action continue-game" type="button">Volver al juego</button>
  </dialog>
`;

const $ = id => document.getElementById(id);
const timer = $('timer');
const time = $('time');
const clock = $('clock');
const clockWrap = $('clock-wrap');
const hand = $('active-hand');
const handLine = $('hand-line');
const glow = $('success-glow');
const settings = $('settings');
const score = $('score');
const store = createStore({ progress, storage, gear, changed: updateProgressMenu, reducedMotion, feedback });
let designer;
if (import.meta.env.VITE_DESIGNER === 'true') {
  import('./designer.js').then(({ installDesigner }) => { designer = installDesigner({ progress, storage, changed: updateProgressMenu, gear, reducedMotion, feedback }); });
}
function updateProgressMenu() {
  $('menu-coins').textContent = progress.coins.toLocaleString('es-CL');
  const ready = dailyGoals(progress).filter(goal => !goal.claimed && goal.value >= goal.target).length;
  $('daily-ready').textContent = ready ? String(ready) : '';
  $('result-daily').textContent = ready ? `Metas diarias · ${ready} por recoger` : 'Metas diarias';
  $('equipped-note').textContent = progress.boost ? `BOOST · ${{ speed: 'NITRO ×2', tank: 'DOBLE DEPÓSITO', time: 'UN RESPIRO', recharge: 'RECARGA ×2', lock: 'NITRO LOCK' }[progress.boost]}` : '';
  document.body.dataset.skin = game.status === 'menu' ? progress.cosmetic : runCosmetic;
}
function bestKey(format, mode, difficulty = selectedDifficulty) { return `clocking:best:${format}:${mode}${difficulty === 'easy' ? '' : ':' + difficulty}`; }
function chooseDifficulty(difficulty) {
  selectedDifficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'easy';
  preferences.difficulty = selectedDifficulty;
  document.querySelectorAll('button[data-difficulty]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.difficulty === selectedDifficulty)));
  document.querySelector('.difficulty-marker').style.transform = `translateX(${Object.keys(DIFFICULTIES).indexOf(selectedDifficulty) * 100}%)`;
  savePreferences(); chooseMode(selectedMode);
}
const input = createNitroControl({
  now: () => performance.now(), schedule: (fn, ms) => setTimeout(fn, ms), unschedule: clearTimeout,
  canPlay: () => game.status === 'playing' && !settings.open && !document.hidden,
  charge: () => game.nitro, spend: amount => consumeNitro(game, amount), speed: () => NITRO_SPEED[game.stage] * (game.boost === 'speed' ? 2 : 1),
  step: direction => tap(direction, { accelerated: true }), shortTap: direction => tap(direction),
  released: exact => { if (settleGame(game, performance.now(), { perfectNitro: exact })) finishAdjustment(); else render(); },
  activeChanged: (value, direction) => {
    nitroRunning = value; nitroDirection = direction;
    if (value) feedback.nitroStart(); else feedback.nitroStop();
    document.body.dataset.nitro = String(value);
    updateResources();
  }, updated: () => updateResources(),
});
function updateResources() {
  const value = Math.max(0, Math.min(nitroCapacity(game), game.nitro));
  $('nitro-value').textContent = nitroCapacity(game) === 200 ? `${Math.ceil(value - 1e-7)}/200` : `${Math.ceil(value - 1e-7)}%`;
  $('nitro-meter').setAttribute('aria-valuemax', String(nitroCapacity(game)));
  $('nitro-meter').dataset.double = String(nitroCapacity(game) === 200);
  $('nitro-meter').setAttribute('aria-valuenow', value.toFixed(1));
  $('nitro-fill').style.transform = `scaleX(${value / nitroCapacity(game)})`;
  $('combo').textContent = `×${game.combo}`;
  $('combo').setAttribute('aria-label', `Combo: ${game.combo}`);
  document.body.dataset.hot = String(game.combo >= 5);
  let message = game.status === 'cleared' ? game.perfectNitro ? 'PERFECT NITRO' : game.perfect ? 'PERFECTO' : '' : nitroRunning ? 'NITRO' : value <= 0 ? 'SIN CARGA' : '';
  if (game.boost === 'lock') message = game.nitroLocked && game.status === 'cleared' ? `LOCK · ${game.lockUses ? game.lockUses + '/3' : 'RECARGA 3'}` : game.lockCooldown > 0 ? `LOCK · FALTAN ${game.lockCooldown} AJUSTES` : `LOCK · ${game.lockUses}/3`;
  if (game.status === 'cleared' && game.format === 'survival') message += `${message ? ' · ' : ''}+${game.lastTimeGain.toFixed(1)} S`;
  if ($('nitro-message').textContent !== message) $('nitro-message').textContent = message;
}

function savePreferences() {
  try { localStorage.setItem('clocking:preferences', JSON.stringify(preferences)); } catch { /* The game also works with storage disabled. */ }
}
function announce(message) { $('announcer').textContent = message; }
function applyTheme() {
  const background = (preferences.theme === 'light' ? LIGHT_BACKDROPS : DARK_BACKDROPS)[backdropIndex];
  const colors = backdropColors(backdropIndex, preferences.theme === 'light');
  document.documentElement.style.setProperty('--accent', colors.accent);
  document.documentElement.style.setProperty('--combo-flash', colors.flash);
  document.documentElement.style.setProperty('--combo-overlay', preferences.theme === 'light' && backdropIndex !== 0 ? `hsl(${(backdropIndex - 1) * 20} 75% 70%)` : colors.flash);
  document.body.dataset.backdrop = String(backdropIndex);
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.style.setProperty('--background', background);
  document.querySelector('meta[name="theme-color"]').content = background;
}
function prepareAttempt() {
  dangerAnnounced = false; lastWarning = -Infinity;
  attemptTaps = 0;
  const count = positions(game.stage);
  optimalSteps = game.mode === 'hard' ? game.requiredSteps : Math.min(game.position, count - game.position);
}
function displayTime() {
  time.textContent = (Math.ceil(Math.max(0, game.remaining * 10 - 1e-7)) / 10).toFixed(1);
  document.body.dataset.danger = String(game.status === 'playing' && game.remaining <= 3);
  timer.setAttribute('aria-label', `${time.textContent.replace('.', ',')} segundos. ${game.status === 'paused' ? 'Toca para continuar.' : 'Toca para pausar.'}`);
}
function reveal(element, frames, duration = 380) {
  if (!reducedMotion.matches) element.animate(frames, { duration, easing: 'cubic-bezier(.2,.85,.3,1)' });
}
function syncSelector(animate = false) {
  const target = $(selectedMode === 'hard' ? 'mode-hard' : 'mode-normal');
  if (!target.offsetWidth) return;
  const selector = $('mode-selector');
  Object.assign(selector.style, { width: `${target.offsetWidth}px`, height: `${target.offsetHeight}px`, transform: `translate(${target.offsetLeft}px, ${target.offsetTop}px)` });
  if (animate && !reducedMotion.matches) {
    selectorMotion?.cancel();
    selectorMotion = selector.firstElementChild.animate([
      { strokeDasharray: '100', strokeDashoffset: 100 },
      { strokeDasharray: '100', strokeDashoffset: 0 },
    ], { duration: 500, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
}
let lastScreen;
function updateBest() {
  const mode = game.status === 'menu' ? selectedMode : game.mode;
  const format = game.status === 'menu' ? selectedFormat : game.format;
  let best = 0;
  try { best = Math.max(0, Number(localStorage.getItem(bestKey(format, mode, game.status === 'menu' ? selectedDifficulty : game.difficulty))) || 0); } catch {}
  for (const id of ['menu-best', 'guide-best']) $(id).querySelector('strong').textContent = best.toLocaleString('es-CL');
}
function render() {
  updateBest(); updateProgressMenu();
  Object.assign(document.body.dataset, { difficulty: game.difficulty, boost: game.boost || 'none', state: game.status, stage: STAGES[game.stage], phase: String(game.phase), round: String(game.round + 1), mode: game.mode, format: game.format, nitro: String(nitroRunning) });
  applyTheme();
  const inMenu = game.status === 'menu';
  const inBreak = game.status === 'break' || (game.status === 'paused' && game.resumeStatus === 'break');
  const ended = ['lost', 'won'].includes(game.status);
  $('control-guide').hidden = !['ready', 'launching'].includes(game.status);
  $('settings-button').disabled = game.status === 'launching';
  $('start-menu').hidden = !inMenu;
  $('intermission').hidden = !inBreak;
  $('hud').hidden = inBreak || ended;
  $('cycle-label').hidden = inMenu;
  timer.hidden = inMenu;
  clockWrap.hidden = inMenu || inBreak || ended;
  $('score-panel').hidden = inMenu || inBreak || ended;
  $('resources').hidden = inMenu || inBreak || ended || ['ready', 'launching'].includes(game.status);
  $('controls').hidden = inMenu || inBreak || ended;
  $('game-over').hidden = !ended;
  $('cycle-label').textContent = CYCLE_NAMES[game.stage];
  score.textContent = points.toLocaleString('es-CL');
  score.setAttribute('aria-label', `Puntaje: ${points}`);
  if (inBreak) $('break-detail').textContent = game.status === 'paused' ? 'TOCA PARA CONTINUAR' : `FASE ${game.round + 1}`;
  hand.style.transform = `rotate(${game.rotation}deg)`;
  [1, 2, 3].forEach(i => {
    $('trail-' + i).style.transform = `rotate(${game.rotation - nitroDirection * i * Math.min(8, 360 / positions(game.stage))}deg)`;
    $('trail-' + i).querySelector('line').setAttribute('y2', [103, 83, 65][game.stage]);
  });
  updateResources();
  if (paintedCosmetic !== runCosmetic) {
    clock.querySelectorAll('.tick').forEach((tick, i) => tick.setAttribute('y2', runCosmetic === 'dots' ? '35' : String(i % 3 === 0 ? 48 : 42)));
    paintedCosmetic = runCosmetic;
  }
  handLine.setAttribute('y2', [103, 83, 65][game.stage]);
  handLine.style.strokeWidth = [9, 7, 5][game.stage];
  clock.setAttribute('aria-label', `Manecilla en ${['hora', 'minuto', 'segundo'][game.stage]} ${game.position}. Objetivo: las doce. ${game.mode === 'hard' ? 'Recorrido contraintuitivo: completa el camino largo.' : ''}`);
  displayTime();
  const screen = inMenu ? 'menu' : inBreak ? 'break' : ended ? 'result' : 'game';
  if (screen !== lastScreen) {
    if (screen === 'menu') {
      requestAnimationFrame(() => syncSelector());
      reveal(document.querySelector('.start-content'), [{ opacity: 0, transform: 'translateY(18px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }]);
    }
    if (screen === 'game') {
      reveal(clock, [{ opacity: 0, transform: 'scale(.93)' }, { opacity: 1, transform: 'scale(1)' }], 420);
      reveal($('hud'), [{ opacity: 0 }, { opacity: 1 }]);
      reveal($('score-panel'), [{ opacity: 0 }, { opacity: 1 }]);
    }
    lastScreen = screen;
  }
}
function clearRun() {
  input.cancel();
  clearTimeout(launchTimer);
  launchAnimation?.cancel();
  clearTimeout(advanceTimer);
  clearTimeout(breakTimer);
  glowAnimation?.cancel();
  bumpAnimation?.cancel();
  comboAnimation?.cancel();
  $('combo-celebration').hidden = true;
  backdropIndex = 0; backdropElapsed = 0; lastBackdropAt = null;
  points = 0;
  streak = 0;
  lossStarted = false;
  transitionRemaining = SUCCESS_MS;
}
function chooseMode(mode) {
  const changed = selectedMode !== mode;
  selectedMode = mode === 'hard' ? 'hard' : 'normal';
  preferences.mode = selectedMode;
  $('mode-normal').setAttribute('aria-pressed', String(selectedMode === 'normal'));
  $('mode-hard').setAttribute('aria-pressed', String(selectedMode === 'hard'));
  $('mode-description').textContent = selectedFormat === 'survival' ? 'Gana tiempo. Supera tu récord.' : selectedMode === 'hard'
    ? 'En contra de tu intuición.'
    : `${Number((15 * DIFFICULTIES[selectedDifficulty].time).toFixed(2)).toLocaleString('es-CL')} segundos. Encuentra las doce.`;
  updateBest();
  syncSelector(changed);
  if (changed && !reducedMotion.matches) {
    descriptionMotion?.cancel();
    descriptionMotion = $('mode-description').animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, easing: 'ease-out' });
  }
  savePreferences();
}
function chooseFormat(format) {
  selectedFormat = format === 'survival' ? 'survival' : 'classic';
  preferences.format = selectedFormat;
  $('format-classic').setAttribute('aria-pressed', String(selectedFormat === 'classic'));
  $('format-survival').setAttribute('aria-pressed', String(selectedFormat === 'survival'));
  chooseMode(selectedMode);
}
function showMenu() {
  clearRun();
  Object.assign(game, createGame(), { mode: selectedMode });
  chooseFormat(selectedFormat);
  render();
}
function startRun(mode = selectedMode) {
  clearRun();
  needsControlGuide = true;
  runCosmetic = progress.cosmetic;
  startGame(game, performance.now(), Math.random, mode, selectedFormat, { difficulty: selectedDifficulty, boost: progress.boost });
  prepareAttempt();
  feedback.unlock();
  startBreak('first');
}
function positionGlow() {
  const rect = clockWrap.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  Object.assign(glow.style, { left: `${x}px`, top: `${y}px`, width: `${radius * 2 + 4}px`, height: `${radius * 2 + 4}px` });
}
function animateGlow(frames, options, color = '#ffffff') {
  glowAnimation?.cancel();
  glow.style.background = color;
  glow.dataset.combo = String(preferences.flash && !reducedMotion.matches && game.combo > 0 && game.combo % 5 === 0);
  glowAnimation = preferences.flash ? glow.animate(frames, options) : null;
}
function celebrate() {
  feedback.ui('success');
  positionGlow();
  glowAnimation?.cancel();
  const frames = reducedMotion.matches ? [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
    { opacity: 0.12, transform: 'translate(-50%, -50%) scale(1)', offset: 0.4 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
  ] : [
    { opacity: 1, transform: 'translate(-50%, -50%) scale(0)', easing: 'cubic-bezier(.2,.7,.3,1)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.65 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.72, easing: 'ease-out' },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
  ];
  const milestone = game.combo > 0 && game.combo % 5 === 0;
  animateGlow(frames, { duration: SUCCESS_MS, easing: 'linear' }, milestone && backdropIndex !== 0 ? 'var(--combo-overlay)' : '#ffffff');
  if (milestone) showCombo();
  transitionRemaining = SUCCESS_MS;
  scheduleAdvance();
}
function showCombo() {
  comboAnimation?.cancel();
  const badge = $('combo-celebration');
  $('combo-big').textContent = `${game.combo}×`;
  badge.style.color = 'var(--foreground)';
  badge.hidden = false;
  comboAnimation = badge.animate(reducedMotion.matches ? [
    { opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .8 }, { opacity: 0 },
  ] : [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(.65)', easing: 'cubic-bezier(.2,1.35,.35,1)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1.08)', offset: .24 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .36 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .78 },
    { opacity: 0, transform: 'translate(-50%, -56%) scale(.98)' },
  ], { duration: 950, easing: 'ease-out' });
  comboAnimation.onfinish = () => { badge.hidden = true; };
}
function scheduleAdvance() {
  clearTimeout(advanceTimer);
  advanceAt = performance.now() + transitionRemaining;
  advanceTimer = setTimeout(() => {
    if (game.status !== 'cleared') return;
    glowAnimation?.cancel();
    const oldStage = game.stage;
    const oldRound = game.round;
    advanceGame(game, performance.now());
    prepareAttempt();
    if (game.status === 'lost') { lose(); return; }
    if (game.status === 'won') { showResult(true); return; }
    if (game.format === 'classic' && (oldStage !== game.stage || oldRound !== game.round)) { startBreak(oldRound !== game.round ? 'phase' : 'cycle'); return; }
    render();
    announce(`Ajuste ${game.phase} de ${PHASES}. ${game.budget.toFixed(1)} segundos.`);
  }, transitionRemaining);
}
function startBreak(reason) {
  game.status = 'break';
  breakRemaining = BREAK_MS;
  $('break-kicker').textContent = reason === 'first' ? 'COMENZAMOS' : reason === 'phase' ? 'NUEVA FASE' : 'SIGUIENTE CICLO';
  $('break-title').textContent = CYCLE_NAMES[game.stage];
  render();
  announce(`Fase ${game.round + 1}. ${CYCLE_NAMES[game.stage]}. ${game.mode === 'hard' ? 'Recorrido contraintuitivo. ' : ''}Comenzamos en tres segundos.`);
  scheduleBreakEnd();
}
function scheduleBreakEnd() {
  clearTimeout(breakTimer);
  breakAt = performance.now() + breakRemaining;
  breakTimer = setTimeout(() => {
    if (game.status !== 'break') return;
    game.status = needsControlGuide ? 'ready' : 'playing';
    game.deadline = performance.now() + game.remaining * 1000;
    render();
    if (needsControlGuide) { announce('Toca la mitad izquierda para girar en sentido antihorario, o la derecha para girar en sentido horario. Tu primer toque comienza la partida. El tiempo aún no corre.'); return; }
    announce(`${CYCLE_NAMES[game.stage]}. ${game.budget.toFixed(1)} segundos.`);
  }, breakRemaining);
}
function launchRun(direction) {
  if (game.status !== 'ready') return;
  game.status = 'launching';
  needsControlGuide = false;
  feedback.tap();
  render();
  const spin = direction * 360;
  const duration = reducedMotion.matches ? 160 : 560;
  if (!reducedMotion.matches) {
    launchAnimation = clock.animate([
      { transform: 'translateY(0) rotate(0deg) scale(1)', offset: 0, easing: 'ease-out' },
      { transform: 'translateY(12px) rotate(-8deg) scale(1.04,.9)', offset: .13, easing: 'cubic-bezier(.15,.7,.3,1)' },
      { transform: `translateY(-${Math.min(innerHeight * .2, 160)}px) rotate(${spin * .55}deg) scale(1.14)`, offset: .52, easing: 'cubic-bezier(.65,0,.9,.35)' },
      { transform: `translateY(0) rotate(${spin}deg) scale(1.1,.88)`, offset: .74, easing: 'ease-out' },
      { transform: `translateY(-8px) rotate(${spin}deg) scale(.98,1.04)`, offset: .87, easing: 'ease-in-out' },
      { transform: `translateY(0) rotate(${spin}deg) scale(1)`, offset: 1 },
    ], { duration: 760 });
  } else reveal(clock, [{ opacity: .6 }, { opacity: 1 }], 160);
  launchTimer = setTimeout(() => {
    if (game.status !== 'launching') return;
    positionGlow();
    glowAnimation?.cancel();
    animateGlow(reducedMotion.matches ? [{ opacity: .1 }, { opacity: 0 }] : [
      { opacity: 1, transform: 'translate(-50%, -50%) scale(0)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .65 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
    ], { duration: 1000, easing: 'ease-out' });
    feedback.ui('impact');
    game.status = 'playing';
    game.deadline = performance.now() + game.remaining * 1000;
    render();
    announce('¡Ya! Lleva la manecilla a las doce.');
  }, duration);
}
function bump() {
  if (reducedMotion.matches) return;
  bumpAnimation?.cancel();
  bumpAnimation = clockWrap.animate([
    { transform: 'translate(-50%, -50%) scale(1)' },
    { transform: 'translate(-50%, -50%) scale(.965)', offset: 0.25 },
    { transform: 'translate(-50%, -50%) scale(1.018)', offset: 0.6 },
    { transform: 'translate(-50%, -50%) scale(1)' },
  ], { duration: 260, easing: 'ease-out' });
}
function showResult(won) {
  $('result-kicker').textContent = won ? 'TODO EN SU SITIO' : 'SE ACABÓ EL TIEMPO';
  $('result-title').innerHTML = won ? 'Justo a<br>tiempo.' : 'Se te pasó<br>la hora.';
  $('final-score').textContent = points.toLocaleString('es-CL');
  $('final-score').setAttribute('aria-label', `Puntaje final: ${points}`);
  $('result-mode').textContent = `${game.format === 'survival' ? 'SUPERVIVENCIA' : 'CLÁSICO'} · ${game.mode === 'hard' ? 'CONTRAINTUITIVO' : 'NORMAL'} · ${DIFFICULTIES[game.difficulty].name.toUpperCase()}`;
  const key = bestKey(game.format, game.mode, game.difficulty);
  let best = points;
  try { best = Math.max(points, Number(localStorage.getItem(key)) || 0); localStorage.setItem(key, String(best)); } catch {}
  $('best-score').textContent = `RÉCORD ${best.toLocaleString('es-CL')}`;
  render();
  $('restart-game').focus({ preventScroll: true });
}
function lose() {
  if (lossStarted) return;
  input.cancel();
  lossStarted = true;
  feedback.ui('loss');
  clearTimeout(advanceTimer);
  clearTimeout(breakTimer);
  glowAnimation?.cancel();
  if (settings.open) { resumeAfterSettings = false; settings.close(); }
  showResult(false);
  comboAnimation?.cancel();
  $('combo-celebration').hidden = true;
  announce(`Se acabó el tiempo. ${points} puntos. Puedes reintentar o cambiar de modo.`);
}
function pause() {
  lastBackdropAt = null;
  input.cancel();
  if (!['playing', 'cleared', 'break'].includes(game.status)) return;
  if (game.status === 'break') { breakRemaining = Math.max(0, breakAt - performance.now()); clearTimeout(breakTimer); }
  if (game.status === 'cleared') { transitionRemaining = Math.max(0, advanceAt - performance.now()); glowAnimation?.pause(); comboAnimation?.pause(); }
  pauseGame(game, performance.now());
  if (game.status === 'lost') { lose(); return; }
  clearTimeout(advanceTimer);
  render();
  announce('En pausa. Toca para continuar.');
}
function resume() {
  lastBackdropAt = null;
  resumeGame(game, performance.now());
  if (game.status === 'break') scheduleBreakEnd();
  if (game.status === 'cleared') { glowAnimation?.play(); comboAnimation?.play(); scheduleAdvance(); }
  render();
}
function finishAdjustment() {
  input.cancel();
  streak = game.combo;
  points += scoreAdjustment({ remaining: game.solveRemaining, budget: game.solveBudget, optimalSteps: game.optimalSteps, taps: game.attemptSteps, stage: game.stage, round: game.round, streak, mode: game.mode });
  recordSolve(progress, { score: points, format: game.format, perfect: game.perfect });
  saveProgress(progress, storage);
  if (!reducedMotion.matches) score.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.13)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
  render();
  announce(game.nitroLocked ? 'Nitro Lock. Las doce.' : game.perfectNitro ? 'Perfect Nitro. Las doce.' : 'Las doce.');
  celebrate();
}
function tap(direction, { accelerated = false } = {}) {
  if (settings.open) return;
  if (game.status === 'ready') { launchRun(direction); return; }
  if (game.status === 'paused') { resume(); return; }
  if (game.status !== 'playing') return;
  const previousCombo = game.combo;
  if (!moveGame(game, direction, performance.now(), { deferSolve: accelerated })) { if (game.status === 'lost') lose(); return; }
  if (previousCombo > 0 && !game.perfectRoute) {
    backdropIndex = 0; backdropElapsed = 0; lastBackdropAt = performance.now();
    applyTheme();
  }
  if (accelerated) feedback.nitroStep(game.combo); else { bump(); feedback.tap(game.combo); }
  attemptTaps += 1;
  if (game.status === 'cleared') { finishAdjustment(); return; }
  render();
  if (game.position === 0 && game.mode === 'hard' && game.hardProgress < game.requiredSteps) announce('No cuenta: debes completar el recorrido largo.');
}
function togglePause() {
  if (settings.open) return;
  feedback.ui('toggle');
  if (game.status === 'paused') resume();
  else pause();
}
function openSettings() {
  input.cancel();
  if (settings.open || ['lost', 'won', 'launching'].includes(game.status)) return;
  if (game.status === 'playing') { tickGame(game, performance.now()); if (game.status === 'lost') { lose(); return; } }
  resumeAfterSettings = ['playing', 'cleared', 'break', 'paused'].includes(game.status);
  if (['playing', 'cleared', 'break'].includes(game.status)) pause();
  if (game.status === 'lost') return;
  $('restart-settings').hidden = game.status === 'menu';
  $('menu-settings').hidden = game.status === 'menu';
  $('setting-sound').checked = preferences.sound;
  $('setting-success').checked = preferences.successSound;
  $('setting-flash').checked = preferences.flash;
  const canVibrate = typeof navigator.vibrate === 'function';
  $('setting-vibration').checked = preferences.vibration && canVibrate;
  $('setting-vibration').disabled = !canVibrate;

  $('setting-light').checked = preferences.theme === 'light';
  document.querySelector('.settings-note').textContent = game.status === 'menu' ? 'Elige un modo y pulsa Jugar cuando quieras.' : 'Tu tiempo está en pausa.';
  feedback.unlock();
  feedback.interrupt();
  feedback.ui('open');
  syncSoundOptions();
  delete settings.dataset.closing;
  settings.showModal();
  if (!reducedMotion.matches) {
    settings.querySelectorAll('.settings-heading, .settings-note, .setting-row, .sound-picker, .settings-actions, .continue-game').forEach((element, i) => {
      element.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, delay: 55 + i * 28, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.3,1)' });
    });
  }
  if (!reducedMotion.matches) settingsMotion = settings.animate([
    { transform: 'translateY(calc(100% + 24px))' }, { transform: 'translateY(0)' },
  ], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' });
}
function closeSettings() {
  if (!settings.open || settings.dataset.closing) return;
  settings.dataset.closing = 'true';
  feedback.ui('close');
  const from = getComputedStyle(settings).transform;
  settingsMotion?.cancel();
  const finish = () => { settingsMotion?.cancel(); settings.close(); delete settings.dataset.closing; };
  if (reducedMotion.matches) { finish(); return; }
  settingsMotion = settings.animate([{ transform: from }, { transform: 'translateY(calc(100% + 24px))' }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
  clearTimeout(settingsCloseTimer);
  settingsCloseTimer = setTimeout(finish, 240);
}

function syncSoundOptions() {
  document.querySelectorAll('[data-sound]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.sound === preferences.soundPreset));
  });
}
document.querySelectorAll('[data-sound]').forEach(button => button.addEventListener('click', () => {
  preferences.soundPreset = button.dataset.sound;
  savePreferences();
  syncSoundOptions();
  feedback.preview();
}));
$('open-store').addEventListener('click', () => store.open());
$('open-daily').addEventListener('click', () => store.open(true));
$('result-daily').addEventListener('click', () => store.open(true));
document.querySelectorAll('button[data-difficulty]').forEach(button => button.addEventListener('click', () => chooseDifficulty(button.dataset.difficulty)));
$('format-classic').addEventListener('click', () => chooseFormat('classic'));
$('format-survival').addEventListener('click', () => chooseFormat('survival'));
$('mode-normal').addEventListener('click', () => chooseMode('normal'));
$('mode-hard').addEventListener('click', () => chooseMode('hard'));
$('start-game').addEventListener('click', () => startRun());
$('restart-game').addEventListener('click', () => startRun(game.mode));
$('change-mode').addEventListener('click', showMenu);
$('settings-button').addEventListener('click', openSettings);
$('continue-game').addEventListener('click', closeSettings);
let menuAfterSettings = false;
$('menu-settings').addEventListener('click', () => {
  menuAfterSettings = true;
  resumeAfterSettings = false;
  closeSettings();
});
let restartAfterSettings = false;
$('restart-settings').addEventListener('click', () => {
  restartAfterSettings = true;
  resumeAfterSettings = false;
  closeSettings();
});
settings.addEventListener('cancel', event => { event.preventDefault(); closeSettings(); });
settings.addEventListener('close', () => {
  clearTimeout(settingsCloseTimer);
  if (menuAfterSettings) {
    menuAfterSettings = false;
    resumeAfterSettings = false;
    showMenu();
    return;
  }
  if (restartAfterSettings) {
    restartAfterSettings = false;
    resumeAfterSettings = false;
    startRun(game.mode);
    return;
  }
  if (resumeAfterSettings && game.status === 'paused' && !document.hidden) resume();
  resumeAfterSettings = false;
});
settings.addEventListener('click', event => {
  if (event.target !== settings) return;
  const rect = settings.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSettings();
});
$('setting-sound').addEventListener('change', event => {
  preferences.sound = event.target.checked;
  if (preferences.sound) { feedback.unlock(); feedback.ui('toggle'); } else feedback.mute();
  syncSoundOptions();
  savePreferences();
});
$('setting-flash').addEventListener('change', event => {
  preferences.flash = event.target.checked;
  if (!preferences.flash) { glowAnimation?.cancel(); glowAnimation = null; glow.dataset.combo = 'false'; $('combo-celebration').style.color = 'var(--foreground)'; }
  feedback.ui('toggle');
  savePreferences();
});
$('setting-success').addEventListener('change', event => {
  preferences.successSound = event.target.checked;
  savePreferences();
  if (preferences.successSound) feedback.success(); else feedback.ui('toggle');
});
$('setting-vibration').addEventListener('change', event => { preferences.vibration = event.target.checked; feedback.ui('toggle'); savePreferences(); });
$('setting-light').addEventListener('change', event => { preferences.theme = event.target.checked ? 'light' : 'dark'; feedback.ui('toggle'); applyTheme(); savePreferences(); });
for (const [id, direction] of [['tap-left', -1], ['tap-right', 1]]) {
  const zone = $(id);
  zone.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0) return;
    event.preventDefault();
    if (game.status === 'ready' || game.status === 'paused') { tap(direction); return; }
    if (input.press(direction, event.pointerId)) {
      try { zone.setPointerCapture(event.pointerId); } catch {}
    }
  });
  zone.addEventListener('pointerup', event => { event.preventDefault(); input.release(event.pointerId); });
  zone.addEventListener('pointercancel', event => input.release(event.pointerId, true));
  zone.addEventListener('lostpointercapture', event => input.release(event.pointerId, true));
  zone.addEventListener('click', event => { if (event.detail === 0) tap(direction); });
}
timer.addEventListener('click', togglePause);
$('intermission').addEventListener('pointerdown', event => { event.preventDefault(); if (game.status === 'paused') resume(); });
document.addEventListener('keydown', event => {
  if (settings.open || ['menu', 'lost', 'won'].includes(game.status) || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); tap(event.key === 'ArrowLeft' ? -1 : 1); }
  else if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) togglePause(); }
  else if (event.key === 'Escape') pause();
});
function pauseForBackground() {
  input.cancel();
  if (game.status === 'launching') {
    clearTimeout(launchTimer);
    launchAnimation?.cancel();
    game.status = 'ready';
    needsControlGuide = true;
    render();
  } else pause();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForBackground(); });
window.addEventListener('clocking:pause', pauseForBackground);
window.addEventListener('clocking:back', () => {
  if (designer?.panel.open) { designer.close(); return; }
  if (store.dialog.open) { store.close(); return; }
  if (settings.open) closeSettings();
  else if (['lost', 'won'].includes(game.status)) showMenu();
  else openSettings();
});
window.addEventListener('blur', pauseForBackground);
window.addEventListener('resize', () => { positionGlow(); syncSelector(); });
function updateAmbience(now) {
  const active = game.status === 'playing' || (game.format === 'survival' && game.status === 'cleared');
  if (!active) { lastBackdropAt = null; return; }
  if (lastBackdropAt !== null) backdropElapsed += Math.max(0, now - lastBackdropAt);
  lastBackdropAt = now;
  if (backdropElapsed >= BACKDROP_MS) {
    backdropElapsed %= BACKDROP_MS;
    backdropIndex = nextBackdrop(backdropIndex);
    applyTheme();
  }
}
function frame() {
  updateAmbience(performance.now());
  if (game.status === 'playing' || (game.format === 'survival' && game.status === 'cleared')) {
    tickGame(game, performance.now());
    if (game.status === 'lost') lose();
    else {
      displayTime();
      if (game.status === 'playing' && game.remaining <= 3) {
        const interval = game.remaining <= 1 ? 300 : game.remaining <= 2 ? 500 : 800;
        if (performance.now() - lastWarning >= interval) {
          feedback.warning(!dangerAnnounced);
          dangerAnnounced = true; lastWarning = performance.now();
        }
      }
    }
  }
  requestAnimationFrame(frame);
}
// Capture the press before navigation starts, including keyboard activation.
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.matches('.tap-zone')) return;
  if (button.matches('.mode-option, .format-option, [data-difficulty], [data-action=tab]')) {
    if (button.getAttribute('aria-pressed') !== 'true') feedback.ui('slide');
  } else if (!button.matches('[data-sound], #settings-button, #continue-game, #menu-settings, #restart-settings, #timer')) {
    feedback.ui(button.matches('#change-mode') ? 'transition' : button.matches('#start-game, #restart-game') ? 'start' : 'press');
  }
  if (reducedMotion.matches) return;
  const svg = button.querySelector('svg');
  if (svg) {
    svg.getAnimations().forEach(animation => animation.cancel());
    const turn = button.matches('.restart-action') ? 360 : button.matches('.settings-trigger') ? 90 : 0;
    reveal(svg, [
      { transform: 'translateY(0) rotate(0deg) scale(1)' },
      { transform: `translateY(-3px) rotate(${turn * .7}deg) scale(1.12)`, offset: .45 },
      { transform: `translateY(0) rotate(${turn}deg) scale(1)` },
    ], 420);
  } else {
    reveal(button, [{ scale: '.96' }, { scale: '1.015', offset: .65 }, { scale: '1' }], 260);
  }
}, true);
document.querySelectorAll('.setting-row input').forEach(input => input.addEventListener('change', () => {
  reveal(input.closest('.setting-row').querySelector('strong'), [{ transform: 'translateX(0)' }, { transform: 'translateX(3px)', offset: .4 }, { transform: 'translateX(0)' }], 280);
}));
chooseDifficulty(selectedDifficulty);
showMenu();
requestAnimationFrame(frame);
