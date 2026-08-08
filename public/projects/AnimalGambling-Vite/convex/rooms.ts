import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  GOAL,
  makeBoard,
  CARD,
  HAND_LIMIT,
  CURSE_TURNS,
  SQUARE,
  squareAt,
  advance,
  startingHand,
  randomBonusCard,
  resolveRoll,
  applyPenalty,
  cappedScore,
  hasDefense,
  dropCard,
  dropFirstOfType,
  type Card,
} from "./rules";

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

/* Las salas creadas antes del tablero no traen estos campos. Leerlos por
   acá evita repartir `?? 0` por todo el archivo y que uno se olvide. */
function boardOf(p: any) {
  return {
    pos: p.pos ?? 0,
    hand: (p.hand ?? []) as Card[],
    pendingCard: (p.pendingCard ?? null) as Card | null,
    curseTurns: p.curseTurns ?? 0,
    doubleNext: p.doubleNext ?? false,
  };
}

const rand = () => Math.random();

function freshPlayer(sessionId: string) {
  return {
    sessionId,
    name: null,
    catId: null,
    score: 0,
    current: 0,
    pos: 0,
    hand: startingHand(rand),
    pendingCard: null,
    curseTurns: 0,
    doubleNext: false,
  };
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
      // El personaje se elige en la pantalla siguiente.
      player1: freshPlayer(args.sessionId),
      // player2 es v.optional: se omite hasta que alguien entre. Mandar
      // null acá es lo que rompía el insert.
      turn: "player1",
      status: "waiting",
      // Un tablero distinto por partida.
      board: makeBoard(rand),
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
      // Igual que player1: el gato llega por updatePlayerCharacter.
      player2: freshPlayer(args.sessionId),
      status: "playing",
    });

    return { roomId: args.roomId };
  },
});

/* Irse es parte del juego: sin esto cada "volver al menú" dejaba una sala
   viva para siempre, y el mismo jugador terminaba figurando en cuatro. */
export const leaveRoom = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    /* Salir de algo que ya no está no es un error: el botón de volver no
       debería explotar porque el rival cerró la sala primero. */
    if (!room) return { ok: true };

    const me = whoIs(room, args.sessionId);
    if (!me) return { ok: true };

    /* Nadie llegó a entrar: la sala no le sirve a nadie más. */
    if (room.status === "waiting") {
      await ctx.db.delete(room._id);
      return { ok: true, deleted: true };
    }

    if (room.status === "playing") {
      await ctx.db.patch(room._id, {
        status: "finished",
        winner: me.other,
        endedByAbandon: true,
      });

      await ctx.db.insert("gameEvents", {
        roomId: args.roomId,
        sessionId: args.sessionId,
        action: "abandon",
        payload: { winner: me.other },
        timestamp: Date.now(),
      });
    }

    return { ok: true };
  },
});

/* El TTL estaba escrito en cada sala desde el principio pero nadie lo leía.
   Lo corre el cron de crons.ts. */
export const cleanupExpired = internalMutation({
  args: {},
  async handler(ctx) {
    const now = Date.now();
    const stale = await ctx.db
      .query("rooms")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(200);

    for (const room of stale) {
      const events = await ctx.db
        .query("gameEvents")
        .withIndex("by_roomId", (q) => q.eq("roomId", room.roomId))
        .collect();
      for (const e of events) await ctx.db.delete(e._id);
      await ctx.db.delete(room._id);
    }

    return { removed: stale.length };
  },
});

export const getRoom = query({
  args: { roomId: v.string() },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    if (!room) return null;

    /* La última jugada viaja con la sala para que el rival pueda animar el
       dado. Comparando puntajes no alcanza: una tirada que suma y un
       plantarse se ven casi igual desde afuera, y un 1 deja el acumulado
       en cero sin decir que salió un 1. */
    const lastEvent = await ctx.db
      .query("gameEvents")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .first();

    /* El objetivo viaja con la sala: es el backend quien corta la partida,
       así que las dos pantallas tienen que leerlo de acá. */
    return { ...room, goal: GOAL, lastEvent };
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

    const mine = boardOf(me.player);

    /* La maldición la sufre quien tira, y la puso el otro: el contador vive
       en el que la padece y se descuenta acá. */
    const cursed = mine.curseTurns > 0;
    const outcome = resolveRoll(rand, cursed, mine.doubleNext);

    /* La ficha avanza aunque el turno se queme: el 1 te saca lo acumulado,
       no te devuelve al casillero anterior. */
    const steps = outcome.isBust ? outcome.dice.length : outcome.gained;
    const pos = advance(mine.pos, steps);
    const square = squareAt(room.board as any, pos);

    let score = me.player.score;
    let hand = mine.hand;
    let landed: string = SQUARE.PLAIN;

    if (square === SQUARE.PENALTY) {
      score = applyPenalty(score);
      landed = SQUARE.PENALTY;
    } else if (square === SQUARE.BONUS) {
      landed = SQUARE.BONUS;
      /* La carta que está sobre la mesa cuenta para el límite: puede
         volver a la mano al quemarse, y sin contarla la mano terminaría
         con una de más. */
      const ocupadas = hand.length + (mine.pendingCard ? 1 : 0);
      // Mano llena: la casilla se pisa igual pero no entrega nada.
      if (ocupadas < HAND_LIMIT) hand = [...hand, randomBonusCard(rand, Date.now())];
    }

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      sessionId: args.sessionId,
      action: "roll",
      payload: {
        // `roll` se mantiene para el cliente viejo que anima un solo dado.
        roll: outcome.dice[0],
        dice: outcome.dice,
        isBust: outcome.isBust,
        pos,
        landed,
        cardReturned: Boolean(outcome.isBust && mine.pendingCard),
      },
      timestamp: Date.now(),
    });

    const base = {
      ...me.player,
      score,
      pos,
      hand,
      // Se consume tire lo que tire: la carta valía para esta tirada.
      doubleNext: false,
    };

    /* Ojo de víbora: se pierde lo acumulado del turno y pasa el otro. */
    if (outcome.isBust) {
      /* La carta que estaba boca abajo vuelve a la mano sin revelarse:
         quemarse ya cuesta el turno entero, no tiene por qué costar
         también la carta. */
      const devuelta = mine.pendingCard ? [...hand, mine.pendingCard] : hand;
      await ctx.db.patch(room._id, {
        turn: me.other,
        [me.key]: {
          ...base,
          hand: devuelta,
          pendingCard: null,
          current: 0,
          /* La maldición se mide en turnos, no en tiradas: acá termina uno.
             Descontándola en cada tirada duraba 1,4 turnos en vez de 3,
             porque un turno normal son casi cuatro tiradas. */
          curseTurns: Math.max(0, mine.curseTurns - 1),
        },
      });
      return { ...outcome, roll: outcome.dice[0], pos, landed, newTurn: me.other, score };
    }

    const newCurrent = me.player.current + outcome.gained;
    await ctx.db.patch(room._id, {
      [me.key]: { ...base, current: newCurrent },
    });

    return { ...outcome, roll: outcome.dice[0], pos, landed, newCurrent, score };
  },
});

/* Poner una carta boca abajo sobre la mesa. Se resuelve recién al
   plantarse, que es cuando el rival la ve. */
export const playCard = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
    uid: v.string(),
  },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    if (!room) throw new ConvexError("Room not found");
    if (room.status !== "playing") throw new ConvexError("Game not active");

    const me = whoIs(room, args.sessionId);
    if (!me) throw new ConvexError("You are not in this room");
    if (room.turn !== me.key) throw new ConvexError("Not your turn");

    const mine = boardOf(me.player);
    if (mine.pendingCard) throw new ConvexError("Ya jugaste una carta este turno");

    const chosen = mine.hand.find((c) => c.uid === args.uid);
    if (!chosen) throw new ConvexError("Card not in hand");
    /* La defensa no se juega: se gasta sola cuando te atacan. Ponerla boca
       abajo sería tirarla a la basura. */
    if (chosen.type === CARD.DEFENSE) throw new ConvexError("La defensa se usa sola");

    const hand = dropCard(mine.hand, args.uid);

    /* Los dos dados no esperan al plantarse: sirven para la tirada de este
       mismo turno, así que se aplica ya y no queda pendiente. */
    if (chosen.type === CARD.DOUBLE) {
      await ctx.db.patch(room._id, {
        [me.key]: { ...me.player, hand, doubleNext: true },
      });
      return { applied: "double" };
    }

    await ctx.db.patch(room._id, {
      [me.key]: { ...me.player, hand, pendingCard: chosen },
    });

    return { applied: "pending", card: chosen };
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

    const mine = boardOf(me.player);
    const rivalRaw = me.key === "player1" ? room.player2 : room.player1;
    const rival = rivalRaw ? boardOf(rivalRaw) : null;

    let myScore = me.player.score + me.player.current;
    let rivalScore = rivalRaw ? rivalRaw.score : 0;
    let rivalHand = rival ? rival.hand : [];
    let rivalCurse = rival ? rival.curseTurns : 0;

    /* Acá se revela la carta que estaba boca abajo. La defensa del rival se
       gasta sola: la regla es "si el rival no tiene defensa", no "si el
       rival decide defenderse", y pedirle que elija con el turno del otro
       en curso agregaría una espera en la que nadie puede hacer nada. */
    let resolved: null | {
      type: string;
      value?: number;
      blocked: boolean;
    } = null;

    const pending = mine.pendingCard;
    if (pending && rivalRaw) {
      const blocked = hasDefense(rivalHand);
      if (blocked) {
        rivalHand = dropFirstOfType(rivalHand, CARD.DEFENSE);
      } else if (pending.type === CARD.STEAL) {
        /* No se puede robar más de lo que el rival tiene: el marcador no
           baja de cero y el ladrón no cobra de un bolsillo vacío. */
        const taken = Math.min(pending.value ?? 0, rivalScore);
        rivalScore -= taken;
        myScore += taken;
      } else if (pending.type === CARD.CURSE) {
        rivalCurse = CURSE_TURNS;
      }
      resolved = { type: pending.type, value: pending.value, blocked };
    }

    /* El objetivo se evalúa después de la carta: robar 22 puede ser
       justo lo que te cierra la partida. */
    const gameFinished = myScore >= GOAL;
    const newScore = cappedScore(myScore);

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      sessionId: args.sessionId,
      action: gameFinished ? "hold_and_win" : "hold",
      payload: { newScore, goal: GOAL, resolved },
      timestamp: Date.now(),
    });

    const meAfter = {
      ...me.player,
      score: newScore,
      current: 0,
      pendingCard: null,
      // Plantarse también cierra un turno de maldición.
      curseTurns: Math.max(0, mine.curseTurns - 1),
    };
    const rivalAfter = rivalRaw
      ? { ...rivalRaw, score: rivalScore, hand: rivalHand, curseTurns: rivalCurse }
      : undefined;

    if (gameFinished) {
      await ctx.db.patch(room._id, {
        [me.key]: meAfter,
        ...(rivalAfter ? { [me.other]: rivalAfter } : {}),
        status: "finished",
        winner: me.key,
      });
      return { newScore, gameFinished: true, winner: me.key, resolved };
    }

    await ctx.db.patch(room._id, {
      [me.key]: meAfter,
      ...(rivalAfter ? { [me.other]: rivalAfter } : {}),
      turn: me.other,
    });

    return { newScore, gameFinished: false, newTurn: me.other, resolved };
  },
});
