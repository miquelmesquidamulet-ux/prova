// Guardado en JSON (sección 19). En la web se usa localStorage en lugar de
// Application.persistentDataPath. Las marcas de tiempo son ms UTC (Date.now()).
import { hydrateState } from './state.js';

export const SAVE_KEY = 'filon.save';
export const AUTOSAVE_SECONDS = 30;

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json, now) {
  if (!json) return null;
  try {
    return hydrateState(JSON.parse(json), now);
  } catch {
    return null;
  }
}

export function saveGame(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(now, storage = globalThis.localStorage) {
  try {
    return deserialize(storage.getItem(SAVE_KEY), now);
  } catch {
    return null;
  }
}

export function clearGame(storage = globalThis.localStorage) {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Sin almacenamiento disponible: no hay nada que borrar.
  }
}
