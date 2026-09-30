import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  milestonesReached, nextMilestone, levelCost, bulkCost, maxAffordable,
  toolSpeed, transportCapacity, workerCost, warehouseHours, stageFor,
} from '../src/core/formulas.js';
import { UPGRADES } from '../src/data/upgrades.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('hitos en 10, 25, 50, 100, 150 y 200', () => {
  assert.equal(milestonesReached(1), 0);
  assert.equal(milestonesReached(9), 0);
  assert.equal(milestonesReached(10), 1);
  assert.equal(milestonesReached(25), 2);
  assert.equal(milestonesReached(200), 6);
  assert.equal(milestonesReached(999), 6);
  assert.equal(nextMilestone(7), 10);
  assert.equal(nextMilestone(10), 25);
  assert.equal(nextMilestone(200), null);
});

// Tabla «Ejemplo: herramienta y transporte de la cantera» (sección 5).
test('la tabla de ejemplo de la cantera coincide con el documento', () => {
  const rows = [
    // nivel, piedras/s, coste herramienta, transporte, coste transporte
    [1, 1, 10, 3, 15],
    [5, 3, 17, 11, 26],
    [10, 11, 35, 42, 53],
    [25, 52, 286, 204, 429],
    [50, 204, 9400, 808, 14000],
    [100, 808, 10e6, 3216, 15e6],
  ];
  for (const [lvl, speed, toolC, cap, transC] of rows) {
    assert.equal(toolSpeed(lvl), speed, `velocidad nivel ${lvl}`);
    assert.equal(transportCapacity(lvl), cap, `transporte nivel ${lvl}`);
    close(levelCost(UPGRADES.tool, lvl), toolC, 0.05);
    close(levelCost(UPGRADES.transport, lvl), transC, 0.05);
  }
});

test('coste en bloque y máximo asequible', () => {
  const def = UPGRADES.tool;
  close(bulkCost(def, 1, 1), 10);
  close(bulkCost(def, 1, 2), 10 + 11.5);
  assert.equal(bulkCost(def, 1, 0), 0);
  let manual = 0;
  for (let l = 3; l < 13; l++) manual += levelCost(def, l);
  close(bulkCost(def, 3, 10), manual, 1e-9);

  assert.equal(maxAffordable(def, 1, 9.99), 0);
  assert.equal(maxAffordable(def, 1, 10), 1);
  assert.equal(maxAffordable(def, 1, 21.5), 2);
  const n = maxAffordable(def, 1, 1e6);
  assert.ok(bulkCost(def, 1, n) <= 1e6);
  assert.ok(bulkCost(def, 1, n + 1) > 1e6);
});

test('el multiplicador de coste de zona escala todos los precios', () => {
  close(levelCost(UPGRADES.tool, 1, 20), 200);
  assert.equal(workerCost(1, 20), 2000);
});

test('mineros: de 1 a 10 con los costes del documento', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((w) => workerCost(w)), [100, 400, 1500, 6000, 25000]);
  assert.equal(workerCost(10), Infinity);
});

test('el almacén va de 2 h a 12 h', () => {
  assert.equal(warehouseHours(1), 2);
  assert.equal(warehouseHours(UPGRADES.warehouse.maxLevel), 12);
});

test('el aspecto de las estaciones cambia en los hitos 25, 50, 100 y 150', () => {
  assert.equal(stageFor(UPGRADES.tool, 1).name, 'Pico');
  assert.equal(stageFor(UPGRADES.tool, 24).name, 'Pico');
  assert.equal(stageFor(UPGRADES.tool, 25).name, 'Martillo neumático');
  assert.equal(stageFor(UPGRADES.transport, 100).name, 'Cinta transportadora');
  assert.equal(stageFor(UPGRADES.transport, 180).name, 'Tren minero');
});
