export const PROGRESS_KEY = 'clocking:progress:v1';
export const ITEMS = [
  { id: 'dual', kind: 'upgrade', name: 'Doble ranura', detail: 'Mejora permanente: equipa dos boosts distintos a la vez.', price: 600, target: 20000 },
  { id: 'original', kind: 'cosmetic', name: 'Original', detail: 'El reloj de siempre.', price: 0, target: 0 },
  { id: 'dots', kind: 'cosmetic', name: 'Órbita', detail: 'Doce puntos. Un círculo limpio.', price: 60, target: 3500 },
  { id: 'rail', kind: 'cosmetic', name: 'Doble trazo', detail: 'Dos aros y marcas finas.', price: 100, target: 5500 },
  { id: 'square', kind: 'cosmetic', name: 'Cuadrante', detail: 'Una esfera cuadrada, suave y gruesa.', price: 140, target: 7500 },
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
function dayState(day) { return { day, best: 0, classic: 0, survival: 0, clocks: 0, perfect: 0, claimed: [] }; }
export function createProgress(now = new Date()) {
  return { version: 1, points: 0, coins: 0, best: 0, owned: ['original'], cosmetic: 'original', boost: null, boosts: [], daily: dayState(localDay(now)) };
}
export function refreshDaily(state, now = new Date()) {
  const day = localDay(now);
  if (state.daily.day !== day) state.daily = dayState(day);
  return state.daily;
}
export function loadProgress(storage, now = new Date()) {
  const state = createProgress(now);
  try {
    const saved = JSON.parse(storage.getItem(PROGRESS_KEY));
    if (!saved || saved.version !== 1) return state;
    for (const field of ['points', 'coins', 'best']) state[field] = integer(saved[field]);
    state.owned = ['original', ...ITEMS.filter(item => item.id !== 'original' && saved.owned?.includes(item.id)).map(item => item.id)];
    if (state.owned.includes(saved.cosmetic) && ITEMS.some(i => i.id === saved.cosmetic && i.kind === 'cosmetic')) state.cosmetic = saved.cosmetic;
    const candidates = Array.isArray(saved.boosts) && saved.boosts.length ? saved.boosts : [saved.boost];
    state.boosts = [...new Set(candidates)].filter(id => state.owned.includes(id) && ITEMS.some(i => i.id === id && i.kind === 'boost')).slice(0, boostSlots(state));
    state.boost = state.boosts[0] || null;
    if (saved.daily?.day === localDay(now)) {
      for (const field of ['best', 'classic', 'survival', 'clocks', 'perfect']) state.daily[field] = integer(saved.daily[field]);
      state.daily.claimed = Array.isArray(saved.daily.claimed) ? saved.daily.claimed.filter(id => ['score', 'mode', 'precision'].includes(id)) : [];
    }
  } catch { /* Local play remains available without storage. */ }
  return state;
}
export function saveProgress(state, storage) { try { storage.setItem(PROGRESS_KEY, JSON.stringify(state)); return true; } catch { return false; } }
export function dailyGoals(state, now = new Date()) {
  const daily = refreshDaily(state, now);
  const day = new Date(`${daily.day}T12:00:00`);
  const alternate = Math.floor(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 86400000) % 2 === 0;
  return [
    { id: 'score', title: 'A tiempo', detail: 'Consigue 1500 puntos en una partida.', target: 1500, value: daily.best, reward: 600 },
    { id: 'mode', title: alternate ? 'Resiste' : 'Vuelta completa', detail: `Consigue ${alternate ? 1000 : 1200} puntos en una partida de ${alternate ? 'Supervivencia' : 'Clásico'}.`, target: alternate ? 1000 : 1200, value: alternate ? daily.survival : daily.classic, reward: 450 },
    { id: 'precision', title: alternate ? 'Sin rodeos' : 'En marcha', detail: alternate ? 'Resuelve 20 relojes perfectos hoy.' : 'Resuelve 35 relojes hoy.', target: alternate ? 20 : 35, value: alternate ? daily.perfect : daily.clocks, reward: 350 },
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
export const boostSlots = state => state.owned.includes('dual') ? 2 : 1;
export function equippedBoosts(state) {
  return (state.boosts?.length ? state.boosts : state.boost ? [state.boost] : []).slice(0, boostSlots(state));
}
export function equipItem(state, id) {
  if (id === 'none') { state.boost = null; state.boosts = []; return true; }
  const item = ITEMS.find(item => item.id === id);
  if (!item || !state.owned.includes(id) || item.kind === 'upgrade') return false;
  if (item.kind === 'cosmetic') { state.cosmetic = id; return true; }
  let equipped = equippedBoosts(state);
  if (boostSlots(state) === 1) equipped = [id];
  else if (equipped.includes(id)) equipped = equipped.filter(value => value !== id);
  else if (equipped.length < 2) equipped.push(id);
  else return false;
  state.boosts = equipped; state.boost = equipped[0] || null;
  return true;
}
