/* Guardado breve: el id de sesión y la sala en curso.
 *
 * Envuelto en vez de usar sessionStorage directo porque React Native no lo
 * tiene — allá esto pasa a AsyncStorage, que además es asíncrono. Teniendo
 * un solo lugar que lo toca, la migración es reescribir este archivo; con
 * sessionStorage repartido, es buscarlo por todo el proyecto.
 *
 * La caché en memoria no es un adorno: cuando esto sea asíncrono, es lo que
 * permite que los llamadores sigan leyendo sin await.
 */
const memoria = new Map();

function leer(clave) {
  if (memoria.has(clave)) return memoria.get(clave);
  try {
    const v = sessionStorage.getItem(clave);
    memoria.set(clave, v);
    return v;
  } catch {
    // Modo privado en algunos navegadores tira al tocar el storage.
    return null;
  }
}

function escribir(clave, valor) {
  memoria.set(clave, valor);
  try {
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, valor);
  } catch {
    /* Sin persistencia se sigue jugando: la partida vive en memoria y sólo
       se pierde al recargar. */
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* Identifica al jugador sin pedirle que se registre. Vive por pestaña, que
   es justo lo que permite abrir dos y jugar contra uno mismo. */
export function getSessionId() {
  let id = leer("sessionId");
  if (!id) {
    id = uuid();
    escribir("sessionId", id);
  }
  return id;
}

export const getRoomId = () => leer("roomId");
export const setRoomId = (id) => escribir("roomId", id);
export const clearRoomId = () => escribir("roomId", null);

/* ►► Los AJUSTES van en otro cajón, y no es un detalle. ◄◄
 *
 * Todo lo de arriba usa `sessionStorage`, que vive por PESTAÑA y muere al
 * cerrarla. Para el id de sesión eso es exactamente lo que se quiere —es lo
 * que permite abrir dos pestañas y jugar contra uno mismo— y para la sala en
 * curso también.
 *
 * Un ajuste es lo contrario: bajarle el volumen una vez y encontrarlo bajo
 * mañana es la mitad de para qué existe. Guardado al lado del id de sesión,
 * el jugador tendría que silenciar el juego en cada visita.
 *
 * Se envuelve por la misma razón que el otro: en React Native esto pasa a
 * AsyncStorage y hay UN archivo que tocar. La caché en memoria además lo
 * hace legible sin `await` el día que sea asíncrono.
 */
const ajustes = new Map();

export function leerAjuste(clave, porDefecto = null) {
  if (ajustes.has(clave)) return ajustes.get(clave);
  let v = porDefecto;
  try {
    const crudo = localStorage.getItem(`ag:${clave}`);
    if (crudo !== null) v = JSON.parse(crudo);
  } catch {
    /* Modo privado, o un valor guardado que ya no parsea. En los dos casos
       el default es una respuesta perfectamente buena: se pierde la
       preferencia, no el juego. */
  }
  ajustes.set(clave, v);
  return v;
}

export function guardarAjuste(clave, valor) {
  ajustes.set(clave, valor);
  try {
    localStorage.setItem(`ag:${clave}`, JSON.stringify(valor));
  } catch {
    /* Sin persistencia el ajuste vale para esta sesión y nada más. */
  }
}
