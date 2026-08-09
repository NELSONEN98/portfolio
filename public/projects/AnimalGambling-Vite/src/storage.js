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
