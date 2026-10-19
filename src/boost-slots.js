import { ITEMS, boostLoadout, boostSlots } from './progression.js';
const bolt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m14 2-8 12h6l-2 8 8-12h-6l2-8Z"/></svg>';
const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
export function boostSlotsView(progress, selected = null) {
  const slots = boostLoadout(progress), capacity = boostSlots(progress);
  return `<div class="boost-loadout" aria-label="Ranuras de boosts">${[0, 1, 2].map(index => {
    const id = slots[index], item = ITEMS.find(item => item.id === id), locked = index >= capacity;
    if (locked) return `<div class="boost-slot locked"><span class="slot-label">RANURA ${index + 1}</span>${lock}<strong>Bloqueada</strong><small>${index === 2 ? 'Triple ranura' : 'Doble ranura'}</small></div>`;
    return `<div class="boost-slot ${item ? 'occupied' : 'empty'} ${selected === index ? 'selected' : ''}" data-slot-index="${index}"><button type="button" class="slot-select" data-action="slot" data-id="${index}" data-boost-slot="${index}" aria-pressed="${selected === index}" aria-label="Seleccionar ranura ${index + 1}${item ? ': ' + item.name : ': disponible'}"><span class="slot-label">RANURA ${index + 1}</span>${item ? bolt : '<span class="slot-plus" aria-hidden="true">+</span>'}<strong>${item ? item.name : 'Disponible'}</strong><small>${item ? 'Ocupada' : 'Elige un boost'}</small></button>${item ? `<button type="button" class="slot-remove" data-action="remove" data-id="${id}" data-remove-boost="${id}" aria-label="Quitar ${item.name}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>` : ''}</div>`;
  }).join('')}</div><p class="slot-hint" role="status">${selected === null ? 'Elige una ranura para cambiarla.' : `RANURA ${selected + 1} · ELIGE UN BOOST`}</p>`;
}
