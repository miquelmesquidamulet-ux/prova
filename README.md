# Filón

Idle/tycoon de minería para móvil, en vertical y para jugar con una mano. De una cantera con un minero a un imperio de recursos.
Este repositorio implementa el *Documento de diseño del juego* (borrador 0.1) paso a paso, siguiendo su plan de desarrollo (sección 20).

La versión es **web (HTML5 + JavaScript, sin dependencias)**, no Unity como indica el documento: así se puede jugar y probar en el navegador del móvil desde el primer día.
La arquitectura sigue la sección 19 (datos separados del estado, una sola calculadora de producción, tick cada 0,2 s), así que se puede portar a Unity más adelante.

## Cómo jugar

```bash
npm start          # sirve el juego en http://localhost:8080
```

Para jugar en el móvil, abre `http://<IP-de-tu-ordenador>:8080` estando en la misma red Wi-Fi.
Cualquier servidor estático vale (por ejemplo `python3 -m http.server`). Por usar módulos ES, no funciona abriendo `index.html` con doble clic.

```bash
npm test           # tests de la lógica (node --test, sin instalar nada)
npm run sim        # simulador de equilibrado (sección 21)
npm run sim -- --reaccion 15 --log   # jugador que actúa cada 15 s, con cada compra
```

## Estado: Fase 0 (prototipo)

Lo que pide la Fase 0 del documento: *zonas 1 y 2 con gráficos provisionales, estaciones, cuello de botella, mejoras con hitos, guardado y progreso offline*.

| Sección del documento | Qué hay implementado |
| --- | --- |
| 3 · Cómo funciona una zona | Frente → transporte → almacén y venta. Producción real = mínimo(extracción, transporte). La estación que limita se marca en rojo con 🚧 y el mineral se amontona en el frente. Botón VENDER. Las dos zonas producen a la vez. |
| 4 · Sistema de mejoras | Herramienta y transporte con niveles ilimitados, mineros (1 a 10), almacén. Hitos ×2 en los niveles 10, 25, 50, 100, 150 y 200 con la barra «N niveles para ×2». Compra ×1, ×10 y ×Máx. Objetivo aspiracional con tiempo estimado. |
| 5 · Economía y fórmulas | Las fórmulas exactas del documento; los tests comprueban su tabla de ejemplo. Números con punto de miles hasta 999.999 y después sufijos M, B, T, aa, ab… |
| 6 · Zonas 1 y 2 | Cantera ($1) y mina de carbón ($5, desbloqueo $2.500, construcción de 30 s con la primera aceleración gratis). |
| 9 · Automatización | Las máquinas cambian en los niveles 25/50/100/150 (pico → martillo neumático → perforadora…; carretilla → vagoneta → camión…). Encargado de ventas (+10 %). Tocar el frente da +50 % durante 5 s. |
| 10 · Progreso offline | Pantalla «Mientras no estabas», limitada por el almacén (2 h, ampliable hasta 12 h), simulada por tramos con la misma calculadora. Si el reloj va hacia atrás no da producción negativa. Al recoger se resalta la mejora más atractiva. |
| 16 · Interfaz y primeros minutos | Barra superior, cambio de zona con flechas o deslizando, pestañas inferiores, botones en la mitad inferior y tutorial con dedo y frases cortas. |
| 19 · Implementación | Datos en `src/data`, estado serializable en `src/core/state.js`, calculadora pura en `src/core/production.js`, tick de 0,2 s separado del dibujado, guardado JSON cada 30 s y al ocultar la página. |
| 21 · Métricas y equilibrado | `tools/simulate.js` simula a un jugador que compra la mejor opción y compara con los tiempos objetivo. |

Las pestañas Mapa, Laboratorio, Colección y Tienda aparecen, pero todavía no se pueden usar: llegan en la Fase 1 y siguientes.

## Estructura

```
index.html            página única, en vertical
css/style.css         estilos y temas por zona (gráficos provisionales con emojis)
src/data/             definiciones de diseño (equivalen a los ScriptableObjects)
  resources.js        recursos y precios base
  zones.js            zonas, costes de desbloqueo y multiplicador de costes
  upgrades.js         mejoras, hitos, máquinas por nivel, encargado y toque
src/core/             lógica pura, sin DOM (se prueba con node --test)
  formulas.js         fórmulas de la sección 5
  format.js           formateador único de números y duraciones
  state.js            GameState serializable
  production.js       calculadora de producción única
  actions.js          acciones del jugador
  offline.js          progreso offline por tramos
  save.js             guardado en localStorage
  advisor.js          mejora sugerida al volver
src/ui/               interfaz
  app.js              pantallas y panel de mejoras
  tutorial.js         tutorial de los primeros minutos
  dom.js              utilidades de DOM
src/main.js           arranque, tick económico y guardado
tests/                tests de la lógica
tools/simulate.js     simulador de equilibrado
```

Para depurar, en la consola del navegador está `window.filon` (`filon.game.state.coins = 1e6`).

## Equilibrado: lo que dice el simulador

Con las cifras del documento, sin tocar:

| Hito | Objetivo del documento | Jugador perfecto | Jugador que actúa cada 15 s |
| --- | --- | --- | --- |
| Primera mejora | 0:15 | 0:10 | 0:15 |
| Segundo minero | 2:00 | 1:44 | 1:31 |
| Herramienta nivel 10 | 4:30 | 1:19 | 2:16 |
| Mina de carbón | 6:00 | 3:37 | 4:00 |
| Poder pagar la mina de hierro ($40K) | 20 min | 7:47 | 8:30 |

La zona 2 está en un margen razonable, pero **la cantera escala tan rápido que los $40K de la zona 3 llegan en unos 8 minutos en vez de 20**.
Cambiar el multiplicador de costes del carbón apenas influye; lo que manda son los hitos ×2 de la cantera.
Siguiendo el orden de la sección 21 (primero el coste de desbloqueo), se puede subir el de la zona 3 a unos $150K o suavizar los hitos. Es una decisión de diseño que queda pendiente para la Fase 1.

## Siguiente: Fase 1 (MVP)

Zonas 1 a 5, procesamiento, hallazgos raros y colección, mapa, encargados de todas las estaciones, tres anuncios recompensados (offline ×2, turbo, camión de suministros) y arte definitivo de las primeras zonas.
