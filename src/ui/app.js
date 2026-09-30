// Interfaz del juego (sección 16). Construye cada vista una vez y la actualiza
// en cada fotograma; el tick económico va aparte, en main.js.
import { h, setText, setClass, setDisabled, setWidth } from './dom.js';
import { ZONES, ZONES_BY_ID, NEXT_CONTENT_TEASER } from '../data/zones.js';
import { RESOURCES } from '../data/resources.js';
import { UPGRADES, SALES_MANAGER, MILESTONES } from '../data/upgrades.js';
import {
  toolSpeed, transportCapacity, warehouseHours, workerCost, warehouseCost,
  nextMilestone, stageFor,
} from '../core/formulas.js';
import { zoneRates, zoneStatus, totalIncome } from '../core/production.js';
import * as act from '../core/actions.js';
import { collectOffline } from '../core/offline.js';
import { suggestUpgrade } from '../core/advisor.js';
import {
  formatMoney, formatMoneyRate, formatCost, formatRate, formatDuration, formatNumber,
} from '../core/format.js';

const STATIONS = [
  { id: 'front', icon: '⛏️', name: 'Frente' },
  { id: 'transport', icon: '🚚', name: 'Transporte' },
  { id: 'warehouse', icon: '🏪', name: 'Almacén' },
];
const MODES = [
  { id: 1, label: '×1' },
  { id: 10, label: '×10' },
  { id: 'max', label: '×Máx' },
];
const TABS = [
  { id: 'mine', icon: '⛏️', name: 'Mina' },
  { id: 'map', icon: '🗺️', name: 'Mapa' },
  { id: 'lab', icon: '🔬', name: 'Laboratorio' },
  { id: 'collection', icon: '🏛️', name: 'Colección' },
  { id: 'shop', icon: '🛍️', name: 'Tienda' },
];

export class App {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.zoneId = game.state.currentZone;
    this.station = 'front';
    this.mode = 1;
    this.displayCoins = game.state.coins;
    this.lastFrame = 0;
    this.viewKey = null;
    this.offlinePending = false;
    this.highlight = null;
    this.buildShell();
  }

  get state() {
    return this.game.state;
  }

  // ---------------------------------------------------------------- estructura

  buildShell() {
    const r = (this.refs = {});
    this.root.append(
      h('header', { class: 'topbar' },
        h('div', { class: 'coins' }, h('span', { class: 'coin-icon', text: '💰' }), r.coins = h('span', { id: 'coins' })),
        r.income = h('div', { class: 'income', id: 'income' }),
        h('button', { class: 'icon-btn', 'aria-label': 'Ajustes', onclick: () => this.showSettings() }, '⚙️')),
      h('section', { class: 'zone-header' },
        r.prev = h('button', { class: 'icon-btn', 'aria-label': 'Zona anterior', onclick: () => this.navigate(-1) }, '◀'),
        h('div', { class: 'zone-title' },
          r.zoneName = h('div', { class: 'zone-name', id: 'zone-name' }),
          r.zoneSub = h('div', { class: 'zone-sub' })),
        r.next = h('button', { class: 'icon-btn', 'aria-label': 'Zona siguiente', onclick: () => this.navigate(1) }, '▶')),
      r.mine = h('main', { class: 'mine', id: 'mine' }),
      r.panel = h('section', { class: 'panel', id: 'panel' }),
      r.goal = h('button', { class: 'goal', id: 'goal', onclick: () => this.onGoalTap() },
        r.goalText = h('span', { class: 'goal-text' }),
        h('span', { class: 'goal-bar' }, r.goalFill = h('span', { class: 'goal-fill' }))),
      h('nav', { class: 'tabbar' }, TABS.map((t) => h('button', {
        class: `tab${t.id === 'mine' ? ' active' : ''}`,
        dataset: { tab: t.id },
        onclick: () => this.onTab(t),
      }, h('span', { class: 'tab-icon', text: t.icon }), h('span', { class: 'tab-name', text: t.name })))),
      r.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' }),
      r.modal = h('div', { class: 'modal-layer hidden' }),
    );
    this.installSwipe(r.mine);
  }

  installSwipe(el) {
    let start = null;
    el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) {
        // Evita que el toque que cierra el deslizamiento cuente como clic.
        this.swiped = true;
        setTimeout(() => { this.swiped = false; }, 0);
        this.navigate(dx < 0 ? 1 : -1);
      }
    });
  }

  // Zonas a las que se puede ir: las abiertas, en construcción y la siguiente.
  visibleZones() {
    const list = [];
    for (const def of ZONES) {
      list.push(def);
      if (!this.state.zones[def.id].unlocked && this.state.zones[def.id].buildEndsAt === null) break;
    }
    return list;
  }

  navigate(delta) {
    const list = this.visibleZones();
    const i = list.findIndex((z) => z.id === this.zoneId);
    const next = list[i + delta];
    if (next) this.goToZone(next.id);
  }

  goToZone(zoneId, station = 'front') {
    this.zoneId = zoneId;
    this.station = station;
    this.state.currentZone = zoneId;
    this.viewKey = null;
  }

  // ---------------------------------------------------------------- fotograma

  // `frameTime` es la marca de requestAnimationFrame y solo sirve para interpolar;
  // la lógica del juego usa siempre la hora real (ms UTC).
  frame(frameTime, now = Date.now()) {
    const dtFrame = this.lastFrame ? Math.min(0.25, (frameTime - this.lastFrame) / 1000) : 0;
    this.lastFrame = frameTime;
    const s = this.state;

    // Contador de monedas interpolado; baja de golpe al comprar.
    if (s.coins < this.displayCoins) this.displayCoins = s.coins;
    else this.displayCoins += (s.coins - this.displayCoins) * Math.min(1, dtFrame * 8);
    if (Math.abs(s.coins - this.displayCoins) < 0.01) this.displayCoins = s.coins;
    setText(this.refs.coins, formatMoney(this.displayCoins));
    setText(this.refs.income, `+${formatMoneyRate(totalIncome(s, now))}/s`);

    const def = ZONES_BY_ID[this.zoneId];
    const zs = s.zones[this.zoneId];
    const status = zoneStatus(zs, now);
    const key = `${this.zoneId}|${status === 'ready' ? 'building' : status}|${this.station}`;
    if (key !== this.viewKey) {
      this.viewKey = key;
      document.body.dataset.theme = def.theme;
      this.buildZoneView(def, status);
    }

    const list = this.visibleZones();
    const idx = list.findIndex((z) => z.id === this.zoneId);
    setDisabled(this.refs.prev, idx <= 0);
    setDisabled(this.refs.next, idx >= list.length - 1);
    setText(this.refs.zoneName, `${def.index} · ${def.name}`);

    this.update?.(now);
    this.updateGoal(now);
  }

  buildZoneView(def, status) {
    const { mine, panel } = this.refs;
    mine.replaceChildren();
    panel.replaceChildren();
    if (status === 'active') this.buildActive(def);
    else if (status === 'locked') this.buildLocked(def);
    else this.buildBuilding(def);
  }

  // ---------------------------------------------------------------- zona activa

  buildActive(def) {
    const res = RESOURCES[def.resource];
    const m = (this.m = {});
    this.refs.mine.append(
      m.front = h('div', {
        class: 'station station-front', dataset: { station: 'front' },
        onclick: () => this.onFrontTap(),
      },
      h('div', { class: 'station-head' },
        h('span', { class: 'station-title', text: '⛏️ Frente de extracción' }),
        m.frontJam = h('span', { class: 'jam-icon', text: '🚧' })),
      h('div', { class: 'scene scene-front' },
        m.miners = h('div', { class: 'miners' }),
        m.pile = h('div', { class: 'pile', text: res.icon.repeat(3) }),
        m.boost = h('div', { class: 'boost', text: '⚡ +50 %' })),
      h('div', { class: 'station-foot' },
        m.frontRate = h('span', { class: 'rate' }),
        m.toolStage = h('span', { class: 'stage' }))),

      m.transport = h('div', {
        class: 'station station-transport', dataset: { station: 'transport' },
        onclick: () => this.selectStation('transport'),
      },
      h('div', { class: 'station-head' },
        h('span', { class: 'station-title', text: '🚚 Transporte' }),
        m.transJam = h('span', { class: 'jam-icon', text: '🚧' })),
      h('div', { class: 'scene scene-transport' },
        h('div', { class: 'track' }),
        m.vehicle = h('div', { class: 'vehicle' })),
      h('div', { class: 'station-foot' },
        m.transRate = h('span', { class: 'rate' }),
        m.transStage = h('span', { class: 'stage' }))),

      m.warehouse = h('div', {
        class: 'station station-warehouse', dataset: { station: 'warehouse' },
        onclick: () => this.selectStation('warehouse'),
      },
      h('div', { class: 'station-head' },
        h('span', { class: 'station-title', text: '🏪 Almacén y venta' }),
        m.whJam = h('span', { class: 'jam-icon', text: '🚧' })),
      h('div', { class: 'scene scene-warehouse' },
        h('div', { class: 'stock-bar' }, m.stockFill = h('div', { class: 'stock-fill' })),
        m.stockText = h('div', { class: 'stock-text' })),
      h('div', { class: 'station-foot' },
        m.sell = h('button', {
          class: 'sell-btn', id: 'sell',
          onclick: (e) => { e.stopPropagation(); this.onSell(); },
        }),
        m.managerBadge = h('span', { class: 'manager-badge', text: `${SALES_MANAGER.icon} Vendiendo solo · +10 %` }))),
    );
    setClass(m[this.station], 'selected', true);

    // Panel de mejoras de la estación seleccionada.
    const p = (this.p = {});
    this.refs.panel.append(
      h('div', { class: 'segmented stations' }, STATIONS.map((st) => h('button', {
        class: `seg${st.id === this.station ? ' active' : ''}`,
        onclick: () => this.selectStation(st.id),
      }, `${st.icon} ${st.name}`))),
    );
    if (this.station !== 'warehouse') {
      p.modes = h('div', { class: 'segmented modes' }, MODES.map((mo) => h('button', {
        class: `seg${mo.id === this.mode ? ' active' : ''}`,
        dataset: { mode: String(mo.id) },
        onclick: () => this.setMode(mo.id),
      }, mo.label)));
      this.refs.panel.append(p.modes);
    }
    const cards = h('div', { class: 'cards' });
    this.refs.panel.append(cards);
    if (this.station === 'front') {
      p.tool = this.makeCard('tool', UPGRADES.tool.icon, 'Herramienta', () => this.onBuyLevel('tool'));
      p.workers = this.makeCard('workers', UPGRADES.workers.icon, 'Mineros', () => this.onBuyWorker());
      cards.append(p.tool.el, p.workers.el);
    } else if (this.station === 'transport') {
      p.transport = this.makeCard('transport', UPGRADES.transport.icon, 'Transporte', () => this.onBuyLevel('transport'));
      cards.append(p.transport.el);
    } else {
      p.manager = this.makeCard('manager', SALES_MANAGER.icon, SALES_MANAGER.name, () => this.onHireManager());
      p.warehouse = this.makeCard('warehouse', UPGRADES.warehouse.icon, 'Almacén', () => this.onBuyWarehouse());
      cards.append(p.manager.el, p.warehouse.el);
    }
    this.minersKey = null;
    this.update = (now) => this.updateActive(def, now);
  }

  makeCard(id, icon, title, onBuy) {
    const c = { id };
    c.el = h('div', { class: 'card', dataset: { card: id } },
      h('div', { class: 'card-icon', text: icon }),
      h('div', { class: 'card-body' },
        h('div', { class: 'card-title' }, h('span', { text: title }), c.level = h('span', { class: 'card-level' })),
        c.desc = h('div', { class: 'card-desc' }),
        c.ms = h('div', { class: 'milestone' },
          h('span', { class: 'milestone-bar' }, c.msFill = h('span', { class: 'milestone-fill' })),
          c.msText = h('span', { class: 'milestone-text' }))),
      c.btn = h('button', { class: 'buy', dataset: { buy: id }, onclick: onBuy },
        c.btnLabel = h('span', { class: 'buy-label' }),
        c.btnCost = h('span', { class: 'buy-cost' })));
    return c;
  }

  updateActive(def, now) {
    const s = this.state;
    const zs = s.zones[def.id];
    const res = RESOURCES[def.resource];
    const r = zoneRates(zs, def, now);
    const m = this.m;

    setText(this.refs.zoneSub, `${res.icon} ${res.name} · +${formatMoneyRate(r.income)}/s`);

    // Frente
    const tool = stageFor(UPGRADES.tool, zs.tool);
    const minersKey = `${zs.workers}|${tool.icon}`;
    if (minersKey !== this.minersKey) {
      this.minersKey = minersKey;
      m.miners.replaceChildren(...Array.from({ length: zs.workers }, (_, i) => h('span', {
        class: 'miner', style: `animation-delay:${(i * 0.13).toFixed(2)}s`,
      }, h('span', { class: 'miner-body', text: '👷' }), h('span', { class: 'miner-tool', text: tool.icon }))));
    }
    setText(m.frontRate, `${res.icon} ${formatRate(r.extraction)}/s`);
    setText(m.toolStage, `${tool.name} · nv ${zs.tool}`);
    setClass(m.boost, 'on', r.boosted);
    m.pile.style.opacity = String(zs.jam);
    m.pile.style.transform = `scale(${(0.6 + zs.jam * 0.6).toFixed(2)})`;

    // Transporte
    const vehicle = stageFor(UPGRADES.transport, zs.transport);
    setText(m.vehicle, vehicle.icon);
    const dur = `${Math.max(0.8, 3 - Math.log10(r.transport + 1)).toFixed(2)}s`;
    if (m.vehicle.style.animationDuration !== dur) m.vehicle.style.animationDuration = dur;
    setText(m.transRate, `${res.icon} ${formatRate(r.real)}/s de ${formatRate(r.transport)}/s`);
    setText(m.transStage, `${vehicle.name} · nv ${zs.transport}`);

    // Cuello de botella
    setClass(m.transport, 'jammed', r.bottleneck === 'transport');
    setClass(m.warehouse, 'jammed', r.bottleneck === 'warehouse');
    setClass(m.frontJam, 'on', false);
    setClass(m.transJam, 'on', r.bottleneck === 'transport');
    setClass(m.whJam, 'on', r.bottleneck === 'warehouse');

    // Almacén
    setWidth(m.stockFill, r.capacity > 0 ? zs.stock / r.capacity : 0);
    setText(m.stockText, `${res.icon} ${formatNumber(zs.stock)} / ${formatNumber(r.capacity)} · ${warehouseHours(zs.warehouse)} h`);
    setClass(m.sell, 'hidden', zs.salesManager);
    setClass(m.managerBadge, 'hidden', !zs.salesManager);
    setText(m.sell, `VENDER ${formatMoney(zs.stock * r.price)}`);
    setDisabled(m.sell, zs.stock * r.price < 1);

    this.updateCards(def, zs, r, res);
  }

  updateCards(def, zs, r, res) {
    const s = this.state;
    const p = this.p;
    const hl = this.highlight && this.highlight.until > Date.now() && this.highlight.zoneId === def.id
      ? this.highlight.kind : null;

    if (p.tool) {
      const q = act.upgradeQuote(s, def.id, 'tool', this.mode);
      this.fillLevelCard(p.tool, zs.tool, q, toolSpeed,
        (a, b) => `${res.icon} ${formatRate(a)} → ${formatRate(b)}/s por minero`, hl === 'tool');
    }
    if (p.workers) {
      const cost = workerCost(zs.workers, def.costMult);
      const full = zs.workers >= UPGRADES.workers.max;
      setText(p.workers.level, `${zs.workers}/${UPGRADES.workers.max}`);
      setText(p.workers.desc, full
        ? 'Equipo completo'
        : `+${res.icon} ${formatRate(toolSpeed(zs.tool))}/s de extracción`);
      setClass(p.workers.ms, 'hidden', true);
      setText(p.workers.btnLabel, full ? 'Completo' : 'Contratar');
      setText(p.workers.btnCost, full ? '' : formatCost(cost));
      setDisabled(p.workers.btn, full || s.coins < cost);
      setClass(p.workers.btn, 'pulse', hl === 'workers');
    }
    if (p.transport) {
      const q = act.upgradeQuote(s, def.id, 'transport', this.mode);
      this.fillLevelCard(p.transport, zs.transport, q, transportCapacity,
        (a, b) => `${res.icon} ${formatRate(a)} → ${formatRate(b)}/s`, hl === 'transport');
    }
    if (p.manager) {
      const cost = act.salesManagerCost(def.id);
      setText(p.manager.level, zs.salesManager ? '✓' : '');
      setText(p.manager.desc, 'Vende de forma continua y +10 % al precio');
      setClass(p.manager.ms, 'hidden', true);
      setText(p.manager.btnLabel, zs.salesManager ? 'Contratado' : 'Contratar');
      setText(p.manager.btnCost, zs.salesManager ? '' : formatCost(cost));
      setDisabled(p.manager.btn, zs.salesManager || s.coins < cost);
    }
    if (p.warehouse) {
      const cost = warehouseCost(zs.warehouse, def.costMult);
      const max = zs.warehouse >= UPGRADES.warehouse.maxLevel;
      const hours = warehouseHours(zs.warehouse);
      setText(p.warehouse.level, `nv ${zs.warehouse}`);
      setText(p.warehouse.desc, max
        ? `${hours} h de producción offline (máximo)`
        : `${hours} h → ${hours + UPGRADES.warehouse.hoursPerLevel} h de producción offline`);
      setClass(p.warehouse.ms, 'hidden', true);
      setText(p.warehouse.btnLabel, max ? 'Máximo' : 'Ampliar');
      setText(p.warehouse.btnCost, max ? '' : formatCost(cost));
      setDisabled(p.warehouse.btn, max || s.coins < cost);
    }
  }

  fillLevelCard(c, level, q, valueAt, describe, pulse) {
    const after = level + q.count;
    setText(c.level, `nv ${level}`);
    setText(c.desc, describe(valueAt(level), valueAt(after)));
    const next = nextMilestone(level);
    setClass(c.ms, 'hidden', next === null);
    if (next !== null) {
      const prev = [...MILESTONES].reverse().find((ms) => ms <= level) ?? 1;
      setWidth(c.msFill, (level - prev) / (next - prev));
      const left = next - level;
      setText(c.msText, `${left} ${left === 1 ? 'nivel' : 'niveles'} para ×2`);
    }
    setText(c.btnLabel, `Mejorar ×${q.count}`);
    setText(c.btnCost, formatCost(q.cost));
    setDisabled(c.btn, !q.affordable);
    setClass(c.btn, 'pulse', pulse);
  }

  // ---------------------------------------------------------------- zona bloqueada

  buildLocked(def) {
    const res = RESOURCES[def.resource];
    const v = {};
    this.refs.mine.append(h('div', { class: 'locked-view' },
      h('div', { class: 'silhouette', text: res.icon }),
      h('h2', { text: def.name }),
      h('p', { class: 'muted', text: `Nuevo recurso: ${res.name} · ${formatMoney(res.basePrice)} por unidad` }),
      v.eta = h('p', { class: 'eta' }),
      v.btn = h('button', { class: 'primary', id: 'unlock', onclick: () => this.onUnlock(def) },
        h('span', { text: '🔓 Desbloquear' }), v.cost = h('span', { class: 'buy-cost' })),
      h('p', { class: 'muted small', text: `Construcción: ${formatDuration(def.buildSeconds)}` })));
    this.update = (now) => {
      const s = this.state;
      const income = totalIncome(s, now);
      setText(this.refs.zoneSub, '🔒 Sin desbloquear');
      setText(v.cost, formatCost(def.unlockCost));
      setDisabled(v.btn, s.coins < def.unlockCost);
      const missing = def.unlockCost - s.coins;
      setText(v.eta, missing <= 0 ? '¡Ya puedes desbloquearla!'
        : `Te faltan ${formatMoney(missing)} · ${income > 0 ? `unos ${formatDuration(missing / income)}` : '—'}`);
    };
  }

  // ---------------------------------------------------------------- en construcción

  buildBuilding(def) {
    const v = {};
    this.refs.mine.append(h('div', { class: 'locked-view building' },
      h('div', { class: 'silhouette crane', text: '🏗️' }),
      h('h2', { text: def.name }),
      h('p', { class: 'muted', text: 'En construcción' }),
      h('div', { class: 'build-bar' }, v.fill = h('div', { class: 'build-fill' })),
      v.left = h('p', { class: 'eta' }),
      v.speed = h('button', { class: 'primary', id: 'speedup', onclick: () => this.onSpeedup(def) }, '⚡ Acelerar gratis')));
    this.update = (now) => {
      const zs = this.state.zones[def.id];
      const total = def.buildSeconds * 1000;
      const left = Math.max(0, (zs.buildEndsAt ?? now) - now);
      setText(this.refs.zoneSub, '🏗️ En construcción');
      setWidth(v.fill, total > 0 ? 1 - left / total : 1);
      setText(v.left, `Faltan ${formatDuration(left / 1000)}`);
      setClass(v.speed, 'hidden', !act.canFreeSpeedup(this.state, def.id, now));
    };
  }

  // ---------------------------------------------------------------- objetivo

  // Objetivo aspiracional (escalera de objetivos, sección 4): la siguiente zona.
  goalTarget(now) {
    const s = this.state;
    for (const def of ZONES) {
      const zs = s.zones[def.id];
      const st = zoneStatus(zs, now);
      if (st === 'building' || st === 'ready') return { def, building: true };
      if (st === 'locked') return { def };
    }
    return { teaser: NEXT_CONTENT_TEASER };
  }

  updateGoal(now) {
    const s = this.state;
    const t = this.goalTarget(now);
    const income = totalIncome(s, now);
    let text;
    let fraction;
    if (t.teaser) {
      fraction = s.coins / t.teaser.unlockCost;
      text = `🔒 ${t.teaser.name} · ${formatMoney(t.teaser.unlockCost)} · próximamente`;
    } else if (t.building) {
      const zs = s.zones[t.def.id];
      const left = Math.max(0, (zs.buildEndsAt - now) / 1000);
      fraction = 1 - left / Math.max(1, t.def.buildSeconds);
      text = `🏗️ ${t.def.name} lista en ${formatDuration(left)}`;
    } else {
      const missing = t.def.unlockCost - s.coins;
      fraction = s.coins / t.def.unlockCost;
      text = missing <= 0
        ? `🔓 ¡Desbloquea la ${t.def.name}!`
        : `🎯 ${t.def.name} en ${income > 0 ? formatDuration(missing / income) : '—'}`;
    }
    setText(this.refs.goalText, text);
    setWidth(this.refs.goalFill, fraction);
    setClass(this.refs.goal, 'ready', fraction >= 1 && !t.teaser && !t.building);
    this.goal = t;
  }

  onGoalTap() {
    if (this.goal && this.goal.def) this.goToZone(this.goal.def.id);
  }

  // ---------------------------------------------------------------- acciones

  selectStation(id) {
    if (this.swiped) { this.swiped = false; return; }
    if (this.station === id) return;
    this.station = id;
  }

  setMode(mode) {
    this.mode = mode;
    for (const b of this.p.modes.querySelectorAll('.seg')) setClass(b, 'active', b.dataset.mode === String(mode));
  }

  onFrontTap() {
    if (this.swiped) { this.swiped = false; return; }
    act.tapFront(this.state, this.zoneId, Date.now());
    this.selectStation('front');
  }

  onSell() {
    const { earned } = act.sell(this.state, this.zoneId);
    if (earned > 0) this.floatText(this.m.sell, `+${formatMoney(earned)}`);
  }

  onBuyLevel(kind) {
    const def = UPGRADES[kind];
    const before = stageFor(def, this.state.zones[this.zoneId][kind]);
    const r = act.buyUpgrade(this.state, this.zoneId, kind, this.mode);
    if (!r.ok) return;
    this.highlight = null;
    if (r.milestones.length > 0) {
      const after = stageFor(def, r.level);
      const station = kind === 'tool' ? this.m.front : this.m.transport;
      this.celebrate(`⚡ ¡×${2 ** r.milestones.length}! ${def.name} nivel ${r.milestones.at(-1)}`, station);
      if (after !== before) this.toast(`${after.icon} Nueva máquina: ${after.name}`);
    }
  }

  onBuyWorker() {
    const r = act.buyWorker(this.state, this.zoneId);
    if (r.ok) { this.highlight = null; this.toast(`👷 ¡Minero contratado! (${r.workers}/${UPGRADES.workers.max})`); }
  }

  onBuyWarehouse() {
    const r = act.buyWarehouse(this.state, this.zoneId);
    if (r.ok) this.toast(`🏪 Almacén ampliado: ${warehouseHours(r.level)} h`);
  }

  onHireManager() {
    const r = act.hireSalesManager(this.state, this.zoneId);
    if (r.ok) this.toast(`${SALES_MANAGER.icon} El encargado ya vende por ti`);
  }

  onUnlock(def) {
    const r = act.unlockZone(this.state, def.id, Date.now());
    if (r.ok) {
      this.toast(`🏗️ Construyendo la ${def.name}`);
      this.game.save();
    }
  }

  onSpeedup(def) {
    if (act.freeSpeedup(this.state, def.id, Date.now()).ok) this.toast('⚡ ¡Construcción acelerada!');
  }

  onZoneBuilt(zoneId) {
    const def = ZONES_BY_ID[zoneId];
    this.celebrate(`🎉 ¡${def.name} en marcha!`);
    this.game.save();
  }

  onTab(tab) {
    if (tab.id !== 'mine') this.toast(`${tab.icon} ${tab.name}: llega en la Fase 1`);
  }

  // ---------------------------------------------------------------- offline

  showOfflineReport(report) {
    this.offlinePending = true;
    const minerals = formatNumber(report.produced);
    this.openModal(h('div', { class: 'offline' },
      h('h2', { text: `Mientras no estabas (${formatDuration(report.elapsedSeconds)})` }),
      h('p', { text: `⛏️ Tu equipo ha extraído ${minerals} minerales` }),
      h('p', { class: 'offline-value', text: `+${formatMoney(report.value)}` }),
      h('button', { class: 'primary', id: 'collect', onclick: () => this.onCollect() }, 'Recoger')));
  }

  onCollect() {
    const earned = collectOffline(this.state);
    this.offlinePending = false;
    this.closeModal();
    this.toast(`💰 +${formatMoney(earned)}`);
    // Justo después de recoger, resalta la mejora más atractiva (sección 10).
    const sug = suggestUpgrade(this.state, Date.now());
    if (sug) {
      this.goToZone(sug.zoneId, sug.station);
      this.mode = 1;
      this.highlight = { ...sug, until: Date.now() + 8000 };
      this.toast(`✨ ${sug.label}: ${formatCost(sug.cost)}`);
    }
    this.game.save();
  }

  // ---------------------------------------------------------------- ajustes

  showSettings() {
    let confirmBtn;
    this.openModal(h('div', { class: 'settings' },
      h('h2', { text: 'Ajustes' }),
      h('p', { class: 'muted', text: 'Filón · Fase 0 (prototipo). La partida se guarda sola cada 30 s.' }),
      confirmBtn = h('button', {
        class: 'danger',
        onclick: () => {
          if (confirmBtn.dataset.armed) { this.game.reset(); return; }
          confirmBtn.dataset.armed = '1';
          confirmBtn.textContent = '¿Seguro? Toca otra vez para borrar';
        },
      }, 'Reiniciar partida'),
      h('button', { class: 'secondary', onclick: () => this.closeModal() }, 'Cerrar')));
  }

  // ---------------------------------------------------------------- efectos

  openModal(content) {
    this.refs.modal.replaceChildren(h('div', { class: 'modal' }, content));
    setClass(this.refs.modal, 'hidden', false);
  }

  closeModal() {
    setClass(this.refs.modal, 'hidden', true);
    this.refs.modal.replaceChildren();
  }

  toast(text, kind = '') {
    const el = h('div', { class: `toast ${kind}`, text });
    this.refs.toasts.append(el);
    while (this.refs.toasts.children.length > 3) this.refs.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2200);
    setTimeout(() => el.remove(), 2600);
  }

  celebrate(text, stationEl) {
    this.toast(text, 'big');
    if (stationEl) {
      stationEl.classList.remove('puff');
      void stationEl.offsetWidth; // reinicia la animación
      stationEl.classList.add('puff');
    }
  }

  floatText(anchor, text) {
    const rect = anchor.getBoundingClientRect();
    const el = h('div', {
      class: 'float-text', text,
      style: `left:${rect.left + rect.width / 2}px;top:${rect.top}px`,
    });
    document.body.append(el);
    setTimeout(() => el.remove(), 900);
  }
}
