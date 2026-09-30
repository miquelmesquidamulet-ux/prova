// Fórmulas base de la economía (sección 5). Funciones puras.
import { MILESTONES, UPGRADES } from '../data/upgrades.js';

// Número de hitos alcanzados con un nivel dado.
export function milestonesReached(level) {
  let count = 0;
  for (const m of MILESTONES) if (level >= m) count++;
  return count;
}

// Siguiente hito por encima del nivel actual, o null si ya no quedan.
export function nextMilestone(level) {
  for (const m of MILESTONES) if (level < m) return m;
  return null;
}

// coste del siguiente nivel = coste_base × crecimiento^(nivel − 1)
export function levelCost(def, level, costMult = 1) {
  return def.baseCost * costMult * Math.pow(def.growth, level - 1);
}

// Coste de comprar `count` niveles a partir de `level` (suma geométrica).
export function bulkCost(def, level, count, costMult = 1) {
  if (count <= 0) return 0;
  const g = def.growth;
  return levelCost(def, level, costMult) * (Math.pow(g, count) - 1) / (g - 1);
}

// Máximo de niveles que se pueden pagar con `coins` a partir de `level`.
export function maxAffordable(def, level, coins, costMult = 1) {
  const first = levelCost(def, level, costMult);
  if (coins < first) return 0;
  const g = def.growth;
  let n = Math.floor(Math.log(coins * (g - 1) / first + 1) / Math.log(g));
  // Corrige errores de redondeo en coma flotante.
  while (n > 0 && bulkCost(def, level, n, costMult) > coins) n--;
  while (bulkCost(def, level, n + 1, costMult) <= coins) n++;
  return n;
}

// Valor lineal con duplicación en cada hito (herramienta y transporte).
function linearWithMilestones(def, level) {
  return (def.baseValue + def.perLevel * (level - 1)) * Math.pow(2, milestonesReached(level));
}

// velocidad de herramienta = (1 + 0,5 × (nivel − 1)) × 2^(hitos alcanzados)
export function toolSpeed(level) {
  return linearWithMilestones(UPGRADES.tool, level);
}

// capacidad de transporte = (3 + 2 × (nivel − 1)) × 2^(hitos alcanzados)
export function transportCapacity(level) {
  return linearWithMilestones(UPGRADES.transport, level);
}

// Coste del siguiente minero (tener `workers` mineros y comprar uno más).
export function workerCost(workers, costMult = 1) {
  const def = UPGRADES.workers;
  if (workers >= def.max) return Infinity;
  return def.costs[workers - 1] * costMult;
}

// Horas de producción que caben en el almacén.
export function warehouseHours(level) {
  const def = UPGRADES.warehouse;
  return def.baseHours + def.hoursPerLevel * (level - 1);
}

export function warehouseCost(level, costMult = 1) {
  const def = UPGRADES.warehouse;
  if (level >= def.maxLevel) return Infinity;
  return levelCost(def, level, costMult);
}

// Aspecto de la estación según el nivel (sección 9).
export function stageFor(def, level) {
  let stage = def.stages[0];
  for (const s of def.stages) if (level >= s.level) stage = s;
  return stage;
}
