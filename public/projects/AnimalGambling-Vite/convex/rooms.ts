import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createRoom = mutation({
  args: {
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    const roomId = crypto.getRandomValues(new Uint8Array(6))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
      .toUpperCase()
      .slice(0, 6);

    const room = await ctx.db.insert("rooms", {
      roomId,
      player1: {
        sessionId: args.sessionId,
        name: null,
        catId: null,
        score: 0,
        current: 0,
      },
      player2: null,
      turn: "player1",
      status: "waiting",
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 30,
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
    const room = await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .unique();

    if (!room) throw new Error("Room not found");

    const isPlayer1 = room.player1.sessionId === args.sessionId;
    const playerKey = isPlayer1 ? "player1" : "player2";

    await ctx.db.patch(room._id, {
      [playerKey]: {
        ...room[playerKey],
        name: args.playerName,
        catId: args.catId,
      },
    });

    return { success: true };
  },
});

export const joinRoom = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
    playerName: v.string(),
    catId: v.string(),
  },
  async handler(ctx, args) {
    const room = await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .unique();

    if (!room) throw new Error("Room not found");
    if (room.status !== "waiting") throw new Error("Room full or finished");

    await ctx.db.patch(room._id, {
      player2: {
        sessionId: args.sessionId,
        name: args.playerName,
        catId: args.catId,
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
    return await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .unique();
  },
});

export const rollDice = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    const room = await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .unique();

    if (!room) throw new Error("Room not found");
    if (room.status !== "playing") throw new Error("Game not active");

    const isPlayer1 = room.player1.sessionId === args.sessionId;
    const currentPlayer = isPlayer1 ? room.player1 : room.player2;
    const turn = isPlayer1 ? "player1" : "player2";

    if (room.turn !== turn) throw new Error("Not your turn");

    const roll = Math.floor(Math.random() * 6) + 1;
    const isBust = roll === 1;

    if (isBust) {
      const otherTurn = isPlayer1 ? "player2" : "player1";
      await ctx.db.patch(room._id, {
        turn: otherTurn,
        [`player${isPlayer1 ? 1 : 2}`]: {
          ...currentPlayer,
          current: 0,
        },
      });

      await ctx.db.insert("gameEvents", {
        roomId: args.roomId,
        sessionId: args.sessionId,
        action: "roll",
        payload: { roll, isBust: true },
        timestamp: Date.now(),
      });

      return { roll, isBust: true, newTurn: otherTurn };
    }

    const newCurrent = currentPlayer.current + roll;

    await ctx.db.patch(room._id, {
      [`player${isPlayer1 ? 1 : 2}`]: {
        ...currentPlayer,
        current: newCurrent,
      },
    });

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      sessionId: args.sessionId,
      action: "roll",
      payload: { roll, newCurrent },
      timestamp: Date.now(),
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
    const room = await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .unique();

    if (!room) throw new Error("Room not found");

    const isPlayer1 = room.player1.sessionId === args.sessionId;
    const currentPlayer = isPlayer1 ? room.player1 : room.player2;
    const playerKey = isPlayer1 ? 1 : 2;

    const newScore = currentPlayer.score + currentPlayer.current;
    const otherTurn = isPlayer1 ? "player2" : "player1";

    const GOAL = 50;
    const gameFinished = newScore >= GOAL;

    if (gameFinished) {
      await ctx.db.patch(room._id, {
        [`player${playerKey}`]: {
          ...currentPlayer,
          score: newScore,
          current: 0,
        },
        status: "finished",
      });

      await ctx.db.insert("gameEvents", {
        roomId: args.roomId,
        sessionId: args.sessionId,
        action: "hold_and_win",
        payload: { newScore, goal: GOAL },
        timestamp: Date.now(),
      });

      return { newScore, gameFinished: true, winner: isPlayer1 ? 1 : 2 };
    }

    await ctx.db.patch(room._id, {
      [`player${playerKey}`]: {
        ...currentPlayer,
        score: newScore,
        current: 0,
      },
      turn: otherTurn,
    });

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      sessionId: args.sessionId,
      action: "hold",
      payload: { newScore },
      timestamp: Date.now(),
    });

    return { newScore, gameFinished: false, newTurn: otherTurn };
  },
});
