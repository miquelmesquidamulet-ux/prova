// La única calculadora de producción (sección 19): funciones puras que, dado el
// estado y un intervalo, devuelven lo producido. La usan el juego en marcha y
// el cálculo offline, así que nunca dan resultados distintos.
import { ZONES, ZONES_BY_ID } from '../data/zones.js';
import { RESOURCES } from '../data/resources.js';
import { SALES_MANAGER, TAP_BOOST } from '../data/upgrades.js';
import { toolSpeed, transportCapacity, warehouseHours } from './formulas.js';

export function zoneStatus(zs, now) {
  if (zs.unlocked) return 'active';
  if (zs.buildEndsAt !== null) return now >= zs.buildEndsAt ? 'ready' : 'building';
  return 'locked';
}

export function unitPrice(zs, def) {
  const base = RESOURCES[def.resource].basePrice;
  return base * (zs.salesManager ? 1 + SALES_MANAGER.priceBonus : 1);
}

const IDLE_RATES = Object.freeze({
  extraction: 0, transport: 0, real: 0, price: 0, income: 0,
  capacity: 0, bottleneck: null, boosted: false,
});

// Ritmos de una zona. producción real = mínimo(extracción, transporte).
export function zoneRates(zs, def, now) {
  if (!zs.unlocked) return IDLE_RATES;
  const boosted = now < zs.boostUntil;
  const baseExtraction = zs.workers * toolSpeed(zs.tool);
  const extraction = baseExtraction * (boosted ? TAP_BOOST.multiplier : 1);
  const transport = transportCapacity(zs.transport);
  const real = Math.min(extraction, transport);
  const price = unitPrice(zs, def);
  // La capacidad del almacén se mide en horas de producción (sin el toque).
  const capacity = warehouseHours(zs.warehouse) * 3600 * Math.min(baseExtraction, transport);
  let bottleneck = null;
  if (zs.stock >= capacity) bottleneck = 'warehouse';
  else if (extraction > transport) bottleneck = 'transport';
  return { extraction, transport, real, price, income: real * price, capacity, bottleneck, boosted };
}

// Ingresos por segundo de todas las zonas activas.
export function totalIncome(state, now) {
  let total = 0;
  for (const def of ZONES) total += zoneRates(state.zones[def.id], def, now).income;
  return total;
}

// Termina las construcciones cuyo tiempo ya ha pasado. Devuelve sus ids.
export function completeBuilds(state, now) {
  const done = [];
  for (const def of ZONES) {
    const zs = state.zones[def.id];
    if (!zs.unlocked && zs.buildEndsAt !== null && now >= zs.buildEndsAt) {
      zs.unlocked = true;
      zs.buildEndsAt = null;
      done.push(def.id);
    }
  }
  return done;
}

export function sellZone(state, zoneId) {
  const zs = state.zones[zoneId];
  const earned = zs.stock * unitPrice(zs, ZONES_BY_ID[zoneId]);
  zs.stock = 0;
  state.coins += earned;
  state.totalEarned += earned;
  return earned;
}

// Avanza una zona `dt` segundos a ritmo constante.
export function advanceZone(state, zoneId, dt, now, { autoSell = true } = {}) {
  const def = ZONES_BY_ID[zoneId];
  const zs = state.zones[zoneId];
  const r = zoneRates(zs, def, now);
  if (!zs.unlocked || dt <= 0) return { produced: 0, earned: 0 };

  const space = Math.max(0, r.capacity - zs.stock);
  const produced = Math.min(r.real * dt, space);
  zs.stock += produced;
  zs.totalProduced += produced;

  // Montón visual en el frente: crece si el transporte no da abasto.
  zs.jam = r.extraction > r.transport
    ? Math.min(1, zs.jam + dt / 10)
    : Math.max(0, zs.jam - dt / 3);

  const earned = autoSell && zs.salesManager ? sellZone(state, zoneId) : 0;
  return { produced, earned };
}

// Avanza toda la partida `dt` segundos (un tick económico).
export function advanceGame(state, dt, now, opts) {
  const built = completeBuilds(state, now);
  let produced = 0;
  let earned = 0;
  for (const def of ZONES) {
    const res = advanceZone(state, def.id, dt, now, opts);
    produced += res.produced;
    earned += res.earned;
  }
  state.lastTick = now;
  return { produced, earned, built };
}
