// Sugiere la mejora más atractiva que el jugador puede pagar ahora mismo
// (sección 10: se resalta justo después de recoger lo acumulado offline).
import { ZONES, ZONES_BY_ID } from '../data/zones.js';
import { upgradeQuote } from './actions.js';
import { workerCost } from './formulas.js';
import { totalIncome } from './production.js';

const LABELS = { tool: 'Mejorar herramienta', transport: 'Mejorar transporte', workers: 'Contratar minero' };
const STATION = { tool: 'front', transport: 'transport', workers: 'front' };

export function suggestUpgrade(state, now) {
  const base = totalIncome(state, now);
  let best = null;
  for (const def of ZONES) {
    const zs = state.zones[def.id];
    if (!zs.unlocked) continue;
    const candidates = [
      ['tool', upgradeQuote(state, def.id, 'tool', 1).cost, (z) => { z.tool += 1; }],
      ['transport', upgradeQuote(state, def.id, 'transport', 1).cost, (z) => { z.transport += 1; }],
      ['workers', workerCost(zs.workers, ZONES_BY_ID[def.id].costMult), (z) => { z.workers += 1; }],
    ];
    for (const [kind, cost, apply] of candidates) {
      if (!(cost <= state.coins)) continue;
      const copy = structuredClone(state);
      apply(copy.zones[def.id]);
      const gain = totalIncome(copy, now) - base;
      if (gain <= 0) continue;
      const value = gain / cost;
      if (!best || value > best.value) {
        best = { zoneId: def.id, kind, station: STATION[kind], cost, gain, value, label: LABELS[kind] };
      }
    }
  }
  return best;
}
