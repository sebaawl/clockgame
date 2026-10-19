import { saveProgress } from './progression.js';

// Included only when building with VITE_DESIGNER=true. This is a local testing tool, not authentication.
export function installDesigner({ progress, storage, changed, gear, reducedMotion, feedback }) {
  const panel = document.createElement('dialog');
  panel.id = 'designer'; panel.className = 'store designer'; panel.setAttribute('aria-labelledby', 'designer-title');
  panel.innerHTML = `<header class="store-header"><button type="button" id="designer-close" aria-label="Cerrar diseñador">←</button><h2 id="designer-title">Diseñador</h2></header>
    <p class="store-intro">Herramientas locales de prueba.</p>
    <div class="designer-balance"><div>${gear}<span>ENGRANAJES<strong id="designer-points">0</strong></span></div><div><span>MONEDAS<strong id="designer-coins">0</strong></span></div></div>
    <form data-currency="points"><label for="designer-points-amount">Puntos de metas · engranajes</label><div class="designer-input"><input id="designer-points-amount" name="amount" type="number" inputmode="numeric" min="1" max="1000000" step="1" value="1000" required><button type="submit">Añadir puntos</button></div></form>
    <form data-currency="coins"><label for="designer-coins-amount">Monedas</label><div class="designer-input"><input id="designer-coins-amount" name="amount" type="number" inputmode="numeric" min="1" max="1000000" step="1" value="100" required><button type="submit">Añadir monedas</button></div></form>
    <p class="store-footnote">Modifica los saldos de la tienda. El puntaje de las partidas, los récords y las metas no cambian.</p>
    <p id="designer-status" class="store-notice" role="status" aria-live="polite"></p>`;
  document.body.append(panel);
  let taps = 0, previous = -Infinity;
  const render = () => {
    panel.querySelector('#designer-points').textContent = progress.points.toLocaleString('es-CL');
    panel.querySelector('#designer-coins').textContent = progress.coins.toLocaleString('es-CL');
  };
  function close() { if (panel.open) { panel.close(); feedback.ui('close'); } }
  document.querySelector('#start-title').addEventListener('click', () => {
    if (document.body.dataset.state !== 'menu' || panel.open) return;
    const now = performance.now();
    taps = now - previous <= 800 ? taps + 1 : 1; previous = now;
    if (taps < 7) return;
    taps = 0; render(); panel.querySelector('#designer-status').textContent = ''; panel.showModal(); feedback.ui('open');
    if (!reducedMotion.matches) panel.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
  });
  panel.querySelector('#designer-close').addEventListener('click', close);
  panel.addEventListener('cancel', event => { event.preventDefault(); close(); });
  panel.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target, field = form.dataset.currency;
    const amount = Number(new FormData(form).get('amount'));
    if (!['points', 'coins'].includes(field) || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 || progress[field] + amount > 1e9) return;
    progress[field] += amount;
    const saved = saveProgress(progress, storage);
    changed(); render(); feedback.ui('press');
    panel.querySelector('#designer-status').textContent = `+${amount.toLocaleString('es-CL')} ${field === 'points' ? 'engranajes' : 'monedas'}${saved ? '' : ' · Solo esta sesión: guardado no disponible.'}`;
    if (!reducedMotion.matches) panel.querySelector(`#designer-${field}`).animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: .45 }, { transform: 'scale(1)' }], { duration: 380 });
  });
  return { panel, close };
}
