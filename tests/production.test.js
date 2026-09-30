import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/core/state.js';
import {
  zoneRates, advanceGame, totalIncome, zoneStatus,
} from '../src/core/production.js';
import {
  buyUpgrade, buyWorker, buyWarehouse, hireSalesManager, sell, unlockZone,
  freeSpeedup, canFreeSpeedup, tapFront, upgradeQuote,
} from '../src/core/actions.js';
import { ZONES_BY_ID } from '../src/data/zones.js';

const T0 = 1_700_000_000_000;
const quarry = ZONES_BY_ID.quarry;

test('al empezar, un minero saca 1 piedra por segundo', () => {
  const s = createGameState(T0);
  const r = zoneRates(s.zones.quarry, quarry, T0);
  assert.equal(r.extraction, 1);
  assert.equal(r.transport, 3);
  assert.equal(r.real, 1);
  assert.equal(r.income, 1);
  assert.equal(r.bottleneck, null);
});

test('producción real = mínimo(extracción, transporte) y el atasco se marca', () => {
  const s = createGameState(T0);
  const zs = s.zones.quarry;
  zs.workers = 2;
  zs.tool = 5; // 3 piedras/s por minero → 6 extracción; transporte 3
  const r = zoneRates(zs, quarry, T0);
  assert.equal(r.extraction, 6);
  assert.equal(r.real, 3);
  assert.equal(r.bottleneck, 'transport');
  advanceGame(s, 10, T0);
  assert.equal(zs.stock, 30);
  assert.ok(zs.jam > 0, 'se acumula mineral en el frente');
});

test('sin encargado el mineral se guarda hasta pulsar VENDER', () => {
  const s = createGameState(T0);
  advanceGame(s, 10, T0);
  assert.equal(s.zones.quarry.stock, 10);
  assert.equal(s.coins, 0);
  const res = sell(s, 'quarry');
  assert.equal(res.earned, 10);
  assert.equal(s.coins, 10);
  assert.equal(s.zones.quarry.stock, 0);
});

test('primera compra a los 10 segundos: herramienta de $10', () => {
  const s = createGameState(T0);
  advanceGame(s, 10, T0);
  sell(s, 'quarry');
  const r = buyUpgrade(s, 'quarry', 'tool', 1);
  assert.ok(r.ok);
  assert.equal(s.coins, 0);
  assert.equal(zoneRates(s.zones.quarry, quarry, T0).extraction, 1.5);
});

test('las compras sin dinero fallan y no cambian nada', () => {
  const s = createGameState(T0);
  assert.equal(buyUpgrade(s, 'quarry', 'tool', 1).ok, false);
  assert.equal(buyWorker(s, 'quarry').ok, false);
  assert.equal(buyWarehouse(s, 'quarry').ok, false);
  assert.equal(hireSalesManager(s, 'quarry').ok, false);
  assert.equal(s.zones.quarry.tool, 1);
  assert.equal(s.coins, 0);
});

test('×10 y ×Máx compran varios niveles e informan de los hitos', () => {
  const s = createGameState(T0);
  s.coins = 1e6;
  const q = upgradeQuote(s, 'quarry', 'tool', 10);
  assert.equal(q.count, 10);
  const r = buyUpgrade(s, 'quarry', 'tool', 10);
  assert.equal(r.level, 11);
  assert.deepEqual(r.milestones, [10]);
  const m = buyUpgrade(s, 'quarry', 'tool', 'max');
  assert.ok(m.count > 1);
  assert.ok(s.coins >= 0);
  assert.ok(s.coins < upgradeQuote(s, 'quarry', 'tool', 1).cost);
});

test('el encargado de ventas vende de forma continua con +10 %', () => {
  const s = createGameState(T0);
  s.coins = 250;
  assert.ok(hireSalesManager(s, 'quarry').ok);
  advanceGame(s, 10, T0);
  assert.equal(s.zones.quarry.stock, 0);
  assert.ok(Math.abs(s.coins - 11) < 1e-9);
});

test('el almacén lleno detiene la producción', () => {
  const s = createGameState(T0);
  advanceGame(s, 3 * 3600, T0); // 3 h con un almacén de 2 h
  assert.equal(s.zones.quarry.stock, 2 * 3600);
  assert.equal(zoneRates(s.zones.quarry, quarry, T0).bottleneck, 'warehouse');
  s.coins = 1e6;
  assert.ok(buyWarehouse(s, 'quarry').ok);
  assert.equal(zoneRates(s.zones.quarry, quarry, T0).capacity, 3 * 3600);
});

test('máximo 10 mineros', () => {
  const s = createGameState(T0);
  s.coins = 1e12;
  for (let i = 0; i < 20; i++) buyWorker(s, 'quarry');
  assert.equal(s.zones.quarry.workers, 10);
});

test('desbloquear la mina de carbón: coste, construcción de 30 s y aceleración gratis', () => {
  const s = createGameState(T0);
  assert.equal(unlockZone(s, 'coal', T0).ok, false);
  s.coins = 2500;
  assert.ok(unlockZone(s, 'coal', T0).ok);
  assert.equal(s.coins, 0);
  assert.equal(zoneStatus(s.zones.coal, T0), 'building');
  assert.equal(unlockZone(s, 'coal', T0).ok, false, 'no se paga dos veces');

  advanceGame(s, 1, T0 + 10_000);
  assert.equal(s.zones.coal.unlocked, false);
  assert.ok(canFreeSpeedup(s, 'coal', T0 + 10_000));
  assert.ok(freeSpeedup(s, 'coal', T0 + 10_000).ok);
  advanceGame(s, 0.2, T0 + 10_000);
  assert.equal(s.zones.coal.unlocked, true);
  assert.equal(s.flags.freeSpeedupUsed, true);
});

test('las dos zonas producen a la vez', () => {
  const s = createGameState(T0);
  s.zones.coal.unlocked = true;
  assert.equal(totalIncome(s, T0), 1 + 5);
  advanceGame(s, 10, T0);
  assert.equal(s.zones.quarry.stock, 10);
  assert.equal(s.zones.coal.stock, 10);
});

test('tocar el frente da +50 % durante 5 s', () => {
  const s = createGameState(T0);
  tapFront(s, 'quarry', T0);
  assert.equal(zoneRates(s.zones.quarry, quarry, T0 + 4000).extraction, 1.5);
  assert.equal(zoneRates(s.zones.quarry, quarry, T0 + 5000).extraction, 1);
});

test('el asesor sugiere una mejora asequible que sube los ingresos', async () => {
  const { suggestUpgrade } = await import('../src/core/advisor.js');
  const s = createGameState(T0);
  assert.equal(suggestUpgrade(s, T0), null, 'sin dinero no hay sugerencia');
  s.coins = 10;
  const sug = suggestUpgrade(s, T0);
  assert.equal(sug.kind, 'tool');
  assert.equal(sug.station, 'front');
  // Con el transporte como cuello de botella, sugiere el transporte.
  s.zones.quarry.tool = 5;
  s.zones.quarry.workers = 2;
  s.coins = 30;
  assert.equal(suggestUpgrade(s, T0).kind, 'transport');
});
