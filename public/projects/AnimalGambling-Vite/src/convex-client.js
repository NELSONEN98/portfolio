import { ConvexHttpClient } from 'convex/browser';

const CONVEX_URL = "https://quixotic-squid-855.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getSessionId() {
  let sessionId = sessionStorage.getItem("sessionId");
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem("sessionId", sessionId);
  }
  return sessionId;
}

async function createOnlineRoom() {
  const sessionId = getSessionId();
  try {
    const result = await convex.mutation("rooms:createRoom", { sessionId });
    return result.roomId;
  } catch (error) {
    console.error("Error creating room:", error);
    throw error;
  }
}

async function updatePlayerCharacter(roomId, playerName, catId) {
  const sessionId = getSessionId();
  try {
    return await convex.mutation("rooms:updatePlayerCharacter", {
      roomId,
      sessionId,
      playerName,
      catId,
    });
  } catch (error) {
    console.error("Error updating character:", error);
    throw error;
  }
}

async function joinOnlineRoom(roomId) {
  const sessionId = getSessionId();
  try {
    const result = await convex.mutation("rooms:joinRoom", { roomId, sessionId });
    return result.roomId;
  } catch (error) {
    console.error("Error joining room:", error);
    throw error;
  }
}

async function getRoom(roomId) {
  try {
    return await convex.query("rooms:getRoom", { roomId });
  } catch (error) {
    console.error("Error fetching room:", error);
    throw error;
  }
}

function watchRoom(roomId, callback) {
  let unsubscribed = false;

  async function poll() {
    if (unsubscribed) return;
    try {
      const room = await getRoom(roomId);
      callback(room);
      setTimeout(poll, 2000);
    } catch (error) {
      console.error("Error polling room:", error);
      setTimeout(poll, 5000);
    }
  }

  poll();
  return () => { unsubscribed = true; };
}

async function convexRollDice(roomId) {
  const sessionId = getSessionId();
  try {
    return await convex.mutation("rooms:rollDice", { roomId, sessionId });
  } catch (error) {
    console.error("Error rolling dice:", error);
    throw error;
  }
}

async function convexHoldScore(roomId) {
  const sessionId = getSessionId();
  try {
    return await convex.mutation("rooms:holdScore", { roomId, sessionId });
  } catch (error) {
    console.error("Error holding score:", error);
    throw error;
  }
}

// Export functions for use in script.js
export {
  createOnlineRoom,
  updatePlayerCharacter,
  joinOnlineRoom,
  getRoom,
  watchRoom,
  convexRollDice,
  convexHoldScore,
  getSessionId,
};
