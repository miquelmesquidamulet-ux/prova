// Estado serializable de la partida (GameState, sección 19).
// Solo contiene niveles, cantidades y marcas de tiempo; nunca datos de diseño.
import { ZONES } from '../data/zones.js';

export const SAVE_VERSION = 1;

export function createZoneState(def) {
  return {
    unlocked: def.unlockCost === 0,
    buildEndsAt: null, // marca de tiempo (ms UTC) del fin de la construcción
    tool: 1,
    transport: 1,
    warehouse: 1,
    workers: 1,
    stock: 0, // unidades en el almacén
    jam: 0, // 0..1, montón visual de mineral atascado en el frente
    salesManager: false,
    boostUntil: 0, // fin del +50 % por tocar el frente
    totalProduced: 0,
  };
}

export function createGameState(now) {
  return {
    version: SAVE_VERSION,
    coins: 0,
    totalEarned: 0,
    lastTick: now,
    currentZone: ZONES[0].id,
    zones: Object.fromEntries(ZONES.map((z) => [z.id, createZoneState(z)])),
    flags: {
      freeSpeedupUsed: false,
    },
    tutorial: {
      step: 0,
    },
  };
}

// Mezcla una partida guardada con un estado nuevo, para tolerar guardados
// de versiones anteriores a las que les falten campos o zonas.
export function hydrateState(saved, now) {
  const fresh = createGameState(now);
  if (!saved || typeof saved !== 'object') return fresh;
  const state = { ...fresh, ...saved, version: SAVE_VERSION };
  state.flags = { ...fresh.flags, ...(saved.flags || {}) };
  state.tutorial = { ...fresh.tutorial, ...(saved.tutorial || {}) };
  state.zones = {};
  for (const def of ZONES) {
    state.zones[def.id] = { ...fresh.zones[def.id], ...((saved.zones || {})[def.id] || {}) };
  }
  if (!state.zones[state.currentZone]) state.currentZone = ZONES[0].id;
  for (const key of ['coins', 'totalEarned', 'lastTick']) {
    if (!Number.isFinite(state[key])) state[key] = fresh[key];
  }
  return state;
}
