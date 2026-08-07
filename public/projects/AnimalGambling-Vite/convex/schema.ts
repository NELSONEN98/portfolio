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
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_roomId", ["roomId"]),

  gameEvents: defineTable({
    roomId: v.string(),
    sessionId: v.string(),
    action: v.string(),
    payload: v.any(),
    timestamp: v.number(),
  }).index("by_roomId", ["roomId"]),
});
