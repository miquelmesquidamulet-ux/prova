// Tutorial de los primeros minutos (sección 16): un dedo que señala y frases
// de menos de diez palabras. Cada paso se muestra cuando tiene sentido y se da
// por hecho en cuanto el jugador lo ha conseguido, aunque sea por su cuenta.
import { h, setText, setClass } from './dom.js';
import { zoneRates } from '../core/production.js';
import { upgradeQuote, salesManagerCost } from '../core/actions.js';
import { workerCost } from '../core/formulas.js';
import { ZONES_BY_ID } from '../data/zones.js';

const Q = 'quarry';
const quarry = (s) => s.zones[Q];

export const STEPS = [
  {
    text: 'Toca VENDER para cobrar',
    done: (s) => s.totalEarned > 0,
    when: (s) => quarry(s).stock >= 1,
    target: { zone: Q, station: 'warehouse', selector: '#sell' },
  },
  {
    text: 'Mejora la herramienta',
    done: (s) => quarry(s).tool >= 2,
    when: (s) => upgradeQuote(s, Q, 'tool', 1).affordable,
    target: { zone: Q, station: 'front', selector: '[data-buy="tool"]' },
  },
  {
    text: '¡Atasco! Mejora el transporte',
    done: (s) => quarry(s).transport >= 2,
    when: (s, now) => zoneRates(quarry(s), ZONES_BY_ID[Q], now).bottleneck === 'transport',
    target: { zone: Q, station: 'transport', selector: '[data-buy="transport"]' },
  },
  {
    text: 'Contrata otro minero',
    done: (s) => quarry(s).workers >= 2,
    when: (s) => s.coins >= workerCost(1),
    target: { zone: Q, station: 'front', selector: '[data-buy="workers"]' },
  },
  {
    text: 'Un encargado venderá por ti',
    done: (s) => quarry(s).salesManager,
    when: (s) => s.coins >= salesManagerCost(Q),
    target: { zone: Q, station: 'warehouse', selector: '[data-buy="manager"]' },
  },
  {
    text: 'Desbloquea la mina de carbón',
    done: (s) => s.zones.coal.unlocked || s.zones.coal.buildEndsAt !== null,
    when: (s) => s.coins >= ZONES_BY_ID.coal.unlockCost,
    target: { zone: 'coal', selector: '#unlock' },
  },
  {
    text: 'La primera aceleración es gratis',
    done: (s) => s.zones.coal.unlocked,
    when: () => true,
    target: { zone: 'coal', selector: '#speedup' },
  },
];

export class Tutorial {
  constructor(app) {
    this.app = app;
    this.el = h('div', { class: 'tutorial hidden', 'aria-live': 'polite' },
      this.bubble = h('div', { class: 'tutorial-bubble' }),
      this.finger = h('div', { class: 'tutorial-finger', text: '👆' }));
    document.body.append(this.el);
  }

  get finished() {
    return this.app.state.tutorial.step >= STEPS.length;
  }

  // Elemento al que hay que señalar: primero la zona, luego la estación y
  // por último el botón concreto.
  resolveTarget(target) {
    const app = this.app;
    if (app.zoneId !== target.zone) {
      const zones = app.visibleZones().map((z) => z.id);
      const forward = zones.indexOf(target.zone) > zones.indexOf(app.zoneId);
      return document.querySelector(forward ? '[aria-label="Zona siguiente"]' : '[aria-label="Zona anterior"]');
    }
    if (target.station && app.station !== target.station) {
      return document.querySelector(`.station-${target.station}`);
    }
    return document.querySelector(target.selector);
  }

  update(now) {
    const s = this.app.state;
    while (!this.finished && STEPS[s.tutorial.step].done(s)) s.tutorial.step++;
    const step = this.finished ? null : STEPS[s.tutorial.step];
    const visible = step && !this.app.offlinePending && step.when(s, now);
    const targetEl = visible ? this.resolveTarget(step.target) : null;
    if (!targetEl || targetEl.offsetParent === null) {
      setClass(this.el, 'hidden', true);
      return;
    }
    setClass(this.el, 'hidden', false);
    setText(this.bubble, step.text);
    const rect = targetEl.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.6;
    this.finger.style.transform = `translate(${x - 14}px, ${y}px)`;
    // El texto va encima del dedo, sin salirse de la pantalla.
    const width = Math.min(260, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, x - width / 2));
    this.bubble.style.width = `${width}px`;
    const bubbleTop = y + 56 + 44 < window.innerHeight ? y + 56 : rect.top - 52;
    this.bubble.style.transform = `translate(${left}px, ${bubbleTop}px)`;
  }
}
