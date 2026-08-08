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
  /* Carta jugada boca abajo. Se revela al plantarse y recién ahí se
     resuelve, que es lo que le da al rival la chance de responder. */
  pendingCard: v.optional(v.union(v.null(), card)),
  // Turnos que le quedan al rival con el dado limitado.
  curseTurns: v.optional(v.number()),
  // Vale para la próxima tirada y se consume ahí mismo.
  doubleNext: v.optional(v.boolean()),
});

export default defineSchema({
  rooms: defineTable({
    roomId: v.string(),
    player1: player,
    player2: v.optional(player),
    turn: v.string(),
    status: v.string(),
    /* Quién ganó, dicho por el backend. Deducirlo comparando puntajes del
       lado del cliente falla justo en el abandono, donde el que se queda
       puede tener menos. */
    winner: v.optional(v.string()),
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
