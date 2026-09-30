// Acciones del jugador. Todas validan el coste y devuelven { ok, … }.
import { ZONES, ZONES_BY_ID } from '../data/zones.js';
import { UPGRADES, SALES_MANAGER, TAP_BOOST, MILESTONES } from '../data/upgrades.js';
import {
  bulkCost, maxAffordable, workerCost, warehouseCost,
} from './formulas.js';
import { zoneStatus, sellZone } from './production.js';

// Cuánto cuesta comprar herramienta o transporte en modo ×1, ×10 o ×Máx.
export function upgradeQuote(state, zoneId, kind, mode) {
  const def = UPGRADES[kind];
  const zs = state.zones[zoneId];
  const mult = ZONES_BY_ID[zoneId].costMult;
  const level = zs[kind];
  let count;
  if (mode === 'max') count = Math.max(1, maxAffordable(def, level, state.coins, mult));
  else count = mode;
  const cost = bulkCost(def, level, count, mult);
  return { count, cost, affordable: state.coins >= cost };
}

export function buyUpgrade(state, zoneId, kind, mode = 1) {
  const zs = state.zones[zoneId];
  if (!zs.unlocked) return { ok: false };
  const q = upgradeQuote(state, zoneId, kind, mode);
  if (!q.affordable) return { ok: false };
  const from = zs[kind];
  state.coins -= q.cost;
  zs[kind] += q.count;
  const milestones = MILESTONES.filter((m) => m > from && m <= zs[kind]);
  return { ok: true, count: q.count, cost: q.cost, level: zs[kind], milestones };
}

export function buyWorker(state, zoneId) {
  const zs = state.zones[zoneId];
  const cost = workerCost(zs.workers, ZONES_BY_ID[zoneId].costMult);
  if (!zs.unlocked || state.coins < cost) return { ok: false };
  state.coins -= cost;
  zs.workers += 1;
  return { ok: true, cost, workers: zs.workers };
}

export function buyWarehouse(state, zoneId) {
  const zs = state.zones[zoneId];
  const cost = warehouseCost(zs.warehouse, ZONES_BY_ID[zoneId].costMult);
  if (!zs.unlocked || state.coins < cost) return { ok: false };
  state.coins -= cost;
  zs.warehouse += 1;
  return { ok: true, cost, level: zs.warehouse };
}

export function salesManagerCost(zoneId) {
  return SALES_MANAGER.cost * ZONES_BY_ID[zoneId].costMult;
}

export function hireSalesManager(state, zoneId) {
  const zs = state.zones[zoneId];
  const cost = salesManagerCost(zoneId);
  if (!zs.unlocked || zs.salesManager || state.coins < cost) return { ok: false };
  state.coins -= cost;
  zs.salesManager = true;
  // Vende lo que ya había en el almacén.
  sellZone(state, zoneId);
  return { ok: true, cost };
}

export function sell(state, zoneId) {
  const earned = sellZone(state, zoneId);
  return { ok: earned > 0, earned };
}

// Primera zona sin desbloquear, en orden. null si están todas.
export function nextLockedZone(state) {
  return ZONES.find((z) => !state.zones[z.id].unlocked) || null;
}

export function unlockZone(state, zoneId, now) {
  const def = ZONES_BY_ID[zoneId];
  const zs = state.zones[zoneId];
  const next = nextLockedZone(state);
  if (!next || next.id !== zoneId) return { ok: false };
  if (zoneStatus(zs, now) !== 'locked' || state.coins < def.unlockCost) return { ok: false };
  state.coins -= def.unlockCost;
  zs.buildEndsAt = now + def.buildSeconds * 1000;
  return { ok: true, cost: def.unlockCost, buildEndsAt: zs.buildEndsAt };
}

// La primera aceleración de construcción es gratis (tutorial, sección 6).
export function canFreeSpeedup(state, zoneId, now) {
  return !state.flags.freeSpeedupUsed && zoneStatus(state.zones[zoneId], now) === 'building';
}

export function freeSpeedup(state, zoneId, now) {
  if (!canFreeSpeedup(state, zoneId, now)) return { ok: false };
  state.flags.freeSpeedupUsed = true;
  state.zones[zoneId].buildEndsAt = now;
  return { ok: true };
}

// Tocar el frente: +50 % de velocidad durante 5 s. Opcional y nunca necesario.
export function tapFront(state, zoneId, now) {
  const zs = state.zones[zoneId];
  if (!zs.unlocked) return { ok: false };
  zs.boostUntil = now + TAP_BOOST.durationMs;
  return { ok: true };
}
