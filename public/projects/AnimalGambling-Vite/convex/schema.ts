import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const card = v.object({
  uid: v.string(),
  type: v.string(),
  value: v.optional(v.number()),
});

/* Los campos del tablero y las cartas van optional: las salas creadas
   antes de esta versión no los tienen y el schema tiene que seguir
   validándolas. El código las trata como cero / mano vacía. */
const player = v.object({
  sessionId: v.string(),
  name: v.union(v.null(), v.string()),
  catId: v.union(v.null(), v.string()),
  score: v.number(),
  current: v.number(),

  // Casilla del camino donde está la ficha.
  pos: v.optional(v.number()),
  hand: v.optional(v.array(card)),
  /* Cartas jugadas boca abajo, en el orden en que se pusieron. Se revelan
     al plantarse y recién ahí se resuelven, que es lo que le da al rival
     la chance de responder. Se pueden acumular varias en un turno.
     pendingCard queda por las salas creadas con la versión de una sola. */
  pendingCard: v.optional(v.union(v.null(), card)),
  pendingCards: v.optional(v.array(card)),
  // Turnos que le quedan al rival con el dado limitado.
  curseTurns: v.optional(v.number()),
  // Turnos que le quedan con la mesa borrosa. Opcional como el resto: las
  // salas abiertas de antes no lo traen y tienen que seguir validando.
  beerTurns: v.optional(v.number()),
  // Vale para la próxima tirada y se consume ahí mismo.
  doubleNext: v.optional(v.boolean()),
});

export default defineSchema({
  rooms: defineTable({
    roomId: v.string(),

    /* ►► La mesa, en orden de asiento. ◄◄
     *
     * Reemplaza a `player1` / `player2`, que eran dos campos separados y por
     * lo tanto una mesa de exactamente dos, escrita en el schema. Con un
     * array el tamaño de la mesa deja de ser una decisión de la base.
     *
     * El índice en este array ES el asiento: quién le pega a quién y a quién
     * le toca después salen de ahí (ver `targetOf` y `nextSeat` en rules.ts).
     * Por eso el ORDEN importa y no se puede reordenar por comodidad. */
    players: v.optional(v.array(player)),
    /* El asiento al que le toca. Número, no "player1": con cuatro sillas un
       nombre fijo no alcanza. */
    seat: v.optional(v.number()),

    /* ---- la forma vieja, de dos campos ----
     * Quedan declarados y en `optional` por una sola razón: las salas que ya
     * están en la base los tienen, y un schema que no las valide hace fallar
     * el deploy entero. No se escriben más — todas las mutaciones guardan
     * `players` — y las lecturas los aceptan como respaldo mientras vivan.
     * Las salas duran 30 minutos, así que media hora después del despliegue
     * estos tres se pueden borrar sin que nadie lo note. */
    player1: v.optional(player),
    player2: v.optional(player),
    turn: v.optional(v.string()),

    status: v.string(),
    /* Se sortea al crear la sala y viaja con ella: los dos jugadores tienen
       que ver las mismas casillas en los mismos lugares. Optional porque
       las salas anteriores al tablero no lo tienen. */
    board: v.optional(v.array(v.string())),
    /* Quién ganó, dicho por el backend. Deducirlo comparando puntajes del
       lado del cliente falla justo en el abandono, donde el que se queda
       puede tener menos.
       Ahora es el ASIENTO. La unión con string es para las salas viejas, que
       lo guardaron como "player1" / "player2"; se lee con `winnerSeat()`. */
    winner: v.optional(v.union(v.number(), v.string())),
    endedByAbandon: v.optional(v.boolean()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    // Para que el cron de limpieza no recorra la tabla entera.
    .index("by_expiresAt", ["expiresAt"]),

  gameEvents: defineTable({
    roomId: v.string(),
    sessionId: v.string(),
    action: v.string(),
    payload: v.any(),
    timestamp: v.number(),
  }).index("by_roomId", ["roomId"]),
});
