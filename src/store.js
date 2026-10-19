import { ITEMS, PACKS, dailyGoals, claimGoal, exchangeCoins, buyItem, equipItem, saveProgress, localDay, equippedBoosts, boostSlots } from './progression.js';

export function createStore({ progress, storage, gear, changed, reducedMotion, feedback }) {
  const coin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>';
  const dialog = document.createElement('dialog');
  dialog.id = 'store'; dialog.className = 'store'; dialog.setAttribute('aria-labelledby', 'store-title');
  dialog.innerHTML = `<header class="store-header"><button class="store-back" data-action="close" aria-label="Cerrar tienda">←</button><h2 id="store-title">Tienda</h2><button class="daily-link" data-action="daily">Metas diarias</button></header>
    <div class="wallet"><div id="wallet-points">${gear}<span>PUNTOS DE METAS<strong>0</strong></span></div><div id="wallet-coins">${coin}<span>MONEDAS<strong>0</strong></span></div></div>
    <p id="store-notice" class="store-notice" role="status" aria-live="polite"></p>
    <div id="store-content"></div>`;
  document.body.append(dialog);
  let tab = 'cosmetic', view = 'shop', motion, closing = false, tabTimer, dayTimer;
  const format = n => n.toLocaleString('es-CL');
  const miniClock = skin => `<svg class="shop-clock" data-skin="${skin}" viewBox="0 0 100 100" aria-hidden="true"><circle class="shop-ring" cx="50" cy="50" r="41"/><rect class="shop-square" x="9" y="9" width="82" height="82" rx="15"/><circle class="shop-inner" cx="50" cy="50" r="34"/>${Array.from({ length: 12 }, (_, i) => `<line class="shop-tick" x1="50" y1="15" x2="50" y2="20" transform="rotate(${i * 30} 50 50)"/>`).join('')}<path class="shop-hand" d="M50 23V50L68 62"/><circle cx="50" cy="50" r="3" fill="currentColor"/></svg>`;
  function render() {
    const goals = dailyGoals(progress);
    dialog.querySelector('#wallet-points strong').textContent = format(progress.points);
    dialog.querySelector('#wallet-coins strong').textContent = format(progress.coins);
    dialog.querySelector('#store-title').textContent = view === 'daily' ? 'Metas diarias' : 'Tienda';
    dialog.querySelector('.daily-link').textContent = view === 'daily' ? 'Ver tienda' : 'Metas diarias';
    const content = dialog.querySelector('#store-content');
    const exchangeOpen = content.querySelector('.coin-exchange')?.open;
    if (view === 'daily') {
      const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const minutes = Math.ceil((midnight - now) / 60000);
      content.innerHTML = `<p class="store-intro">Juega. Cumple metas. Recoge engranajes.</p><p class="reset-time">Nuevas metas en ${Math.floor(minutes / 60)} h ${minutes % 60} min</p>
        <div class="goal-list">${goals.map(goal => `<article class="goal" data-goal="${goal.id}"><div class="goal-heading"><h3>${goal.title}</h3><span class="gear-reward">${gear} ${goal.reward}</span></div><p>${goal.detail}</p><div class="goal-progress" role="progressbar" aria-label="${goal.title}" aria-valuenow="${Math.min(goal.target, goal.value)}" aria-valuemin="0" aria-valuemax="${goal.target}"><span style="width:${Math.min(100, goal.value / goal.target * 100)}%"></span></div><div class="goal-footer"><span>${format(Math.min(goal.target, goal.value))} / ${format(goal.target)}</span><button data-action="claim" data-id="${goal.id}" ${goal.claimed || goal.value < goal.target ? 'disabled' : ''}>${goal.claimed ? 'Recogido ✓' : 'Recoger'}</button></div></article>`).join('')}</div><p class="store-footnote">Los puntos de la partida no se gastan. Solo se canjean los engranajes recogidos de las metas.</p>`;
    } else {
      content.innerHTML = `<details class="coin-exchange" ${exchangeOpen ? 'open' : ''}><summary>Canjear engranajes por monedas <span>+</span></summary><div>${PACKS.map(pack => `<button data-action="exchange" data-id="${pack.id}" ${progress.points < pack.points ? 'disabled' : ''}><span>${gear} ${format(pack.points)}</span><span>→</span><strong>${coin} ${pack.coins}</strong></button>`).join('')}</div></details>
      <div class="store-tabs" role="group" aria-label="Secciones de la tienda"><span class="store-tab-line" style="transform:translateX(${tab === 'cosmetic' ? 0 : 100}%)"></span><button data-action="tab" data-id="cosmetic" aria-pressed="${tab === 'cosmetic'}">Cosméticos</button><button data-action="tab" data-id="boost" aria-pressed="${tab === 'boost'}">Boosts</button></div>
      <p class="store-intro">${tab === 'cosmetic' ? 'Tu reloj. Tu estilo.' : `Permanentes. ${equippedBoosts(progress).length}/${boostSlots(progress)} ranuras equipadas.`}</p>
      ${tab === 'boost' ? `<button class="no-boost" data-action="equip" data-id="none" aria-pressed="${!equippedBoosts(progress).length}">${!equippedBoosts(progress).length ? '✓ Sin boost' : 'Jugar sin boost'}</button>` : ''}
      ${tab === 'boost' ? `<article class="shop-item general-upgrade" data-item="dual"><div class="boost-symbol">2</div><div class="item-copy"><h3>Doble ranura</h3><p>Mejora general permanente. Combina dos boosts distintos.</p></div><div class="item-actions">${progress.owned.includes('dual') ? '<span>Desbloqueada ✓</span>' : `<button data-action="buy" data-id="dual" ${progress.coins < 600 ? 'disabled' : ''}>${coin} 600</button><button class="score-unlock" data-action="unlock" data-id="dual" ${progress.best < 20000 ? 'disabled' : ''}>${progress.best >= 20000 ? 'Desbloquear' : 'Récord'} 20.000</button>`}</div></article>` : ''}
      <div class="catalog">${ITEMS.filter(item => item.kind === tab).map(item => {
        const owned = progress.owned.includes(item.id), equipped = item.kind === 'cosmetic' ? progress.cosmetic === item.id : equippedBoosts(progress).includes(item.id);
        return `<article class="shop-item" data-item="${item.id}"><div class="item-art">${tab === 'cosmetic' ? miniClock(item.id) : `<span class="boost-symbol">${item.id === 'speed' ? '×2' : item.id === 'recharge' ? '+×2' : item.id === 'lock' ? '<svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="10" y="21" width="28" height="21" rx="5"/><path d="M16 21v-7a8 8 0 0 1 16 0v7M24 29v5"/></svg>' : item.id === 'tank' ? '<svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="7" y="7" width="12" height="34" rx="4"/><rect x="29" y="7" width="12" height="34" rx="4"/><path d="M7 24h12m10 0h12"/></svg>' : '+1,5'}</span>`}</div><div class="item-copy"><h3>${item.name}</h3><p>${item.detail}</p></div><div class="item-actions">${owned ? `<button data-action="equip" data-id="${item.id}" ${equipped && (item.kind === 'cosmetic' || boostSlots(progress) === 1) ? 'disabled' : ''}>${equipped ? item.kind === 'boost' && boostSlots(progress) === 2 ? 'Quitar ✓' : 'Equipado ✓' : 'Equipar'}</button>` : `<button data-action="buy" data-id="${item.id}" aria-label="Comprar ${item.name} por ${item.price} monedas" ${progress.coins < item.price ? 'disabled' : ''}>${coin} ${item.price}</button><button class="score-unlock" data-action="unlock" data-id="${item.id}" ${progress.best < item.target ? 'disabled' : ''}>${progress.best >= item.target ? 'Desbloquear' : 'Récord'} ${format(item.target)}</button>`}</div></article>`;
      }).join('')}</div><p class="store-footnote">Compra con monedas o alcanza el récord indicado en una sola partida. Los cambios se aplican a tu próxima partida.</p><p class="store-best">TU MEJOR PARTIDA · ${format(progress.best)} PUNTOS</p>`;
    }
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
    view = showDaily ? 'daily' : 'shop'; render(); dialog.querySelector('#store-notice').textContent = '';
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
    if (action === 'claim') { reward = claimGoal(progress, id); if (reward) message = `+${reward} puntos de metas`; }
    if (action === 'exchange') { reward = exchangeCoins(progress, id); if (reward) message = `+${reward} monedas`; }
    if (action === 'buy' || action === 'unlock') { if (buyItem(progress, id, action === 'buy' ? 'coins' : 'score')) message = `${ITEMS.find(i => i.id === id).name} desbloqueado`; }
    if (action === 'equip') { if (equipItem(progress, id)) message = id === 'none' ? 'Sin boost' : `${ITEMS.find(i => i.id === id).name} ${equippedBoosts(progress).includes(id) || ITEMS.find(i => i.id === id).kind === 'cosmetic' ? 'equipado' : 'retirado'}`; }
    if (!message) { if (action === 'equip') notice.textContent = 'Quita un boost para liberar una ranura.'; return; }
    const saved = persist(); render(); notice.textContent = message + (saved ? '' : ' · Guardado no disponible: solo esta sesión.');
    if (reward) celebrate(action === 'claim' ? 'points' : 'coins', reward, rect);
    else if (!reducedMotion.matches) notice.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && dialog.open) { render(); persist(); } });
  return { open, close, dialog, render };
}
