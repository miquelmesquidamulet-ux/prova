// Definición de zonas (equivalente a ZoneDef, sección 19).
// Fase 0: solo las zonas 1 y 2. Añadir una zona es añadir una entrada aquí.

export const ZONES = Object.freeze([
  Object.freeze({
    id: 'quarry',
    index: 1,
    name: 'Cantera de piedra',
    resource: 'stone',
    unlockCost: 0,
    buildSeconds: 0,
    costMult: 1,
    theme: 'quarry',
  }),
  Object.freeze({
    id: 'coal',
    index: 2,
    name: 'Mina de carbón',
    resource: 'coal',
    unlockCost: 2500,
    buildSeconds: 30,
    costMult: 20,
    theme: 'coal',
  }),
]);

export const ZONES_BY_ID = Object.freeze(
  Object.fromEntries(ZONES.map((z) => [z.id, z])),
);

// Siguiente objetivo de desbloqueo que se muestra (ver la sección 11, zonas en silueta).
// Se usa como objetivo aspiracional aunque la zona 3 todavía no esté implementada.
export const NEXT_CONTENT_TEASER = Object.freeze({
  name: 'Mina de hierro',
  unlockCost: 40000,
});
