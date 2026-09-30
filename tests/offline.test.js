import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/core/state.js';
import { advanceGame } from '../src/core/production.js';
import { simulateOffline, collectOffline } from '../src/core/offline.js';
import { unlockZone } from '../src/core/actions.js';
import {
  serialize, deserialize, saveGame, loadGame, clearGame, SAVE_KEY,
} from '../src/core/save.js';

const T0 = 1_700_000_000_000;
const HOUR = 3600 * 1000;

test('offline produce al 100 % pero solo hasta llenar el almacén (2 h)', () => {
  const s = createGameState(T0);
  const r = simulateOffline(s, T0, T0 + 6 * HOUR);
  assert.equal(r.elapsedSeconds, 6 * 3600);
  assert.equal(r.produced, 2 * 3600);
  assert.equal(r.value, 2 * 3600);
  assert.equal(s.coins, 0, 'nadie vende offline, ni con encargado');
  assert.equal(collectOffline(s), 2 * 3600);
  assert.equal(s.coins, 2 * 3600);
});

test('offline da lo mismo que jugar online el mismo tiempo', () => {
  const a = createGameState(T0);
  const b = createGameState(T0);
  for (const s of [a, b]) {
    s.zones.quarry.tool = 12;
    s.zones.quarry.transport = 4;
    s.zones.quarry.workers = 3;
  }
  simulateOffline(a, T0, T0 + 600_000);
  for (let i = 0; i < 3000; i++) advanceGame(b, 0.2, T0 + i * 200, { autoSell: false });
  assert.ok(Math.abs(a.zones.quarry.stock - b.zones.quarry.stock) < 1e-6);
});

test('una construcción que termina offline empieza a producir desde ese momento', () => {
  const s = createGameState(T0);
  s.coins = 2500;
  unlockZone(s, 'coal', T0); // 30 s de construcción
  const r = simulateOffline(s, T0, T0 + 130_000);
  assert.equal(s.zones.coal.unlocked, true);
  assert.equal(r.perZone.coal, 100);
  assert.equal(r.perZone.quarry, 130);
});

test('cambiar el reloj hacia atrás no da producción negativa', () => {
  const s = createGameState(T0);
  const r = simulateOffline(s, T0, T0 - 5 * HOUR);
  assert.equal(r.produced, 0);
  assert.equal(s.zones.quarry.stock, 0);
  assert.equal(s.lastTick, T0 - 5 * HOUR);
});

test('el toque de aceleración no cuenta offline', () => {
  const s = createGameState(T0);
  s.zones.quarry.boostUntil = T0 + 5000;
  const r = simulateOffline(s, T0, T0 + 10_000);
  assert.equal(r.produced, 10);
});

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('guardar y cargar conserva la partida', () => {
  const storage = memoryStorage();
  const s = createGameState(T0);
  s.coins = 1234.5;
  s.zones.quarry.tool = 17;
  s.zones.coal.buildEndsAt = T0 + 30_000;
  assert.ok(saveGame(s, storage));
  const loaded = loadGame(T0 + 1, storage);
  assert.deepEqual(loaded, s);
  clearGame(storage);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(loadGame(T0, storage), null);
});

test('un guardado corrupto o incompleto no rompe el juego', () => {
  assert.equal(deserialize('{no es json', T0), null);
  const partial = deserialize(JSON.stringify({ coins: 50, zones: { quarry: { tool: 4 } } }), T0);
  assert.equal(partial.coins, 50);
  assert.equal(partial.zones.quarry.tool, 4);
  assert.equal(partial.zones.quarry.transport, 1);
  assert.equal(partial.zones.coal.unlocked, false);
  const round = deserialize(serialize(partial), T0);
  assert.deepEqual(round, partial);
});

test('guardar sin almacenamiento disponible no lanza errores', () => {
  const broken = { setItem() { throw new Error('lleno'); }, getItem() { throw new Error('no'); } };
  assert.equal(saveGame(createGameState(T0), broken), false);
  assert.equal(loadGame(T0, broken), null);
});
