// Definición de recursos (equivalente a ResourceDef, sección 19).
// Los datos nunca se modifican en tiempo de ejecución.

export const RESOURCES = Object.freeze({
  stone: Object.freeze({
    id: 'stone',
    name: 'Piedra',
    icon: '🪨',
    basePrice: 1,
    color: '#a8a29e',
  }),
  coal: Object.freeze({
    id: 'coal',
    name: 'Carbón',
    icon: '⚫',
    basePrice: 5,
    color: '#44403c',
  }),
});
