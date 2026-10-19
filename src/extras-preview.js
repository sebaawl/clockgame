const descriptions = {
  original: 'El reloj original', dots: 'Doce puntos', rail: 'Doble aro', square: 'Esfera cuadrada',
  eclipse: 'Aro grueso, sin marcas', pulse: 'Círculo de trazos', diamond: 'Cuatro marcas cardinales',
  'sound-paper': 'Roce ligero', 'sound-latch': 'Encaje compacto', 'sound-velvet': 'Golpe cálido', 'sound-pocket': 'Doble encaje', 'sound-felt': 'Clic suave', 'sound-wood': 'Encaje grave', 'sound-clock': 'Ajuste metálico',
  speed: 'Velocidad ×2', tank: 'Capacidad 200', recharge: 'Recarga ×2',
  lock: 'Frena en las doce · 3 usos', time: '+1,5 segundos', efficient: 'Consumo −25%',
  compass: 'Manecilla fantasma · Guía de giro', precision: '+3 Nitro por perfecto', none: 'Sin ventajas activas',
};
export function extrasPreview(item, skin) {
  const boost = item.kind === 'boost', sound = item.kind === 'sound';
  const meter = boost && !['time', 'none', 'compass'].includes(item.id);
  const ticks = Array.from({ length: 12 }, (_, i) => `<line class="shop-tick" x1="50" y1="15" x2="50" y2="${skin === 'dots' ? 15.1 : 20}" transform="rotate(${i * 30} 50 50)"/>`).join('');
  return `<div class="extras-preview" data-preview="${item.id}" data-kind="${item.kind}" aria-label="Vista previa de ${item.name}">
    <svg class="shop-clock extras-clock" data-skin="${skin}" viewBox="0 0 100 100" aria-hidden="true"><circle class="shop-ring" cx="50" cy="50" r="41"/><rect class="shop-square" x="9" y="9" width="82" height="82" rx="15"/><circle class="shop-inner" cx="50" cy="50" r="34"/>${ticks}${item.id === 'compass' ? '<g class="preview-compass-ghost compass-ghost" style="--ghost-turn:-48deg" aria-hidden="true"><g class="spectral-sweep spectral-1"><path class="preview-spectral-core" d="M50 50 48.5 23Q50 15 51.5 23Z"/></g><g class="spectral-sweep spectral-0"><path class="spectral-aura" d="M50 49V17"/><path class="preview-spectral-core" d="M50 50 48.5 23Q50 15 51.5 23Z"/></g></g>' : ''}<path class="shop-hand" d="M50 25V50"/><g class="demo-hand"><path class="shop-hand" d="M50 54V30"/></g><circle cx="50" cy="50" r="2.5" fill="currentColor" stroke="none"/></svg>
    <div class="preview-copy" aria-live="polite"><span>VISTA PREVIA</span><strong>${item.name}</strong><p>${descriptions[item.id] || ''}</p>${meter ? `<div class="preview-meter" data-double="${item.id === 'tank'}" aria-hidden="true"><span></span></div>` : ''}${item.id === 'time' ? '<span class="preview-time" aria-hidden="true">+1,5 s</span>' : ''}<span class="preview-feedback" role="status"></span></div>
    <button type="button" data-preview-replay ${sound ? 'data-sound-preview' : ''} aria-label="${sound ? 'Escuchar ' : 'Repetir vista previa de '}${item.name}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9 5 10 7-10 7V5Z"/></svg></button>
  </div>`;
}
export function animateExtrasPreview(root, item, reduced, feedback, playSound = false) {
  if (!root) return;
  if (playSound && item.kind === 'sound') {
    const voice = feedback.preview(item.id.slice(6));
    root.querySelector('.preview-feedback').textContent = voice ? '' : 'Sonido desactivado';
  }
  for (const element of [root.querySelector('.demo-hand'), root.querySelector('.preview-meter > span'), root.querySelector('.preview-time')]) element?.getAnimations().forEach(animation => animation.cancel());
  if (reduced) return;
  const accelerated = ['speed', 'efficient', 'lock'].includes(item.id);
  const from = item.id === 'lock' ? 270 : 90;
  const to = item.id === 'speed' ? 720 : item.id === 'efficient' ? 540 : item.id === 'lock' ? 360 : 0;
  root.querySelector('.demo-hand').animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }], {
    duration: accelerated ? item.id === 'speed' ? 1000 : 1500 : 800,
    easing: accelerated ? 'cubic-bezier(.35,0,.2,1)' : 'cubic-bezier(.22,1.5,.4,1)', fill: 'forwards',
  });
  const meter = root.querySelector('.preview-meter > span');
  if (meter) {
    const draining = ['speed', 'efficient', 'lock'].includes(item.id);
    const start = draining ? 80 : 40, end = draining ? item.id === 'efficient' ? 56 : 48 : item.id === 'tank' ? 100 : item.id === 'precision' ? 48 : 60;
    meter.animate([{ width: `${start}%` }, { width: `${end}%` }], { duration: 1100, easing: 'ease-in-out', fill: 'forwards' });
  }
  root.querySelector('.preview-time')?.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500, fill: 'forwards' });
}
