// Punto de entrada: carga la partida, recupera el tiempo offline y arranca
// el tick económico (cada 0,2 s) separado del dibujado (cada fotograma).
import { createGameState } from './core/state.js';
import { advanceGame } from './core/production.js';
import {
  simulateOffline, OFFLINE_GAP_SECONDS, OFFLINE_REPORT_SECONDS,
} from './core/offline.js';
import { saveGame, loadGame, clearGame, AUTOSAVE_SECONDS } from './core/save.js';
import { App } from './ui/app.js';

const TICK_MS = 200;

const game = {
  state: loadGame(Date.now()) ?? createGameState(Date.now()),
  resetting: false,
  save() {
    if (!this.resetting) saveGame(this.state);
  },
  reset() {
    // Al recargar se disparan pagehide y visibilitychange: no hay que volver a guardar.
    this.resetting = true;
    clearGame();
    location.reload();
  },
};

const app = new App(document.getElementById('app'), game);
// Acceso para depurar desde la consola del navegador.
window.filon = { game, app };

// Si ha pasado un rato desde el último tick (app cerrada, pestaña en segundo
// plano), se calcula como tiempo offline con la misma calculadora.
function catchUp(now) {
  const gap = (now - game.state.lastTick) / 1000;
  if (gap <= OFFLINE_GAP_SECONDS) return false;
  const report = simulateOffline(game.state, game.state.lastTick, now);
  if (report.elapsedSeconds >= OFFLINE_REPORT_SECONDS && report.value > 0 && !app.offlinePending) {
    app.showOfflineReport(report);
  }
  game.save();
  return true;
}

function tick() {
  const now = Date.now();
  if (catchUp(now)) return;
  const dt = (now - game.state.lastTick) / 1000;
  if (dt < 0) {
    // El reloj ha ido hacia atrás: no se produce nada, se reanuda desde ahora.
    game.state.lastTick = now;
    return;
  }
  // Con la pantalla de recogida abierta nadie vende, para que «Recoger» dé
  // exactamente lo acumulado.
  const res = advanceGame(game.state, dt, now, { autoSell: !app.offlinePending });
  for (const id of res.built) app.onZoneBuilt(id);
}

function onHide() {
  game.save();
}

function frame(t) {
  app.frame(t);
  requestAnimationFrame(frame);
}

catchUp(Date.now());
setInterval(tick, TICK_MS);
setInterval(() => game.save(), AUTOSAVE_SECONDS * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') game.save();
  else tick();
});
window.addEventListener('pagehide', onHide);
requestAnimationFrame(frame);
