// Simulador de equilibrado (sección 21): un jugador activo que siempre compra
// la mejor opción disponible. Compara sus tiempos con los objetivos del documento.
//
//   npm run sim            → resumen de hitos
//   npm run sim -- --log   → además, cada compra
//   npm run sim -- --reaccion 15 → el jugador solo actúa cada 15 s (más realista)
import { createGameState } from '../src/core/state.js';
import { advanceGame, totalIncome } from '../src/core/production.js';
import {
  upgradeQuote, buyUpgrade, buyWorker, hireSalesManager, sell, unlockZone,
  freeSpeedup, canFreeSpeedup, salesManagerCost, nextLockedZone,
} from '../src/core/actions.js';
import {
  workerCost, toolSpeed, transportCapacity, bulkCost,
} from '../src/core/formulas.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { ZONES, NEXT_CONTENT_TEASER } from '../src/data/zones.js';
import { formatDuration, formatMoney } from '../src/core/format.js';

const LOG = process.argv.includes('--log');
const reactionArg = process.argv.indexOf('--reaccion');
const REACTION = reactionArg > 0 ? Number(process.argv[reactionArg + 1]) : 1;
const DT = 0.2;
const LIMIT = 60 * 60; // una hora de juego activo como máximo
const SAVE_WINDOW = 120; // ahorra para la siguiente zona si cuesta < 2 min de ingresos

// Ingresos/s si aplicamos `mutate` a una copia del estado.
function incomeAfter(state, now, mutate) {
  const copy = structuredClone(state);
  mutate(copy);
  return totalIncome(copy, now);
}

// Niveles de transporte que faltan para mover `extraction` unidades por segundo.
function transportLevelsNeeded(zs, extraction) {
  let k = 0;
  while (transportCapacity(zs.transport + k) < extraction) k++;
  return k;
}

// Una mejora del frente acompañada del transporte necesario para aprovecharla,
// como haría un jugador que mira el cuello de botella.
function frontOption(state, def, label, frontCost, frontBuy, frontApply) {
  const zs = state.zones[def.id];
  const after = structuredClone(zs);
  frontApply(after);
  const k = transportLevelsNeeded(zs, after.workers * toolSpeed(after.tool));
  const transCost = bulkCost(UPGRADES.transport, zs.transport, k, def.costMult);
  return {
    label: k > 0 ? `${label} + transporte ×${k}` : label,
    cost: frontCost + transCost,
    buy: (s) => {
      frontBuy(s);
      if (k > 0) buyUpgrade(s, def.id, 'transport', k);
    },
    apply: (s) => {
      frontApply(s.zones[def.id]);
      s.zones[def.id].transport += k;
    },
  };
}

function options(state, now) {
  const opts = [];
  for (const def of ZONES) {
    const zs = state.zones[def.id];
    if (!zs.unlocked) continue;
    opts.push(frontOption(state, def, `${def.id}.herramienta→${zs.tool + 1}`,
      upgradeQuote(state, def.id, 'tool', 1).cost,
      (s) => buyUpgrade(s, def.id, 'tool', 1),
      (z) => { z.tool += 1; }));
    opts.push({ label: `${def.id}.transporte→${zs.transport + 1}`,
      cost: upgradeQuote(state, def.id, 'transport', 1).cost,
      buy: (s) => buyUpgrade(s, def.id, 'transport', 1),
      apply: (s) => { s.zones[def.id].transport += 1; } });
    const wc = workerCost(zs.workers, def.costMult);
    if (Number.isFinite(wc)) {
      opts.push(frontOption(state, def, `${def.id}.minero ${zs.workers + 1}`, wc,
        (s) => buyWorker(s, def.id),
        (z) => { z.workers += 1; }));
    }
    if (!zs.salesManager) {
      opts.push({ label: `${def.id}.encargado`, cost: salesManagerCost(def.id),
        buy: (s) => hireSalesManager(s, def.id),
        apply: (s) => { s.zones[def.id].salesManager = true; } });
    }
  }
  return opts;
}

// Elige la opción que antes se «paga sola» contando el tiempo de ahorro.
function bestOption(state, now) {
  const income = Math.max(totalIncome(state, now), 1e-9);
  let best = null;
  for (const o of options(state, now)) {
    const gain = incomeAfter(state, now, o.apply) - income;
    if (gain <= 0) continue;
    const wait = Math.max(0, o.cost - state.coins) / income;
    const score = wait + o.cost / gain;
    if (!best || score < best.score) best = { ...o, score };
  }
  return best;
}

// Siguiente zona que perseguir: la primera bloqueada o, si no quedan, la zona 3
// del documento (aún sin implementar) como referencia de ritmo.
function nextTarget(state) {
  const next = nextLockedZone(state);
  if (next) return state.zones[next.id].buildEndsAt === null ? next : null;
  return { id: 'teaser', name: NEXT_CONTENT_TEASER.name, unlockCost: NEXT_CONTENT_TEASER.unlockCost };
}

const s = createGameState(0);
const events = [];
const mark = (t, text) => events.push([t, text]);
const seen = new Set();
let t = 0;

while (t < LIMIT) {
  const now = t * 1000;
  // El jugador solo mira la pantalla cada REACTION segundos.
  if (Math.round(t / DT) % Math.round(REACTION / DT) !== 0) {
    advanceGame(s, DT, now);
    t += DT;
    continue;
  }
  for (const def of ZONES) sell(s, def.id);

  // Si la siguiente zona cuesta menos de SAVE_WINDOW segundos de ingresos,
  // deja de comprar mejoras y ahorra para ella.
  const target = nextTarget(s);
  const saving = target && target.unlockCost <= SAVE_WINDOW * totalIncome(s, now);
  if (saving && s.coins >= target.unlockCost) {
    if (target.id === 'teaser') {
      mark(t, `podría pagar la ${target.name} (${formatMoney(target.unlockCost)})`);
      break;
    }
    unlockZone(s, target.id, now);
    mark(t, `desbloquea la ${target.name}`);
  }

  let o;
  while (!saving && (o = bestOption(s, now)) && s.coins >= o.cost) {
    o.buy(s);
    if (LOG) mark(t, `  compra ${o.label} (${formatMoney(o.cost)})`);
    const q = s.zones.quarry;
    if (!seen.has('tool1') && q.tool > 1) { seen.add('tool1'); mark(t, 'primera mejora de herramienta'); }
    if (!seen.has('trans') && q.transport > 1) { seen.add('trans'); mark(t, 'primera mejora de transporte (atasco)'); }
    if (!seen.has('w2') && q.workers >= 2) { seen.add('w2'); mark(t, 'segundo minero'); }
    if (!seen.has('mgr') && q.salesManager) { seen.add('mgr'); mark(t, 'encargado de ventas'); }
    if (!seen.has('tool10') && q.tool >= 10) { seen.add('tool10'); mark(t, 'herramienta nivel 10 (primer ×2)'); }
  }
  for (const def of ZONES) if (canFreeSpeedup(s, def.id, now)) freeSpeedup(s, def.id, now);

  advanceGame(s, DT, now);
  t += DT;
}

console.log(`Filón · simulación de un jugador activo sin anuncios (actúa cada ${REACTION} s)\n`);
for (const [time, text] of events) console.log(`${formatDuration(time).padStart(10)}  ${text}`);
console.log('\nObjetivos del documento (secciones 16 y 17):');
console.log('  0:15 primera mejora · 1:00 atasco · 2:00 segundo minero · 3:00 encargado');
console.log('  4:30 herramienta nivel 10 · 6:00 mina de carbón · 20 min mina de hierro ($40K)');
console.log(`\nAl final (${formatDuration(t)}): ${formatMoney(totalIncome(s, t * 1000))}/s, ganado ${formatMoney(s.totalEarned)}`);
for (const def of ZONES) {
  const zs = s.zones[def.id];
  console.log(`  ${def.name}: herramienta ${zs.tool}, transporte ${zs.transport}, mineros ${zs.workers}`);
}
