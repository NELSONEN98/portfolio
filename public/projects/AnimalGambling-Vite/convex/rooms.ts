import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  GOAL,
  makeBoard,
  CARD,
  hasRoomFor,
  CURSE_TURNS,
  SQUARE,
  squareFor,
  targetOf,
  nextSeat,
  MAX_PLAYERS,
  MIN_PLAYERS,
  advance,
  startingHand,
  randomBonusCard,
  resolveRoll,
  applyPenalty,
  cappedScore,
  applyCard,
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

/* ►► Los tres adaptadores de forma. ◄◄
 *
 * Toda lectura de la sala pasa por acá y sale siempre en la forma nueva —un
 * array de asientos y un número de turno—, venga el documento como venga.
 * Es lo que permite cambiar el schema sin romper las partidas en curso: una
 * sala vieja se sigue leyendo bien, y en cuanto alguien la toca se guarda ya
 * con la forma nueva.
 *
 * El único lugar del archivo que sabe que existió una forma vieja es este
 * bloque. El resto del código habla de asientos y nada más. */
function seatsOf(room: any) {
  if (room.players?.length) return room.players;
  // Sala anterior a la migración: dos campos sueltos, en orden.
  return [room.player1, room.player2].filter(Boolean);
}

function seatOf(room: any): number {
  if (typeof room.seat === "number") return room.seat;
  return room.turn === "player2" ? 1 : 0;
}

/* El ganador, siempre como asiento. Las salas viejas lo guardaron con
   nombre; las nuevas, con número. */
function winnerSeat(room: any): number | undefined {
  if (typeof room.winner === "number") return room.winner;
  if (room.winner === "player2") return 1;
  if (room.winner === "player1") return 0;
  return undefined;
}

/* Quién tira: devuelve el jugador, su ASIENTO y a quién apuntan sus cartas.
   Devolvía `{ key, other }` — dos nombres fijos, o sea una mesa de dos
   escrita en el tipo. Ahora `objetivo` sale de `targetOf`, así que con
   cuatro sillas cada uno le pega al de su derecha sin tocar nada de acá. */
function whoIs(room: Doc<"rooms">, sessionId: string) {
  const seats = seatsOf(room);
  const seat = seats.findIndex((p: any) => p?.sessionId === sessionId);
  if (seat === -1) return null;
  return {
    player: seats[seat],
    seat,
    objetivo: targetOf(seat, seats.length),
    seats,
  };
}

/* Devuelve la mesa con un asiento reemplazado. Las mutaciones escriben así
   en vez de `[me.key]: {...}`: el array entero se guarda de una, y no hay
   forma de olvidarse de un jugador. */
function withSeat(seats: any[], seat: number, player: any) {
  return seats.map((p, i) => (i === seat ? player : p));
}

/* Las salas creadas antes del tablero no traen estos campos. Leerlos por
   acá evita repartir `?? 0` por todo el archivo y que uno se olvide. */
function boardOf(p: any) {
  return {
    pos: p.pos ?? 0,
    hand: (p.hand ?? []) as Card[],
    /* Se acepta el campo viejo de una sola carta para no romper las salas
       que quedaron abiertas de la versión anterior. */
    pendingCards: (p.pendingCards ?? (p.pendingCard ? [p.pendingCard] : [])) as Card[],
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
    hand: startingHand(),
    pendingCard: null,
    pendingCards: [],
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
      /* La mesa arranca con un solo asiento ocupado: el del que creó. Los
         demás se agregan con `joinRoom`, en el orden en que llegan — y ese
         orden es el de la ronda y el de los ataques, así que entrar primero
         no es lo mismo que entrar último. */
      players: [freshPlayer(args.sessionId)],
      seat: 0,
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
      players: withSeat(me.seats, me.seat, {
        ...me.player,
        name: args.playerName,
        catId: args.catId,
      }),
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

    const seats = seatsOf(room);
    if (seats.length >= MAX_PLAYERS) throw new ConvexError("Room full or finished");

    /* Se suma al final: el índice en el array es el asiento, y el asiento
       decide el orden de la ronda y a quién le pega cada uno. Insertar en el
       medio le cambiaría la víctima a alguien que ya está jugando.

       La sala pasa a `playing` en cuanto hay dos, pero SIGUE aceptando gente
       hasta el tope: con cuatro sillas, esperar a que se llenen todas para
       arrancar dejaría colgada cualquier partida de tres. */
    const conElNuevo = [...seats, freshPlayer(args.sessionId)];
    await ctx.db.patch(room._id, {
      players: conElNuevo,
      status: conElNuevo.length >= MIN_PLAYERS ? "playing" : "waiting",
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
      /* Con dos jugadores, que uno se vaya termina la partida y gana el que
         queda. Con más de dos eso sería absurdo —quedan tres jugando— pero
         resolverlo de verdad pide decidir qué pasa con el asiento vacío: si
         se saca del círculo cambian todos los objetivos a mitad de partida,
         y si se deja se le pega a un fantasma. Es una decisión de diseño
         pendiente, así que por ahora se conserva el comportamiento conocido
         y el ganador es el de la derecha del que se fue. */
      const ganador = me.objetivo;
      await ctx.db.patch(room._id, {
        status: "finished",
        winner: ganador,
        endedByAbandon: true,
      });

      await ctx.db.insert("gameEvents", {
        roomId: args.roomId,
        sessionId: args.sessionId,
        action: "abandon",
        payload: { winner: ganador },
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
       así que las dos pantallas tienen que leerlo de acá.

       Y sale NORMALIZADA: `players`, `seat` y `winner` siempre en la forma
       nueva, aunque el documento todavía tenga la vieja. Así el cliente no
       necesita saber que existieron dos formas — toda esa deuda queda de
       este lado, que es el único que se despliega de una vez. */
    return {
      ...room,
      players: seatsOf(room),
      seat: seatOf(room),
      winner: winnerSeat(room),
      goal: GOAL,
      lastEvent,
    };
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
    if (seatOf(room) !== me.seat) throw new ConvexError("Not your turn");

    const mine = boardOf(me.player);

    /* La maldición la sufre quien tira, y la puso el otro: el contador vive
       en el que la padece y se descuenta acá. */
    const cursed = mine.curseTurns > 0;
    const outcome = resolveRoll(rand, cursed, mine.doubleNext);

    /* La ficha avanza aunque el turno se queme: el 1 te saca lo acumulado,
       no te devuelve al casillero anterior.

       Avanza la SUMA DE LOS DADOS y no los puntos ganados: `gained`
       descarta los que salieron 1, así que con la carta de dos dados un
       [1,5] mostraba 6 en pantalla y movía 5. El puntaje sigue su regla;
       el tablero es posición física y tiene que coincidir con lo que se ve.
       Tiene que ser idéntico al cliente o las dos fichas se separan. */
    const steps = outcome.dice.reduce((a, b) => a + b, 0);
    const pos = advance(mine.pos, steps);
    /* Qué es la casilla PARA ESTE jugador: con la maldición encima, sus
       bonus dejan de entregar carta y le cortan el turno. El tablero
       guardado no se toca —es el mismo para los dos— y la conversión ocurre
       acá, al leerlo. */
    const square = squareFor(room.board as any, pos, cursed);

    let score = me.player.score;
    let hand = mine.hand;
    let landed: string = SQUARE.PLAIN;
    /* Qué carta entregó la casilla. Va en la respuesta porque el cliente la
       muestra grande antes de guardarla, y comparando manos no podría
       distinguir la ganada de una devuelta al quemarse. */
    let gainedCard: Card | null = null;

    if (square === SQUARE.PENALTY) {
      score = applyPenalty(score);
      landed = SQUARE.PENALTY;
    } else if (square === SQUARE.TURN_LOSS) {
      /* No toca puntos ni mano: lo único que hace es avisar. El plantarse
         forzado lo dispara el cliente llamando a `holdScore`, que es la
         misma mutación del botón — así las cartas puestas se revelan y se
         cobran exactamente igual que en un plantarse a mano, en vez de
         tener acá una segunda copia de esa resolución que se desincronice
         con la primera. */
      landed = SQUARE.TURN_LOSS;
    } else if (square === SQUARE.BONUS) {
      landed = SQUARE.BONUS;
      /* Se sortea primero y se pregunta después: la respuesta depende de
         qué salió, porque los escudos tienen su propio tope y no compiten
         por el lugar de las cartas jugables. Misma función que el motor
         local, así que los dos no pueden discrepar sobre si una carta entró
         o se perdió. */
      const sorteada = randomBonusCard(rand, Date.now());
      // Sin lugar: la casilla se pisa igual pero no entrega nada.
      if (hasRoomFor(sorteada, hand, mine.pendingCards)) {
        gainedCard = sorteada;
        hand = [...hand, gainedCard];
      }
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
        cardsReturned: outcome.isBust ? mine.pendingCards.length : 0,
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
      /* Las cartas que estaban boca abajo vuelven a la mano sin revelarse:
         quemarse ya cuesta el turno entero, no tiene por qué costar
         también las cartas. */
      const devueltas = [...hand, ...mine.pendingCards];
      /* El turno pasa al SIGUIENTE asiento, no "al otro". Con dos es lo
         mismo; con cuatro, `nextSeat` gira la ronda y aquel `me.other` se
         habría quedado siempre en el segundo. */
      const siguiente = nextSeat(me.seat, me.seats.length);
      await ctx.db.patch(room._id, {
        seat: siguiente,
        players: withSeat(me.seats, me.seat, {
          ...base,
          hand: devueltas,
          pendingCard: null,
          pendingCards: [],
          current: 0,
          /* La maldición se mide en turnos, no en tiradas: acá termina uno.
             Descontándola en cada tirada duraba 1,4 turnos en vez de 3,
             porque un turno normal son casi cuatro tiradas. */
          curseTurns: Math.max(0, mine.curseTurns - 1),
        }),
      });
      return { ...outcome, roll: outcome.dice[0], pos, landed, gainedCard, newTurn: siguiente, score };
    }

    const newCurrent = me.player.current + outcome.gained;
    await ctx.db.patch(room._id, {
      players: withSeat(me.seats, me.seat, { ...base, current: newCurrent }),
    });

    return { ...outcome, roll: outcome.dice[0], pos, landed, gainedCard, newCurrent, score };
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
    if (seatOf(room) !== me.seat) throw new ConvexError("Not your turn");

    const mine = boardOf(me.player);

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
        players: withSeat(me.seats, me.seat, { ...me.player, hand, doubleNext: true }),
      });
      return { applied: "double" };
    }

    /* Se apilan: en un mismo turno se pueden poner varias y todas se
       revuelven al plantarse, una atrás de la otra. */
    await ctx.db.patch(room._id, {
      players: withSeat(me.seats, me.seat, {
        ...me.player,
        hand,
        pendingCard: null,
        pendingCards: [...mine.pendingCards, chosen],
      }),
    });

    return { applied: "pending", card: chosen, pending: mine.pendingCards.length + 1 };
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
    if (seatOf(room) !== me.seat) throw new ConvexError("Not your turn");

    const mine = boardOf(me.player);
    /* La víctima es la de tu derecha, no "el otro": sale de `targetOf`, que
       ya vale para cualquier tamaño de mesa. */
    const rivalRaw = me.seats[me.objetivo];
    const rival = rivalRaw ? boardOf(rivalRaw) : null;

    let myScore = me.player.score + me.player.current;
    let rivalScore = rivalRaw ? rivalRaw.score : 0;
    let rivalHand = rival ? rival.hand : [];
    let rivalCurse = rival ? rival.curseTurns : 0;

    /* Acá se revelan las cartas que estaban boca abajo, en el orden en que
       se pusieron. La defensa del rival se gasta sola: la regla es "si el
       rival no tiene defensa", no "si el rival decide defenderse", y
       pedirle que elija con el turno del otro en curso agregaría una espera
       en la que nadie puede hacer nada.

       Cada defensa tapa una sola carta: contra tres robos, una defensa
       frena el primero y los otros dos entran. Esa es la razón de poder
       acumular. */
    const resolved: Array<{ type: string; value?: number; blocked: boolean }> = [];

    if (rivalRaw) {
      for (const pending of mine.pendingCards) {
        /* La misma función que usa el motor local. Acá vivía una copia de
           esa cadena de decisiones, y mantener dos copias sincronizadas de
           una regla es exactamente lo que este proyecto evita poniendo las
           reglas en un archivo compartido. */
        const r = applyCard(pending, {
          score: rivalScore,
          hand: rivalHand,
          curseTurns: rivalCurse,
        });
        rivalScore = r.score;
        rivalHand = r.hand;
        rivalCurse = r.curseTurns;
        /* Los puntos que cambian de dueño: el robo transfiere, el golpe
           sólo borra. No se puede cobrar de un bolsillo vacío — el tope lo
           aplica `applyCard`. */
        myScore += r.taken;

        resolved.push({ type: pending.type, value: pending.value, blocked: r.blocked });
      }
    }

    /* El objetivo se evalúa después de la carta: robar 22 puede ser
       justo lo que te cierra la partida. */
    const gameFinished = myScore >= GOAL;
    const newScore = cappedScore(myScore);

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      sessionId: args.sessionId,
      action: gameFinished ? "hold_and_win" : "hold",
      payload: { newScore, goal: GOAL, resolved, resolvedCount: resolved.length },
      timestamp: Date.now(),
    });

    const meAfter = {
      ...me.player,
      score: newScore,
      current: 0,
      pendingCard: null,
      pendingCards: [],
      // Plantarse también cierra un turno de maldición.
      curseTurns: Math.max(0, mine.curseTurns - 1),
    };
    const rivalAfter = rivalRaw
      ? { ...rivalRaw, score: rivalScore, hand: rivalHand, curseTurns: rivalCurse }
      : undefined;

    /* Los dos asientos se escriben sobre el MISMO array y en un solo patch.
       Antes eran dos claves sueltas del documento y daba igual el orden;
       ahora no: aplicar `withSeat` dos veces sobre `me.seats` por separado
       produciría dos arrays distintos y el segundo pisaría al primero,
       perdiendo lo que le pasó a la víctima. Encadenado, cada paso parte del
       resultado del anterior. */
    const mesaFinal = rivalAfter
      ? withSeat(withSeat(me.seats, me.seat, meAfter), me.objetivo, rivalAfter)
      : withSeat(me.seats, me.seat, meAfter);

    if (gameFinished) {
      await ctx.db.patch(room._id, {
        players: mesaFinal,
        status: "finished",
        winner: me.seat,
      });
      return { newScore, gameFinished: true, winner: me.seat, resolved };
    }

    const siguiente = nextSeat(me.seat, me.seats.length);
    await ctx.db.patch(room._id, {
      players: mesaFinal,
      seat: siguiente,
    });

    return { newScore, gameFinished: false, newTurn: siguiente, resolved };
  },
});
