// Progreso offline (sección 10). Usa la misma calculadora que el juego en
// marcha, simulando por tramos: se corta en cada construcción que termina.
import { ZONES, ZONES_BY_ID } from '../data/zones.js';
import { advanceGame, completeBuilds, sellZone, unitPrice } from './production.js';

// Un salto de más de estos segundos entre ticks se trata como tiempo offline.
export const OFFLINE_GAP_SECONDS = 5;
// A partir de este tiempo fuera se muestra la pantalla de recogida.
export const OFFLINE_REPORT_SECONDS = 60;

function nextBuildEnd(state, after, until) {
  let next = null;
  for (const def of ZONES) {
    const end = state.zones[def.id].buildEndsAt;
    if (end !== null && end > after && end <= until && (next === null || end < next)) next = end;
  }
  return next;
}

// Simula el tiempo entre `fromMs` y `toMs`. Offline no vende nadie: todo va al
// almacén, que limita cuántas horas se acumulan. Si el reloj va hacia atrás,
// no se produce nada (nunca producción negativa ni doble).
export function simulateOffline(state, fromMs, toMs) {
  const elapsedSeconds = Math.max(0, (toMs - fromMs) / 1000);
  const before = {};
  for (const def of ZONES) {
    const zs = state.zones[def.id];
    before[def.id] = zs.totalProduced;
    zs.boostUntil = 0;
  }

  let t = fromMs;
  while (t < toMs) {
    completeBuilds(state, t);
    const segEnd = nextBuildEnd(state, t, toMs) ?? toMs;
    advanceGame(state, (segEnd - t) / 1000, t, { autoSell: false });
    t = segEnd;
  }
  completeBuilds(state, toMs);
  state.lastTick = toMs;

  const perZone = {};
  let produced = 0;
  let value = 0;
  for (const def of ZONES) {
    const zs = state.zones[def.id];
    perZone[def.id] = zs.totalProduced - before[def.id];
    produced += perZone[def.id];
    value += zs.stock * unitPrice(zs, ZONES_BY_ID[def.id]);
  }
  return { elapsedSeconds, produced, perZone, value };
}

// «Recoger»: vende el contenido de todos los almacenes.
export function collectOffline(state) {
  let earned = 0;
  for (const def of ZONES) earned += sellZone(state, def.id);
  return earned;
}
