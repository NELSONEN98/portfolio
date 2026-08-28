import { ConvexHttpClient } from "convex/browser";
import { getSessionId } from "./storage";
import { MAX_PLAYERS } from "../convex/rules";

/* Convex no expone una API HTTP pública para llamar mutations: el SDK es
   obligatorio, y por eso el proyecto necesita un bundler. Los intentos de
   hablarle con fetch a mano —/api/mutation, /api/json— y de cargar el SDK
   por CDN fallan todos; esto quedó documentado por si vuelve la idea. */
const CONVEX_URL = "https://quixotic-squid-855.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

const conSesion = (args = {}) => ({ sessionId: getSessionId(), ...args });

/* Toda sala se abre al tope y se arranca a mano.
 *
 * `size` deja de ser una pregunta al jugador: mandando siempre MAX_PLAYERS
 * la sala sólo arranca sola si se LLENA, y en cualquier otro caso la
 * arranca el anfitrión con los que haya. Así no hay que decidir cuántos van
 * a venir antes de mandar el código — que era una pregunta imposible de
 * contestar en el único momento en que se hacía. */
export const createRoom = () =>
  convex.mutation("rooms:createRoom", conSesion({ size: MAX_PLAYERS })).then((r) => r.roomId);

export const joinRoom = (roomId) =>
  convex.mutation("rooms:joinRoom", conSesion({ roomId })).then((r) => r.roomId);

/* Arrancar con la mesa a medio llenar. Sólo lo acepta el anfitrión. */
export const startRoom = (roomId) =>
  convex.mutation("rooms:startRoom", conSesion({ roomId }));

export const setCharacter = (roomId, playerName, catId) =>
  convex.mutation("rooms:updatePlayerCharacter", conSesion({ roomId, playerName, catId }));

export const playCard = (roomId, uid) =>
  convex.mutation("rooms:playCard", conSesion({ roomId, uid }));

export const takeBackCard = (roomId, uid) =>
  convex.mutation("rooms:takeBackCard", conSesion({ roomId, uid }));

export const rollDice = (roomId) =>
  convex.mutation("rooms:rollDice", conSesion({ roomId }));

export const holdScore = (roomId) =>
  convex.mutation("rooms:holdScore", conSesion({ roomId }));

/* El emoji no lleva asiento: lo pone el servidor a partir de la sesión. Si
   viajara desde acá, cualquiera podría tirarlo desde la cara de otro. */
export const sendEmoji = (roomId, emoji) =>
  convex.mutation("rooms:sendEmoji", conSesion({ roomId, emoji }));

export const getRoom = (roomId) => convex.query("rooms:getRoom", { roomId });

/* Salir nunca debe frenar la navegación ni explotar: si falla, el cron del
   backend limpia la sala cuando vence. */
export const leaveRoom = (roomId) =>
  roomId
    ? convex.mutation("rooms:leaveRoom", conSesion({ roomId })).catch(() => {})
    : Promise.resolve();
