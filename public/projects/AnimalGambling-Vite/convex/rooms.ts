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
  seatAfter,
  sentidoDe,
  esDeFlujo,
  resolverFlujo,
  A_LA_DERECHA,
  MAX_PLAYERS,
  MIN_PLAYERS,
  advance,
  passedStart,
  LAP_BONUS,
  startingHand,
  mirrorHand,
  randomBonusCard,
  resolveRoll,
  applyPenalty,
  penaltyFor,
  cappedScore,
  applyCard,
  tickBeer,
  addBeer,
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

/* El sentido de la mesa, con el respaldo de las salas que no lo traen. Un
   adaptador más, del mismo grupo que los otros tres de este archivo. */
function sentidoOf(room: any) {
  return sentidoDe(room.sentido);
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
    /* El objetivo depende del SENTIDO, no sólo del asiento: con la mesa dada
       vuelta, tu víctima pasa a ser quien te venía atacando. */
    objetivo: targetOf(seat, seats.length, sentidoOf(room)),
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
    beerTurns: p.beerTurns ?? 0,
    beerStacks: p.beerStacks ?? 0,
    doubleNext: p.doubleNext ?? false,
  };
}

/* ►► A qué número arranca sola. ◄◄
 *
 * Ya NO es "para cuántos se abrió la mesa": eso era una decisión que había
 * que tomar antes de saber quién iba a venir, o sea un pronóstico. El
 * anfitrión manda el código y RECIÉN DESPUÉS se entera de cuántos entran.
 *
 * Ahora toda sala nueva se abre en `MAX_PLAYERS` y la arranca el anfitrión
 * con los que haya. Este número queda como el único automatismo que sigue
 * teniendo sentido: con la mesa físicamente llena no hay nada que esperar,
 * y pedir un botón ahí es pedir que se confirme lo obvio.
 *
 * ►► Y el respaldo en MIN_PLAYERS no es decoración. ◄◄
 *
 * Cliente y servidor se despliegan con dos comandos distintos, así que hay
 * una ventana en que el cliente VIEJO le habla al servidor nuevo. Ese
 * cliente no sabe pedir `startRoom` —no existía— y crea la sala sin `size`.
 * Sin este respaldo se quedaría esperando para siempre un arranque que
 * nadie puede disparar. Con él, su sala arranca con el segundo exactamente
 * como arrancaba ayer. Se puede borrar cuando no quede ninguna sala vieja
 * viva: media hora después del despliegue. */
function sizeOf(room: any): number {
  const n = room.size ?? MIN_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, n));
}

const rand = () => Math.random();

/* La mano entra por parámetro y no se sortea acá adentro: el reparto de la
   sala es UNO solo y se copia a cada asiento. El porqué está en
   `mirrorHand`, en las reglas. */
function freshPlayer(sessionId: string, hand: Card[]) {
  return {
    sessionId,
    name: null,
    catId: null,
    score: 0,
    current: 0,
    pos: 0,
    hand,
    pendingCard: null,
    pendingCards: [],
    curseTurns: 0,
    beerTurns: 0,
    beerStacks: 0,
    doubleNext: false,
  };
}

export const createRoom = mutation({
  args: {
    sessionId: v.string(),
    /* A qué número arranca sola. El cliente nuevo manda siempre
       `MAX_PLAYERS`, o sea "sólo sola cuando se llene"; el resto del tiempo
       la arranca el anfitrión.
       Optional porque el cliente viejo no lo manda, y ahí el respaldo de
       `sizeOf` le devuelve el duelo de dos que ese cliente sabe jugar. */
    size: v.optional(v.number()),
  },
  async handler(ctx, args) {
    /* Seis caracteres sobre 32 símbolos son 1e9 combinaciones, pero las
       salas viven 30 minutos y el espacio ocupado nunca es cero. */
    let roomId = makeRoomId();
    for (let attempt = 0; attempt < 5 && (await findRoom(ctx, roomId)); attempt++) {
      roomId = makeRoomId();
    }

    const openingHand = startingHand(rand);

    /* Se acota acá y no se confía en el cliente: `size` viaja por la red y
       un 9 dejaría una sala que no arranca sola nunca porque nunca se
       llena — y el anfitrión tendría que apretar el botón siempre. */
    const size = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, args.size ?? MIN_PLAYERS));

    await ctx.db.insert("rooms", {
      roomId,
      size,
      /* La mesa arranca con un solo asiento ocupado: el del que creó. Los
         demás se agregan con `joinRoom`, en el orden en que llegan — y ese
         orden es el de la ronda y el de los ataques, así que entrar primero
         no es lo mismo que entrar último. */
      players: [freshPlayer(args.sessionId, mirrorHand(openingHand, 0))],
      seat: 0,
      status: "waiting",
      // Toda mesa arranca yendo hacia la derecha.
      sentido: A_LA_DERECHA,
      // Un tablero distinto por partida.
      board: makeBoard(rand),
      /* Se sortea acá, con la sala, y no cuando entra cada uno: es lo que
         hace que todos abran con las mismas cartas. */
      openingHand,
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

    /* ►► Un gato por jugador. ◄◄
     *
     * Con dos esto no se notaba: el otro elegía en su pantalla y si repetía
     * el gato quedaban dos Bonifacios, feo pero legible. Con cuatro es otra
     * cosa — `charFromCatId` devuelve el mismo personaje para dos asientos y
     * la mesa pasa a tener dos peleadores idénticos con marcadores
     * distintos, que es imposible de seguir.
     *
     * Se valida en el servidor y no sólo pintando la carta en gris del lado
     * del cliente: dos jugadores pueden tocar el mismo gato en el mismo
     * instante y el que pierde la carrera tiene que enterarse. */
    const tomado = me.seats.some(
      (p: any, i: number) => i !== me.seat && p?.catId === args.catId
    );
    if (tomado) throw new ConvexError("Ese gato ya lo eligió otro jugador");

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
    /* El tope es el de las REGLAS, no el de la sala: toda mesa abierta
       acepta hasta cuatro. `size` ya no dice cuántos entran —eso lo decide
       quién llegue— sino a qué número arranca sola. */
    if (seats.length >= MAX_PLAYERS) throw new ConvexError("Room full or finished");

    /* Se suma al final: el índice en el array es el asiento, y el asiento
       decide el orden de la ronda y a quién le pega cada uno. Insertar en el
       medio le cambiaría la víctima a alguien que ya está jugando.

       ►► La sala NO arranca con el segundo. ◄◄
       Antes pasaba a `playing` con el segundo y seguía aceptando gente
       adentro. Eso funcionaba mientras dos fuera el único tamaño posible;
       con una mesa de cuatro es directamente otro juego: el tercero entraba
       a una partida empezada, con el asiento 0 ya con puntos, y los
       objetivos de todos cambiaban a mitad de camino porque `targetOf`
       depende de cuántos hay sentados.

       Y tampoco arranca a un tamaño declarado de antemano, que fue el
       primer intento: eso obligaba al anfitrión a adivinar cuánta gente iba
       a venir ANTES de mandar el código. Ahora la mesa queda abierta y la
       arranca él cuando ve quién llegó, con `startRoom`.

       Lo único que sigue siendo automático es la mesa llena: con cuatro
       sentados no hay nada que esperar. Y para las salas del cliente viejo
       `sizeOf` devuelve dos, así que ahí "arranca con el segundo" sigue
       siendo verdad exactamente donde tiene que serlo. */
    /* La mano guardada en la sala, no la que tenga puesta el asiento 0: acá
       se puede entrar con la partida ya empezada, y para entonces la mano
       del primero tiene cartas jugadas y ganadas. Las salas abiertas antes
       de que esto existiera no la traen, y ahí se reparte suelto — con la
       desigualdad de siempre, que es mejor que no dejarlas entrar. */
    const openingHand = (room.openingHand as Card[] | undefined) ?? startingHand(rand);
    const conElNuevo = [
      ...seats,
      freshPlayer(args.sessionId, mirrorHand(openingHand, seats.length)),
    ];
    await ctx.db.patch(room._id, {
      players: conElNuevo,
      status: conElNuevo.length >= sizeOf(room) ? "playing" : "waiting",
    });

    return { roomId: args.roomId };
  },
});

/* ►► Arrancar la mesa. Éste es EL camino. ◄◄
 *
 * Nació como escape —"si el cuarto no llega, que el anfitrión arranque
 * igual"— y terminó siendo la única puerta. La razón es que la pregunta que
 * reemplaza no se podía contestar: elegir el tamaño al CREAR la sala obliga
 * a pronosticar cuánta gente va a venir antes de haber mandado el código.
 * Nadie sabe eso. Lo sabe media hora después, mirando el vestíbulo — que es
 * exactamente cuando se aprieta este botón.
 *
 * Así el juego online deja de tener dos caminos. Hay UNA sala, entran de
 * dos a cuatro, y lo que se juega es lo que haya.
 *
 * Sólo el asiento 0, y no es jerarquía por gusto: es el único que estuvo
 * desde el principio, así que es el único que sabe a quién está esperando.
 * Con cualquiera pudiendo arrancar, el que entra segundo le cierra la
 * puerta en la cara al tercero que ya venía en camino.
 *
 * Deja `size` en los que se sentaron. No cambia nada de la partida —el
 * juego lee el largo del array, no este campo— pero deja la sala describiendo
 * lo que terminó siendo en vez de un tope que nunca se alcanzó.
 */
export const startRoom = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    const room = await findRoom(ctx, args.roomId);
    if (!room) throw new ConvexError("Room not found");

    /* Idempotente: dos toques al botón, o el sondeo llegando tarde, no son
       un error — la sala ya arrancó y eso es justo lo que se pedía. */
    if (room.status === "playing") return { started: true };
    if (room.status !== "waiting") throw new ConvexError("Room full or finished");

    const me = whoIs(room, args.sessionId);
    if (!me) throw new ConvexError("You are not in this room");
    if (me.seat !== 0) throw new ConvexError("Sólo el anfitrión arranca la mesa");

    const seats = seatsOf(room);
    if (seats.length < MIN_PLAYERS) throw new ConvexError("Falta gente en la mesa");

    await ctx.db.patch(room._id, { status: "playing", size: seats.length });

    return { started: true, size: seats.length };
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

    /* Todavía en el vestíbulo.
     *
     * Antes esto borraba la sala fuera quien fuera el que se iba, y con dos
     * jugadores era razonable: si el único invitado se va, la sala no le
     * sirve a nadie. Con una mesa de cuatro es un desastre — el segundo que
     * se arrepiente le borra el código al anfitrión y a los otros dos que ya
     * estaban esperando.
     *
     * La sala es del que la abrió: se va él, se termina; se va un invitado,
     * libera su silla y los demás siguen esperando. Los que quedan se
     * corren un lugar, que es lo mismo que hace la mesa cuando alguien
     * abandona en partida. */
    if (room.status === "waiting") {
      if (me.seat === 0) {
        await ctx.db.delete(room._id);
        return { ok: true, deleted: true };
      }
      await ctx.db.patch(room._id, {
        players: me.seats.filter((_: any, i: number) => i !== me.seat),
      });
      return { ok: true, left: true };
    }

    if (room.status === "playing") {
      /* ►► La silla se saca del círculo. ◄◄
       *
       * Acá vivía la decisión pendiente: con más de dos, ¿el asiento vacío
       * se saca o se deja? Sacarlo cambia los objetivos de todos a mitad de
       * partida; dejarlo obliga a pegarle a un fantasma.
       *
       * Se saca, y la razón es que la alternativa es peor de lo que suena
       * el problema. Un asiento fantasma le come el ataque entero a quien lo
       * tenga de objetivo —sus golpes, sus robos y su maldición dejan de
       * existir por el resto de la partida— y encima le regala inmunidad al
       * que está a la derecha del fantasma, que ya no recibe de nadie. Eso
       * no es "conservar los objetivos": es partir la mesa en dos.
       *
       * Que los objetivos se recalculen no hace falta escribirlo. `targetOf`
       * los deriva del array cada vez que se lo pregunta, así que sacar el
       * elemento ES el arreglo. Ese fue siempre el sentido de tener la mesa
       * como array y no como campos con nombre.
       */
      const restantes = me.seats.filter((_: any, i: number) => i !== me.seat);

      /* Queda uno solo: no hay partida que seguir y gana por abandono, que
         es el comportamiento que la mesa de dos ya tenía. Después del filtro
         el único que queda está en el índice 0, así que ése es el ganador —
         `me.objetivo` era su asiento ANTES de sacar la silla y apuntaría al
         lugar equivocado. */
      if (restantes.length < MIN_PLAYERS) {
        await ctx.db.patch(room._id, {
          players: restantes,
          seat: 0,
          status: "finished",
          winner: 0,
          endedByAbandon: true,
        });

        await ctx.db.insert("gameEvents", {
          roomId: args.roomId,
          sessionId: args.sessionId,
          action: "abandon",
          payload: { winner: 0 },
          timestamp: Date.now(),
        });

        return { ok: true, finished: true };
      }

      /* El turno se reindexa porque los que estaban detrás del que se fue
         se corrieron un lugar. Los tres casos:
         · le tocaba a alguien de más atrás  → baja uno
         · le tocaba a alguien de más adelante → se queda donde está
         · le tocaba AL QUE SE FUE → el turno pasa a quien ahora ocupa su
           índice, o sea el de su derecha, que es exactamente a quien le
           tocaba después. El módulo es para cuando el que se fue era el
           último de la ronda. */
      const actual = seatOf(room);
      const siguiente =
        actual > me.seat ? actual - 1 : actual % restantes.length;

      await ctx.db.patch(room._id, {
        players: restantes,
        seat: siguiente,
      });

      /* Se avisa como hecho propio y no como abandono: la partida sigue, y
         un cartel de "tu rival se levantó" en una mesa donde quedan tres
         diría que se terminó algo que no se terminó. */
      await ctx.db.insert("gameEvents", {
        roomId: args.roomId,
        sessionId: args.sessionId,
        action: "leave",
        payload: { name: me.player?.name ?? null, quedan: restantes.length },
        timestamp: Date.now(),
      });

      return { ok: true, left: true, quedan: restantes.length };
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
      /* Para cuántos se abrió: el vestíbulo dibuja una silla vacía por cada
         uno que falta, y sin este número no sabría cuántas dibujar. */
      size: sizeOf(room),
      /* Viaja con la sala porque la pantalla lo necesita para dos cosas:
         saber a quién apunta la mira y qué contarle al jugador cuando la
         mesa se da vuelta. */
      sentido: sentidoOf(room),
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
    /* Se pregunta antes de avanzar: después del módulo ya no se puede saber
       si la ficha dio la vuelta o llegó de al lado. */
    const dioVuelta = passedStart(mine.pos, steps);
    const pos = advance(mine.pos, steps);
    /* Qué es la casilla PARA ESTE jugador: con la maldición encima, sus
       bonus dejan de entregar carta y le cobran puntos. El tablero
       guardado no se toca —es el mismo para los dos— y la conversión ocurre
       acá, al leerlo. */
    const square = squareFor(room.board as any, pos, cursed);

    /* El premio por la vuelta va al marcador, igual que la penitencia lo
       descuenta de ahí: los dos son efectos del camino, y lo que el camino
       da o saca no depende de si el turno termina bien. */
    let score = me.player.score + (dioVuelta ? LAP_BONUS : 0);
    let hand = mine.hand;
    let landed: string = SQUARE.PLAIN;
    /* Qué carta entregó la casilla. Va en la respuesta porque el cliente la
       muestra grande antes de guardarla, y comparando manos no podría
       distinguir la ganada de una devuelta al quemarse. */
    let gainedCard: Card | null = null;
    /* Qué tipo de carta se perdió por falta de lugar, si se perdió alguna.
       El cliente no lo puede deducir: sabe que cayó en bonus y que no vino
       carta, pero no cuál de los dos bolsillos estaba lleno — y "mazo lleno"
       cuando lo que sobra son escudos manda a hacer lugar donde ya lo había.
       El servidor sí lo sabe: acaba de sortearla. */
    let lostCard: string | null = null;
    /* La borrachera arranca en lo que ya tenía y sólo la mueve la cerveza
       del bonus. Se declara acá para que el patch de abajo la escriba una
       sola vez, salga o no salga la carta. */
    let borrachera = { beerTurns: mine.beerTurns, beerStacks: mine.beerStacks };

    if (square === SQUARE.PENALTY) {
      /* Misma regla que el cliente, llamada desde el mismo lugar: el bonus
         convertido por la maldición cobra menos que una casilla roja. */
      score = applyPenalty(score, penaltyFor(room.board as any, pos, cursed));
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
      const sorteada = randomBonusCard(rand, Date.now(), me.seats.length);

      if (sorteada.type === CARD.BEER) {
        /* La cerveza se consume al recibirla y nunca entra a la mano: como
           jugable era una carta muerta —sólo perjudica a quien la pone— y
           encima ocupaba uno de los cinco lugares del bolsillo. Acá la
           casilla de bonus pasa a tener riesgo real.
           Se sigue devolviendo como `gainedCard` para que la pantalla la
           muestre: el jugador tiene que ver QUÉ le nubló la mesa. */
        gainedCard = sorteada;
        borrachera = addBeer(borrachera);
      } else if (hasRoomFor(sorteada, hand, mine.pendingCards)) {
        gainedCard = sorteada;
        hand = [...hand, gainedCard];
      } else {
        lostCard = sorteada.type;
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
        lostCard,
        cardsReturned: outcome.isBust ? mine.pendingCards.length : 0,
      },
      timestamp: Date.now(),
    });

    const base = {
      ...me.player,
      score,
      pos,
      hand,
      ...borrachera,
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
         habría quedado siempre en el segundo.
         Y en el sentido de la mesa, que la carta de media vuelta puede
         haber dado vuelta en un turno anterior. Sin saltos: quemarse
         devuelve las cartas puestas a la mano sin revelarlas, así que nada
         del flujo llegó a ocurrir. */
      const siguiente = nextSeat(me.seat, me.seats.length, sentidoOf(room));
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
          /* Sobre `borrachera` y NO sobre `mine`: si en esta misma tirada
             cayó una cerveza del bonus, `mine` es el estado de antes y el
             tick la borraría al pasar por encima de `...base`. Quemarse
             consume un turno de la cerveza recién tomada, no la anula. */
          ...tickBeer(borrachera),
        }),
      });
      return { ...outcome, roll: outcome.dice[0], pos, landed, gainedCard, lostCard, newTurn: siguiente, score };
    }

    const newCurrent = me.player.current + outcome.gained;
    await ctx.db.patch(room._id, {
      players: withSeat(me.seats, me.seat, { ...base, current: newCurrent }),
    });

    return { ...outcome, roll: outcome.dice[0], pos, landed, gainedCard, lostCard, newCurrent, score };
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

    /* La cerveza se la toma el que la juega: efecto inmediato sobre uno
       mismo, sin pasar por las cartas boca abajo. No hay nada que revelar al
       plantarse cuando el efecto no viaja a ningún lado. */
    if (chosen.type === CARD.BEER) {
      await ctx.db.patch(room._id, {
        players: withSeat(me.seats, me.seat, { ...me.player, hand, ...addBeer(mine) }),
      });
      return { applied: "beer" };
    }

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

/* Levantar una carta de la mesa y volver a guardarla en la mano.
 *
 * Mientras esté boca abajo no pasó nada todavía: la carta recién existe
 * para el rival cuando el que la puso se planta. Hasta ese momento retirarla
 * no le saca información a nadie —el rival ya vio que se puso ALGO— así que
 * no hace falta cobrarle nada al que se arrepiente.
 *
 * No lleva chequeo de tope de mano, y no es un olvido: `countPlayable` ya
 * cuenta las cartas puestas, así que una que vuelve del fieltro a la mano no
 * mueve el total. Si entró, siempre hay lugar para que vuelva.
 *
 * Los dos dados nunca llegan acá: se aplican en el momento y no quedan
 * pendientes. Una vez tirados no hay forma de devolverlos.
 */
export const takeBackCard = mutation({
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

    const chosen = mine.pendingCards.find((c) => c.uid === args.uid);
    if (!chosen) throw new ConvexError("Esa carta no está en la mesa");

    await ctx.db.patch(room._id, {
      players: withSeat(me.seats, me.seat, {
        ...me.player,
        hand: [...mine.hand, chosen],
        pendingCard: null,
        pendingCards: dropCard(mine.pendingCards, args.uid),
      }),
    });

    return { takenBack: chosen, pending: mine.pendingCards.length - 1 };
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

    /* ►► Las cartas se parten en dos, igual que en el motor local. ◄◄
     *
     * Los ATAQUES van contra el objetivo que tenías al empezar el turno; las
     * de FLUJO deciden lo que viene después. Aplicar el flujo primero
     * dejaría poner una media vuelta y encima un robo para robarle a OTRO, y
     * eso rompe el "una sola víctima, un solo atacante" del que cuelga todo
     * el diseño direccional. La misma partición y en el mismo orden que en
     * `useGame`, con la misma función de las reglas: dos copias de esta
     * decisión es exactamente cómo se desincronizan los dos motores. */
    const ataques = mine.pendingCards.filter((c) => !esDeFlujo(c));
    const flujo = resolverFlujo(mine.pendingCards, sentidoOf(room));

    if (rivalRaw) {
      for (const pending of ataques) {
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
      /* El flujo viaja con el hecho para que las otras pantallas puedan
         contarlo: la mesa dada vuelta y los turnos comidos les pasan a
         ellos, y sin esto se enterarían sólo por ver que el turno cayó donde
         no esperaban. */
      payload: {
        newScore,
        goal: GOAL,
        resolved,
        resolvedCount: resolved.length,
        saltos: flujo.saltos,
        vueltas: flujo.vueltas,
        sentido: flujo.sentido,
      },
      timestamp: Date.now(),
    });

    const meAfter = {
      ...me.player,
      score: newScore,
      current: 0,
      pendingCard: null,
      pendingCards: [],
      // Plantarse también cierra un turno de maldición y de cerveza.
      curseTurns: Math.max(0, mine.curseTurns - 1),
      ...tickBeer(mine),
    };
    const rivalAfter = rivalRaw
      ? {
          ...rivalRaw,
          score: rivalScore,
          hand: rivalHand,
          curseTurns: rivalCurse,
        }
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
      /* Se guarda el sentido igual aunque la partida termine: la sala queda
         describiendo lo que pasó, y una media vuelta jugada en la mano
         ganadora ocurrió tanto como cualquier otra carta. */
      await ctx.db.patch(room._id, {
        players: mesaFinal,
        sentido: flujo.sentido,
        status: "finished",
        winner: me.seat,
      });
      return { newScore, gameFinished: true, winner: me.seat, resolved, ...flujo };
    }

    /* `seatAfter` y no `nextSeat`: acá es donde los saltos se cobran. Con
       tres saltos sobre una mesa de cuatro la vuelta se cierra sobre vos
       mismo, que es la regla de la carta dicha con una sola cuenta. */
    const siguiente = seatAfter(
      me.seat,
      me.seats.length,
      flujo.sentido,
      flujo.saltos
    );
    await ctx.db.patch(room._id, {
      players: mesaFinal,
      seat: siguiente,
      sentido: flujo.sentido,
    });

    return { newScore, gameFinished: false, newTurn: siguiente, resolved, ...flujo };
  },
});
