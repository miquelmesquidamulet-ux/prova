import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumber, formatMoney, formatMoneyRate, formatCost, formatRate, formatDuration, suffixFor,
} from '../src/core/format.js';

test('hasta 999.999 se muestra completo con punto de miles', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(7.9), '7');
  assert.equal(formatNumber(18420), '18.420');
  assert.equal(formatNumber(999999), '999.999');
  assert.equal(formatMoney(42350), '$42.350');
});

test('a partir del millón, sufijos con 4 cifras significativas', () => {
  assert.equal(formatNumber(1e6), '1M');
  assert.equal(formatNumber(1.2e9), '1,2B');
  assert.equal(formatNumber(42.35e6), '42,35M');
  assert.equal(formatNumber(123.456e12), '123,4T');
  assert.equal(formatNumber(1e15), '1aa');
  assert.equal(formatNumber(2.5e18), '2,5ab');
  // Trunca en vez de redondear: nunca muestra 1.000M.
  assert.equal(formatNumber(999.99e6), '999,9M');
});

test('sufijos aa, ab… az, ba', () => {
  assert.equal(suffixFor(2), 'M');
  assert.equal(suffixFor(5), 'aa');
  assert.equal(suffixFor(30), 'az');
  assert.equal(suffixFor(31), 'ba');
});

test('los costes se redondean hacia arriba', () => {
  assert.equal(formatCost(17.49), '$18');
  assert.equal(formatCost(10), '$10');
  assert.equal(formatCost(Infinity), '—');
});

test('ritmos con un decimal cuando son pequeños', () => {
  assert.equal(formatRate(1.5), '1,5');
  assert.equal(formatRate(3), '3');
  assert.equal(formatRate(0.25), '0,2');
  assert.equal(formatRate(1234), '1.234');
  assert.equal(formatMoneyRate(1.5), '$1,5');
});

test('duraciones legibles', () => {
  assert.equal(formatDuration(12), '12 s');
  assert.equal(formatDuration(252), '4 min 12 s');
  assert.equal(formatDuration(6 * 3600 + 12 * 60), '6 h 12 min');
  assert.equal(formatDuration(2 * 86400 + 3 * 3600), '2 d 3 h');
  assert.equal(formatDuration(Infinity), '∞');
});
