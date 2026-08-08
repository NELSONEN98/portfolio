import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const GOAL = 50;
const ROOM_TTL_MS = 1000 * 60 * 30;

/* Sin I, O, 0 ni 1: el código se dicta por voz o se copia a mano, y esos
   cuatro se confunden entre sí. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomId() {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return id;
}

/* La tabla tiene índice by_roomId — usarlo en vez de .filter() evita
   recorrer todas las salas en cada tirada de dado. */
async function findRoom(ctx: any, roomId: string) {
  return await ctx.db
    .query("rooms")
    .withIndex("by_roomId", (q: any) => q.eq("roomId", roomId))
    .unique();
}

/* Quién tira: devuelve el jugador y su clave, o null si el sessionId no
   pertenece a esta sala. */
function whoIs(room: Doc<"rooms">, sessionId: string) {
  if (room.player1.sessionId === sessionId) {
    return { player: room.player1, key: "player1" as const, other: "player2" as const };
  }
  if (room.player2 && room.player2.sessionId === sessionId) {
    return { player: room.player2, key: "player2" as const, other: "player1" as const };
  }
  return null;
}

export const createRoom = mutation({
  args: {
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    /* Seis caracteres sobre 32 símbolos son 1e9 combinaciones, pero las
       salas viven 30 minutos y el espacio ocupado nunca es cero. */
    let roomId = makeRoomId();
    for (let attempt = 0; attempt < 5 && (await findRoom(ctx, roomId)); attempt++) {
      roomId = makeRoomId();
    }

    await ctx.db.insert("rooms", {
      roomId,
      player1: {
        sessionId: args.sessionId,
        // El personaje se elige en la pantalla siguiente.
        name: null,
        catId: null,
        score: 0,
        current: 0,
      },
      // player2 es v.optional: se omite hasta que alguien entre. Mandar
      // null acá es lo que rompía el insert.
      turn: "player1",
      status: "waiting",
      createdAt: Date.now(),
      expiresAt: Date.now() + ROOM_TTL_MS,
    });

    return { roomId };
  },
});

export const updatePlayerCharacter = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
    playerName: v.string(),
    catId: v.string(),
  },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    if (!room) throw new ConvexError("Room not found");

    const me = whoIs(room, args.sessionId);
    if (!me) throw new ConvexError("You are not in this room");

    await ctx.db.patch(room._id, {
      [me.key]: { ...me.player, name: args.playerName, catId: args.catId },
    });

    return { success: true };
  },
});

export const joinRoom = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    if (!room) throw new ConvexError("Room not found");

    /* Recargar la página no debería costarte la sala: si el que entra ya
       está adentro, esto es un no-op en vez de un error. */
    if (whoIs(room, args.sessionId)) return { roomId: args.roomId };

    if (room.status !== "waiting") throw new ConvexError("Room full or finished");

    await ctx.db.patch(room._id, {
      player2: {
        sessionId: args.sessionId,
        // Igual que player1: el gato llega por updatePlayerCharacter.
        name: null,
        catId: null,
        score: 0,
        current: 0,
      },
      status: "playing",
    });

    return { roomId: args.roomId };
  },
});

export const getRoom = query({
  args: { roomId: v.string() },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    /* El objetivo viaja con la sala: es el backend quien corta la partida,
       así que las dos pantallas tienen que leerlo de acá. */
    return room && { ...room, goal: GOAL };
  },
});

export const rollDice = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    if (!room) throw new ConvexError("Room not found");
    if (room.status !== "playing") throw new ConvexError("Game not active");

    const me = whoIs(room, args.sessionId);
    if (!me) throw new ConvexError("You are not in this room");
    if (room.turn !== me.key) throw new ConvexError("Not your turn");

    const roll = Math.floor(Math.random() * 6) + 1;
    const isBust = roll === 1;

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      sessionId: args.sessionId,
      action: "roll",
      payload: { roll, isBust },
      timestamp: Date.now(),
    });

    /* Ojo de víbora: se pierde lo acumulado del turno y pasa el otro. */
    if (isBust) {
      await ctx.db.patch(room._id, {
        turn: me.other,
        [me.key]: { ...me.player, current: 0 },
      });
      return { roll, isBust: true, newTurn: me.other };
    }

    const newCurrent = me.player.current + roll;
    await ctx.db.patch(room._id, {
      [me.key]: { ...me.player, current: newCurrent },
    });

    return { roll, isBust: false, newCurrent };
  },
});

export const holdScore = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    if (!room) throw new ConvexError("Room not found");
    if (room.status !== "playing") throw new ConvexError("Game not active");

    const me = whoIs(room, args.sessionId);
    if (!me) throw new ConvexError("You are not in this room");
    /* Sin esto el rival podía plantarse durante tu turno y llevarse tu
       acumulado. */
    if (room.turn !== me.key) throw new ConvexError("Not your turn");

    const newScore = me.player.score + me.player.current;
    const gameFinished = newScore >= GOAL;

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      sessionId: args.sessionId,
      action: gameFinished ? "hold_and_win" : "hold",
      payload: { newScore, goal: GOAL },
      timestamp: Date.now(),
    });

    if (gameFinished) {
      await ctx.db.patch(room._id, {
        [me.key]: { ...me.player, score: newScore, current: 0 },
        status: "finished",
      });
      return { newScore, gameFinished: true, winner: me.key };
    }

    await ctx.db.patch(room._id, {
      [me.key]: { ...me.player, score: newScore, current: 0 },
      turn: me.other,
    });

    return { newScore, gameFinished: false, newTurn: me.other };
  },
});
