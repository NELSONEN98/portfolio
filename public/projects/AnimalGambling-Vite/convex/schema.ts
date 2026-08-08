import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    roomId: v.string(),
    player1: v.object({
      sessionId: v.string(),
      name: v.union(v.null(), v.string()),
      catId: v.union(v.null(), v.string()),
      score: v.number(),
      current: v.number(),
    }),
    player2: v.optional(v.object({
      sessionId: v.string(),
      name: v.union(v.null(), v.string()),
      catId: v.union(v.null(), v.string()),
      score: v.number(),
      current: v.number(),
    })),
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
