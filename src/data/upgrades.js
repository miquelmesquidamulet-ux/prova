// Definición de mejoras (equivalente a UpgradeDef, sección 19).
// Los costes base son los de la cantera; cada zona los multiplica por su costMult.

// Niveles en los que la velocidad de la estación se duplica (sección 4).
export const MILESTONES = Object.freeze([10, 25, 50, 100, 150, 200]);

// Aspecto de cada estación según su nivel (sección 9).
const TOOL_STAGES = Object.freeze([
  { level: 1, name: 'Pico', icon: '⛏️' },
  { level: 25, name: 'Martillo neumático', icon: '🔨' },
  { level: 50, name: 'Perforadora', icon: '🪛' },
  { level: 100, name: 'Excavadora', icon: '🚜' },
  { level: 150, name: 'Excavadora gigante', icon: '🏗️' },
]);

const TRANSPORT_STAGES = Object.freeze([
  { level: 1, name: 'Carretilla', icon: '🛒' },
  { level: 25, name: 'Vagoneta sobre raíles', icon: '🚃' },
  { level: 50, name: 'Camión', icon: '🚚' },
  { level: 100, name: 'Cinta transportadora', icon: '🎞️' },
  { level: 150, name: 'Tren minero', icon: '🚂' },
]);

export const UPGRADES = Object.freeze({
  // Velocidad de cada minero: (1 + 0,5 × (nivel − 1)) × 2^hitos
  tool: Object.freeze({
    id: 'tool',
    name: 'Herramienta',
    icon: '⚒️',
    station: 'front',
    baseCost: 10,
    growth: 1.15,
    baseValue: 1,
    perLevel: 0.5,
    stages: TOOL_STAGES,
  }),
  // Capacidad de transporte: (3 + 2 × (nivel − 1)) × 2^hitos
  transport: Object.freeze({
    id: 'transport',
    name: 'Transporte',
    icon: '🚚',
    station: 'transport',
    baseCost: 15,
    growth: 1.15,
    baseValue: 3,
    perLevel: 2,
    stages: TRANSPORT_STAGES,
  }),
  // Número de mineros, de 1 a 10. Coste del 2.º al 10.º (sección 5).
  workers: Object.freeze({
    id: 'workers',
    name: 'Mineros',
    icon: '👷',
    station: 'front',
    max: 10,
    costs: Object.freeze([100, 400, 1500, 6000, 25000, 100000, 400000, 1600000, 6500000]),
  }),
  // Almacén: horas de producción que se acumulan offline (sección 10).
  // Nivel 1 = 2 h, nivel 11 = 12 h.
  warehouse: Object.freeze({
    id: 'warehouse',
    name: 'Almacén',
    icon: '🏪',
    station: 'warehouse',
    baseCost: 200,
    growth: 2.2,
    maxLevel: 11,
    baseHours: 2,
    hoursPerLevel: 1,
  }),
});

// Encargado de ventas (sección 9): vende de forma continua y da +10 % al precio.
export const SALES_MANAGER = Object.freeze({
  id: 'salesManager',
  name: 'Encargado de ventas',
  icon: '🧑‍💼',
  cost: 250,
  priceBonus: 0.1,
});

// Toque opcional en el frente: +50 % de velocidad durante 5 s (sección 9).
export const TAP_BOOST = Object.freeze({
  multiplier: 1.5,
  durationMs: 5000,
});
