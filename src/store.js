import { ITEMS, PACKS, dailyGoals, claimGoal, exchangeCoins, buyItem, equipItem, saveProgress, localDay, equippedBoosts, boostSlots } from './progression.js';

export function createStore({ progress, storage, gear, changed, reducedMotion, feedback }) {
  const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const symbols = { bag: svg('<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'), exchange: svg('<path d="M4 8h16l-4-4M20 16H4l4 4"/>'), mission: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'), trophy: svg('<path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v6m-4 2h8"/>'), check: svg('<path d="m5 12 4 4L19 6"/>'), down: svg('<path d="M12 4v16m-6-6 6 6 6-6"/>'), info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'), clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>') };
  const coin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>';
  const dialog = document.createElement('dialog');
  dialog.id = 'store'; dialog.className = 'store'; dialog.setAttribute('aria-labelledby', 'store-title');
  dialog.innerHTML = `<header class="store-header"><button class="store-back" data-action="close" aria-label="Cerrar tienda">←</button><h2 id="store-title">Tienda</h2><button class="daily-link" data-action="daily">Metas diarias</button></header>
    <div class="wallet"><div id="wallet-points">${gear}<span>PUNTOS DE METAS<strong>0</strong></span></div><div id="wallet-coins">${coin}<span>MONEDAS<strong>0</strong></span></div></div>
    <p id="store-notice" class="store-notice" role="status" aria-live="polite"></p>
    <div id="store-content"></div>`;
  document.body.append(dialog);
  let tab = 'cosmetic', view = 'shop', motion, closing = false, tabTimer, dayTimer, market = 'buy';
  const format = n => n.toLocaleString('es-CL');
  const miniClock = skin => `<svg class="shop-clock" data-skin="${skin}" viewBox="0 0 100 100" aria-hidden="true"><circle class="shop-ring" cx="50" cy="50" r="41"/><rect class="shop-square" x="9" y="9" width="82" height="82" rx="15"/><circle class="shop-inner" cx="50" cy="50" r="34"/>${Array.from({ length: 12 }, (_, i) => `<line class="shop-tick" x1="50" y1="15" x2="50" y2="20" transform="rotate(${i * 30} 50 50)"/>`).join('')}<path class="shop-hand" d="M50 23V50L68 62"/><circle cx="50" cy="50" r="3" fill="currentColor"/></svg>`;
  const compactDetail = { 'sound-felt': 'Suave · incluido', 'sound-wood': 'Profundo y discreto', 'sound-clock': 'Clic metálico', original: 'Clásico', dots: 'Doce puntos', rail: 'Dos aros', square: 'Esfera cuadrada', speed: 'Velocidad ×2', recharge: 'Recarga ×2', lock: '3 usos · 3 ajustes de espera', tank: 'Capacidad 200', time: '+1,5 segundos', dual: 'Dos boosts a la vez' };
  function purchaseActions(item, owned, equipped = false) {
    if (item.kind === 'upgrade' && owned) return `<span class="upgrade-owned">${symbols.check} Permanente</span>`;
    if (owned) {
      const removable = item.kind === 'boost' && boostSlots(progress) === 2;
      return `<button data-action="equip" data-id="${item.id}" ${equipped && !removable ? 'disabled' : ''}>${equipped ? removable ? 'Quitar ✓' : 'Equipado ✓' : 'Equipar'}</button>`;
    }
    return `<button data-action="buy" data-id="${item.id}" aria-label="Comprar ${item.name} por ${item.price} monedas" ${progress.coins < item.price ? 'disabled' : ''}>${coin}<strong>${format(item.price)}</strong></button><button class="score-unlock" data-action="unlock" data-id="${item.id}" aria-label="Desbloquear ${item.name} con récord de ${item.target} puntos" ${progress.best < item.target ? 'disabled' : ''}>${symbols.trophy} ${format(item.target)}</button>`;
  }
  function art(item) {
    if (item.kind === 'sound') return svg('<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>');
    if (item.kind === 'cosmetic') return miniClock(item.id);
    if (item.id === 'lock') return svg('<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>');
    if (item.id === 'tank') return svg('<rect x="3" y="4" width="6" height="16" rx="2"/><rect x="15" y="4" width="6" height="16" rx="2"/><path d="M3 12h6m6 0h6"/>');
    return `<span class="boost-symbol">${({ speed: '×2', recharge: '+×2', time: '+1,5', dual: '2' })[item.id]}</span>`;
  }
  function itemCard(item) {
    const owned = progress.owned.includes(item.id), equipped = item.kind === 'sound' ? progress.soundPreset === item.id.slice(6) : item.kind === 'cosmetic' ? progress.cosmetic === item.id : equippedBoosts(progress).includes(item.id);
    return `<article class="shop-item ${item.kind === 'upgrade' ? 'general-upgrade' : ''}" data-item="${item.id}"><div class="item-art">${art(item)}</div><div class="item-copy"><div class="item-title"><h3>${item.name}</h3><details class="item-details"><summary aria-label="Detalles de ${item.name}">${symbols.info}</summary><p>${item.detail}</p></details></div><p>${compactDetail[item.id]}</p></div><div class="item-actions">${purchaseActions(item, owned, equipped)}</div></article>`;
  }
  function render() {
    const goals = dailyGoals(progress);
    dialog.querySelector('#wallet-points strong').textContent = format(progress.points);
    dialog.querySelector('#wallet-coins strong').textContent = format(progress.coins);
    dialog.querySelector('#store-title').textContent = view === 'daily' ? 'Misiones' : 'Tienda';
    const dailyLink = dialog.querySelector('.daily-link');
    dailyLink.innerHTML = view === 'daily' ? symbols.bag : symbols.mission;
    dailyLink.setAttribute('aria-label', view === 'daily' ? 'Ver tienda' : 'Metas diarias');
    dialog.querySelector('.store-back').innerHTML = svg('<path d="m14 6-6 6 6 6"/>');
    const content = dialog.querySelector('#store-content');
    if (view === 'daily') {
      const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const minutes = Math.ceil((midnight - now) / 60000);
      content.innerHTML = `<div class="mission-section-head"><span>HOY</span><span class="reset-time" aria-label="Nuevas misiones en ${Math.floor(minutes / 60)} horas y ${minutes % 60} minutos">${symbols.clock} ${Math.floor(minutes / 60)}h ${minutes % 60}m</span></div><div class="goal-list">${goals.map(goal => {
        const label = goal.id === 'precision' ? goal.detail.includes('perfectos') ? 'PERFECTOS' : 'RELOJES' : 'PUNTOS';
        const context = goal.id === 'score' ? 'Una partida' : goal.id === 'precision' ? 'Acumulados hoy' : goal.detail.includes('Supervivencia') ? 'Supervivencia' : 'Clásico';
        return `<article class="goal" data-goal="${goal.id}"><div class="goal-heading"><div class="mission-target"><span>${label}</span><h3>${format(goal.target)}</h3><p>${context}</p></div><span class="gear-reward">${gear}<strong>${goal.reward}</strong></span></div><div class="goal-progress" role="progressbar" aria-label="${goal.title}" aria-valuenow="${Math.min(goal.target, goal.value)}" aria-valuemin="0" aria-valuemax="${goal.target}"><span style="width:${Math.min(100, goal.value / goal.target * 100)}%"></span></div><div class="goal-footer"><span>${format(Math.min(goal.target, goal.value))} <span>/ ${format(goal.target)}</span></span><button data-action="claim" data-id="${goal.id}" aria-label="${goal.claimed ? 'Recompensa recogida' : 'Recoger recompensa de ' + goal.title}" ${goal.claimed || goal.value < goal.target ? 'disabled' : ''}>${goal.claimed ? symbols.check : symbols.down}</button></div></article>`;
      }).join('')}</div><button class="mission-exchange" data-action="section" data-id="exchange">${symbols.exchange} Canjear</button>`;
      return;
    }
    const nav = `<div class="market-nav" role="group" aria-label="Acciones de tienda"><button data-action="section" data-id="buy" aria-pressed="${market === 'buy'}">${symbols.bag} Comprar</button><button data-action="section" data-id="exchange" aria-pressed="${market === 'exchange'}">${symbols.exchange} Canjear</button></div>`;
    if (market === 'exchange') {
      content.innerHTML = nav + `<section class="exchange-section" aria-labelledby="exchange-title"><h3 id="exchange-title">Engranajes <span>→</span> monedas</h3><div class="exchange-packs">${PACKS.map(pack => `<button data-action="exchange" data-id="${pack.id}" aria-label="Canjear ${pack.points} engranajes por ${pack.coins} monedas" ${progress.points < pack.points ? 'disabled' : ''}><span class="pack-cost">${gear}<span>${format(pack.points)}</span></span><span class="pack-arrow">→</span><strong>${coin}${pack.coins}</strong></button>`).join('')}</div></section>`;
      return;
    }
    content.innerHTML = nav + `<div class="store-tabs" role="group" aria-label="Secciones de la tienda"><span class="store-tab-line" style="transform:translateX(${tab === 'cosmetic' ? 0 : 100}%)"></span><button data-action="tab" data-id="cosmetic" aria-pressed="${tab === 'cosmetic'}">${symbols.clock} Cosméticos</button><button data-action="tab" data-id="boost" aria-pressed="${tab === 'boost'}">${svg('<path d="m14 2-8 12h6l-2 8 8-12h-6l2-8Z"/>')} Boosts</button></div>
      ${tab === 'boost' ? `<div class="loadout-heading"><span>RANURAS <strong>${equippedBoosts(progress).length}/${boostSlots(progress)}</strong></span><button class="no-boost" data-action="equip" data-id="none" aria-label="Quitar todos los boosts" aria-pressed="${!equippedBoosts(progress).length}">${svg('<path d="m6 6 12 12M18 6 6 18"/>')}</button></div><div class="general-label">MEJORA GENERAL</div>${itemCard(ITEMS.find(item => item.id === 'dual'))}<div class="general-label">BOOSTS</div>` : ''}
      <div class="catalog">${ITEMS.filter(item => item.kind === tab).map(itemCard).join('')}</div>${tab === 'cosmetic' ? `<div class="general-label">SONIDOS</div><div class="catalog">${ITEMS.filter(item => item.kind === 'sound').map(itemCard).join('')}</div>` : ''}<p class="store-best">${symbols.trophy} TU RÉCORD <strong>${format(progress.best)}</strong></p>`;
  }
  function celebrate(type, amount, origin) {
    const target = dialog.querySelector(type === 'points' ? '#wallet-points' : '#wallet-coins');
    target.animate(reducedMotion.matches ? [{ opacity: .5 }, { opacity: 1 }] : [{ transform: 'scale(1)' }, { transform: 'scale(1.13)', offset: .4 }, { transform: 'scale(1)' }], { duration: 480 });
    if (reducedMotion.matches) return;
    const to = target.getBoundingClientRect();
    for (let i = 0; i < 7; i++) {
      const particle = document.createElement('span'); particle.className = 'reward-particle';
      particle.innerHTML = type === 'points' ? gear : coin;
      Object.assign(particle.style, { left: `${origin.left + origin.width / 2}px`, top: `${origin.top + origin.height / 2}px` });
      dialog.append(particle);
      const dx = to.left + to.width / 2 - origin.left - origin.width / 2;
      const dy = to.top + to.height / 2 - origin.top - origin.height / 2;
      const animation = particle.animate([{ transform: 'translate(-50%, -50%) scale(.5)', opacity: 0 }, { transform: `translate(${(i - 3) * 18}px, -45px) rotate(${i * 45}deg)`, opacity: 1, offset: .25 }, { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(.35)`, opacity: 0 }], { duration: 700 + i * 35, easing: 'cubic-bezier(.3,.1,.3,1)' });
      animation.onfinish = () => particle.remove();
    }
  }
  function persist() {
    const saved = saveProgress(progress, storage);
    changed();
    return saved;
  }
  function open(showDaily = false) {
    if (dialog.open) return;
    view = showDaily ? 'daily' : 'shop'; market = 'buy'; render(); dialog.querySelector('#store-notice').textContent = '';
    closing = false; dialog.showModal(); feedback.ui('open');
    clearInterval(dayTimer);
    dayTimer = setInterval(() => {
      const day = progress.daily.day; dailyGoals(progress);
      if (day !== progress.daily.day) { persist(); render(); }
    }, 30000);
    if (!reducedMotion.matches) motion = dialog.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 340, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  function close() {
    if (closing || !dialog.open) return;
    clearTimeout(tabTimer); clearInterval(dayTimer);
    closing = true; feedback.ui('close'); motion?.cancel();
    if (reducedMotion.matches) { dialog.close(); closing = false; return; }
    motion = dialog.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
    motion.onfinish = () => { dialog.close(); motion.cancel(); closing = false; };
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const { action, id } = button.dataset, rect = button.getBoundingClientRect();
    const notice = dialog.querySelector('#store-notice'); let message = '', reward = 0;
    if (action === 'close') { close(); return; }
    if (action === 'daily') { clearTimeout(tabTimer); view = view === 'daily' ? 'shop' : 'daily'; render(); return; }
    if (action === 'section') { clearTimeout(tabTimer); view = 'shop'; market = id; render(); if (!reducedMotion.matches) dialog.querySelector('#store-content').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 }); return; }
    if (action === 'tab') {
      clearTimeout(tabTimer);
      const old = tab; tab = id;
      const selector = dialog.querySelector('.store-tab-line');
      selector.style.transform = `translateX(${tab === 'cosmetic' ? 0 : 100}%)`;
      dialog.querySelectorAll('[data-action="tab"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === tab)));
      // Keep the moving selector mounted while the catalogue changes.
      const previous = dialog.querySelector('.catalog'); previous.inert = true;
      if (old !== tab && !reducedMotion.matches) previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100 });
      tabTimer = setTimeout(() => { if (!dialog.open || view !== 'shop') return; render(); if (!reducedMotion.matches) dialog.querySelector('.catalog').animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260 }); }, reducedMotion.matches ? 0 : 400);
      return;
    }
    if (action === 'claim' && progress.daily.day !== localDay()) {
      const previousDay = progress.daily.day; dailyGoals(progress);
      if (previousDay !== progress.daily.day) { persist(); render(); notice.textContent = 'Nuevas metas para hoy.'; return; }
    }
    if (action === 'claim') { reward = claimGoal(progress, id); if (reward) message = `+${reward} engranajes`; }
    if (action === 'exchange') { reward = exchangeCoins(progress, id); if (reward) message = `+${reward} monedas`; }
    if (action === 'buy' || action === 'unlock') { if (buyItem(progress, id, action === 'buy' ? 'coins' : 'score')) message = `${ITEMS.find(i => i.id === id).name} desbloqueado`; }
    if (action === 'equip') { if (equipItem(progress, id)) message = id === 'none' ? 'Sin boost' : `${ITEMS.find(i => i.id === id).name} ${equippedBoosts(progress).includes(id) || ITEMS.find(i => i.id === id).kind !== 'boost' ? 'equipado' : 'retirado'}`; }
    if (!message) { if (action === 'equip') notice.textContent = 'Quita un boost para liberar una ranura.'; return; }
    const saved = persist(); render(); if (action === 'equip' && id.startsWith('sound-')) feedback.preview(); notice.textContent = message + (saved ? '' : ' · Guardado no disponible: solo esta sesión.');
    if (reward) celebrate(action === 'claim' ? 'points' : 'coins', reward, rect);
    else if (!reducedMotion.matches) notice.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && dialog.open) { render(); persist(); } });
  return { open, close, dialog, render };
}
