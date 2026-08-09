import { ConvexHttpClient } from "convex/browser";
import { getSessionId } from "./storage";

/* Convex no expone una API HTTP pública para llamar mutations: el SDK es
   obligatorio, y por eso el proyecto necesita un bundler. Los intentos de
   hablarle con fetch a mano —/api/mutation, /api/json— y de cargar el SDK
   por CDN fallan todos; esto quedó documentado por si vuelve la idea. */
const CONVEX_URL = "https://quixotic-squid-855.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

const conSesion = (args = {}) => ({ sessionId: getSessionId(), ...args });

export const createRoom = () =>
  convex.mutation("rooms:createRoom", conSesion()).then((r) => r.roomId);

export const joinRoom = (roomId) =>
  convex.mutation("rooms:joinRoom", conSesion({ roomId })).then((r) => r.roomId);

export const setCharacter = (roomId, playerName, catId) =>
  convex.mutation("rooms:updatePlayerCharacter", conSesion({ roomId, playerName, catId }));

export const playCard = (roomId, uid) =>
  convex.mutation("rooms:playCard", conSesion({ roomId, uid }));

export const rollDice = (roomId) =>
  convex.mutation("rooms:rollDice", conSesion({ roomId }));

export const holdScore = (roomId) =>
  convex.mutation("rooms:holdScore", conSesion({ roomId }));

export const getRoom = (roomId) => convex.query("rooms:getRoom", { roomId });

/* Salir nunca debe frenar la navegación ni explotar: si falla, el cron del
   backend limpia la sala cuando vence. */
export const leaveRoom = (roomId) =>
  roomId
    ? convex.mutation("rooms:leaveRoom", conSesion({ roomId })).catch(() => {})
    : Promise.resolve();
