export const PROGRESS_KEY = 'clocking:progress:v1';
export const ITEMS = [
  { id: 'sound-felt', kind: 'sound', name: 'Amortiguado', detail: 'Un clic suave para sesiones largas.', price: 0, target: 0 },
  { id: 'sound-wood', kind: 'sound', name: 'Grave', detail: 'Un encaje profundo y discreto.', price: 50, target: 3000 },
  { id: 'sound-clock', kind: 'sound', name: 'Mecánico', detail: 'El ajuste metálico del reloj.', price: 80, target: 4500 },
  { id: 'sound-paper', kind: 'sound', name: 'Papel', detail: 'Un roce seco y ligero, sin brillo metálico.', price: 65, target: 4000 },
  { id: 'sound-latch', kind: 'sound', name: 'Broche', detail: 'Dos piezas que encajan con un clic compacto.', price: 95, target: 5500 },
  { id: 'sound-velvet', kind: 'sound', name: 'Terciopelo', detail: 'Un golpecito cálido, redondo y muy amortiguado.', price: 120, target: 6500 },
  { id: 'sound-pocket', kind: 'sound', name: 'De bolsillo', detail: 'Un doble encaje corto, como un mecanismo pequeño.', price: 150, target: 8000 },
  { id: 'triple', kind: 'upgrade', name: 'Triple ranura', detail: 'Mejora permanente: hasta tres boosts distintos a la vez. Incluye la capacidad de dos ranuras.', price: 1000, target: 30000 },
  { id: 'compass', kind: 'boost', name: 'Brújula', detail: 'En Supervivencia, avisa cuándo dejar de gastar movimientos y girar hacia las doce en los retos de cuenta exacta.', price: 130, target: 7500 },
  { id: 'dual', kind: 'upgrade', name: 'Doble ranura', detail: 'Mejora permanente: equipa dos boosts distintos a la vez.', price: 600, target: 20000 },
  { id: 'original', kind: 'cosmetic', name: 'Original', detail: 'El reloj de siempre.', price: 0, target: 0 },
  { id: 'dots', kind: 'cosmetic', name: 'Órbita', detail: 'Doce puntos. Un círculo limpio.', price: 60, target: 3500 },
  { id: 'rail', kind: 'cosmetic', name: 'Doble trazo', detail: 'Dos aros y marcas finas.', price: 100, target: 5500 },
  { id: 'square', kind: 'cosmetic', name: 'Cuadrante', detail: 'Una esfera cuadrada, suave y gruesa.', price: 140, target: 7500 },
  { id: 'eclipse', kind: 'cosmetic', name: 'Eclipse', detail: 'Aro grueso, sin marcas. Solo tú y las manecillas.', price: 120, target: 6000 },
  { id: 'pulse', kind: 'cosmetic', name: 'Pulso', detail: 'Un círculo de pequeños trazos y manecillas finas.', price: 160, target: 8000 },
  { id: 'diamond', kind: 'cosmetic', name: 'Rombo', detail: 'Una esfera en rombo con cuatro marcas cardinales.', price: 220, target: 11000 },
  { id: 'efficient', kind: 'boost', name: 'Ahorro', detail: 'El Nitro consume un 25% menos. Misma velocidad, más recorrido.', price: 180, target: 9500 },
  { id: 'precision', kind: 'boost', name: 'Pulso perfecto', detail: '+3 de Nitro por solución perfecta, antes de los multiplicadores de recarga. Mantiene el límite de precisión en horas.', price: 90, target: 5000 },
  { id: 'speed', kind: 'boost', name: 'Nitro ×2', detail: 'El doble de velocidad al acelerar.', price: 100, target: 5000 },
  { id: 'tank', kind: 'boost', name: 'Doble depósito', detail: 'Almacena hasta 200 de Nitro. Empiezas con 40.', price: 140, target: 7000 },
  { id: 'recharge', kind: 'boost', name: 'Recarga ×2', detail: 'Gana el doble de Nitro por acierto y por bonus.', price: 150, target: 8000 },
  { id: 'lock', kind: 'boost', name: 'Nitro Lock', detail: 'Frena en las doce: 3 usos. Después, resuelve 3 relojes para recargarlo.', price: 200, target: 10000 },
  { id: 'time', kind: 'boost', name: 'Un respiro', detail: '+1,5 s por reloj en Clásico; +1,5 s iniciales en Supervivencia.', price: 180, target: 9000 },
];
export const PACKS = [
  { id: 'small', points: 300, coins: 20 },
  { id: 'large', points: 1200, coins: 90 },
];
const integer = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1e9) : 0;
export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export const MISSION_INTERVAL = 4 * 60 * 60 * 1000;
export const missionPeriod = (now = new Date()) => Math.floor(now.getTime() / MISSION_INTERVAL);
export const nextMissionAt = (now = new Date()) => new Date((missionPeriod(now) + 1) * MISSION_INTERVAL);
function dayState(day, period) { return { day, period, best: 0, classic: 0, survival: 0, clocks: 0, perfect: 0, claimed: [] }; }
export function createProgress(now = new Date()) {
  return { version: 1, points: 0, coins: 0, best: 0, owned: ['original', 'sound-felt'], soundPreset: 'felt', cosmetic: 'original', boost: null, boosts: [], daily: dayState(localDay(now), missionPeriod(now)) };
}
export function refreshDaily(state, now = new Date()) {
  const day = localDay(now);
  if (state.daily.period !== missionPeriod(now)) state.daily = dayState(day, missionPeriod(now));
  return state.daily;
}
export function loadProgress(storage, now = new Date()) {
  const state = createProgress(now);
  try {
    const saved = JSON.parse(storage.getItem(PROGRESS_KEY));
    if (!saved || saved.version !== 1) return state;
    for (const field of ['points', 'coins', 'best']) state[field] = integer(saved[field]);
    state.owned = ['original', 'sound-felt', ...ITEMS.filter(item => !['original', 'sound-felt'].includes(item.id) && saved.owned?.includes(item.id)).map(item => item.id)];
    if (state.owned.includes('sound-' + saved.soundPreset) && ITEMS.some(item => item.kind === 'sound' && item.id === 'sound-' + saved.soundPreset)) state.soundPreset = saved.soundPreset;
    if (state.owned.includes(saved.cosmetic) && ITEMS.some(i => i.id === saved.cosmetic && i.kind === 'cosmetic')) state.cosmetic = saved.cosmetic;
    const candidates = Array.isArray(saved.boosts) && saved.boosts.length ? saved.boosts : [saved.boost];
    const seen = new Set();
    state.boosts = candidates.slice(0, boostSlots(state)).map(id => {
      if (!state.owned.includes(id) || !ITEMS.some(i => i.id === id && i.kind === 'boost') || seen.has(id)) return null;
      seen.add(id); return id;
    });
    syncBoosts(state);
    if (saved.daily?.period === missionPeriod(now)) {
      for (const field of ['best', 'classic', 'survival', 'clocks', 'perfect']) state.daily[field] = integer(saved.daily[field]);
      state.daily.claimed = Array.isArray(saved.daily.claimed) ? saved.daily.claimed.filter(id => ['score', 'mode', 'precision'].includes(id)) : [];
    }
  } catch { /* Local play remains available without storage. */ }
  return state;
}
export function saveProgress(state, storage) { try { storage.setItem(PROGRESS_KEY, JSON.stringify(state)); return true; } catch { return false; } }
export function dailyGoals(state, now = new Date()) {
  const daily = refreshDaily(state, now);
  const alternate = (daily.period + Math.floor(daily.period / 6)) % 2 === 0;
  return [
    { id: 'score', title: 'A tiempo', detail: 'Consigue 1500 puntos en una partida.', target: 1500, value: daily.best, reward: 600 },
    { id: 'mode', title: alternate ? 'Resiste' : 'Vuelta completa', detail: `Consigue ${alternate ? 1000 : 1200} puntos en una partida de ${alternate ? 'Supervivencia' : 'Clásico'}.`, target: alternate ? 1000 : 1200, value: alternate ? daily.survival : daily.classic, reward: 450 },
    { id: 'precision', title: alternate ? 'Sin rodeos' : 'En marcha', detail: alternate ? 'Resuelve 20 relojes perfectos en este ciclo.' : 'Resuelve 35 relojes en este ciclo.', target: alternate ? 20 : 35, value: alternate ? daily.perfect : daily.clocks, reward: 350 },
  ].map(goal => ({ ...goal, claimed: daily.claimed.includes(goal.id) }));
}
// Called once per solved clock, with this run's cumulative score.
export function recordSolve(state, { score, format, perfect }, now = new Date()) {
  const daily = refreshDaily(state, now);
  const value = integer(score);
  state.best = Math.max(state.best, value);
  daily.best = Math.max(daily.best, value);
  if (format === 'classic' || format === 'survival') daily[format] = Math.max(daily[format], value);
  daily.clocks += 1;
  if (perfect) daily.perfect += 1;
}
export function claimGoal(state, id, now = new Date()) {
  const goal = dailyGoals(state, now).find(goal => goal.id === id);
  if (!goal || goal.claimed || goal.value < goal.target) return 0;
  state.daily.claimed.push(id);
  state.points += goal.reward;
  return goal.reward;
}
export function exchangeCoins(state, packId) {
  const pack = PACKS.find(pack => pack.id === packId);
  if (!pack || state.points < pack.points) return 0;
  state.points -= pack.points;
  state.coins += pack.coins;
  return pack.coins;
}
export function buyItem(state, id, method = 'coins') {
  const item = ITEMS.find(item => item.id === id);
  if (!item || state.owned.includes(id)) return false;
  if (method === 'score') { if (state.best < item.target) return false; }
  else if (method === 'coins') { if (state.coins < item.price) return false; state.coins -= item.price; }
  else return false;
  state.owned.push(id);
  return true;
}
export const boostSlots = state => state.owned.includes('triple') ? 3 : state.owned.includes('dual') ? 2 : 1;
export function boostLoadout(state) {
  const source = state.boosts?.length ? state.boosts : state.boost ? [state.boost] : [];
  return Array.from({ length: boostSlots(state) }, (_, i) => source[i] || null);
}
export function equippedBoosts(state) { return boostLoadout(state).filter(Boolean); }
function syncBoosts(state) {
  while (state.boosts.length && !state.boosts.at(-1)) state.boosts.pop();
  state.boost = state.boosts.find(Boolean) || null;
}
export function removeBoost(state, id) {
  const slots = boostLoadout(state), index = slots.indexOf(id);
  if (index < 0) return false;
  slots[index] = null; state.boosts = slots; syncBoosts(state); return true;
}
export function equipItem(state, id, slot = null) {
  if (id === 'none') { state.boost = null; state.boosts = []; return true; }
  const item = ITEMS.find(item => item.id === id);
  if (!item || !state.owned.includes(id) || item.kind === 'upgrade') return false;
  if (item.kind === 'sound') { state.soundPreset = id.slice(6); return true; }
  if (item.kind === 'cosmetic') { state.cosmetic = id; return true; }
  const slots = boostLoadout(state), existing = slots.indexOf(id);
  if (slot !== null) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots.length) return false;
    if (existing >= 0 && existing !== slot) slots[existing] = slots[slot];
    slots[slot] = id;
  } else if (slots.length === 1) slots[0] = id;
  else if (existing >= 0) slots[existing] = null;
  else { const free = slots.indexOf(null); if (free < 0) return false; slots[free] = id; }
  state.boosts = slots; syncBoosts(state);
  return true;
}
