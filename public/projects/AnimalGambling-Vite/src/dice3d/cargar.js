/* La puerta al dado 3D, y la única que lo nombra con un `import()`.
 *
 * ►► Por qué existe este archivo en vez de importar `escena.js` derecho. ◄◄
 *
 * `escena.js` trae Three.js y cannon-es, y entre los dos son la mitad del
 * paquete que baja el navegador: 904KB en un solo archivo, sin cortar, del
 * que el dado se lleva la mayor parte. Eso se descargaba, se parseaba y se
 * ejecutaba ANTES de pintar la pantalla de título — dos pantallas antes de
 * que haya un dado que tirar, y sin haberse decidido todavía si se va a
 * jugar.
 *
 * Con `import()` el empaquetador lo parte en un archivo aparte que sólo se
 * pide cuando hace falta. Es la única forma de sacarlo del arranque: un
 * `import` normal es estático por definición y siempre termina adentro.
 *
 * ►► Y por eso también existe `calentarEscena`. ◄◄
 *
 * Partirlo sin más movería el costo en vez de sacarlo: el jugador llegaría
 * a la mesa y ahí esperaría los 900KB, justo cuando quiere jugar. Así que
 * se precarga en segundo plano con el mismo criterio que ya usan los gatos
 * y los emojis en `App.jsx` —cuando la página terminó de cargar, y todavía
 * faltan dos pantallas para que haga falta—. Para cuando alguien elige
 * gato, el módulo ya está en memoria y `cargarEscena` devuelve al toque.
 *
 * La promesa se guarda: llamar dos veces no baja el archivo dos veces, y
 * el que llegue mientras está bajando se cuelga de la misma.
 */
let promesa = null;

function pedir() {
  promesa ??= import("./escena.js");
  return promesa;
}

/* Devuelve la función que construye la escena, ya cargado el módulo. */
export async function cargarEscena() {
  const mod = await pedir();
  return mod.crearEscena;
}

/* Lo mismo pero sin esperar el resultado: se dispara y se olvida. Un fallo
   acá no es un error que mostrar —si la red se cayó, `cargarEscena` va a
   volver a intentarlo cuando el dado haga falta de verdad— pero sí hay que
   soltar la promesa fallida, o el reintento devolvería el mismo rechazo
   para siempre. */
export function calentarEscena() {
  pedir().catch(() => {
    promesa = null;
  });
}
