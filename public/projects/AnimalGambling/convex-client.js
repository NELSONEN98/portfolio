// Detect environment: localhost, Netlify, or other
const CONVEX_PROXY_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : `${window.location.origin}/.netlify/functions/convex-proxy`;

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

async function callConvexViaProxy(functionPath, args) {
  try {
    const response = await fetch(CONVEX_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ functionPath, args }),
    });

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Convex proxy error:", error);
    throw new Error(`Convex call failed: ${error.message}`);
  }
}

async function createOnlineRoom() {
  const sessionId = getSessionId();
  try {
    const result = await callConvexViaProxy("rooms:createRoom", { sessionId });
    return result.roomId;
  } catch (error) {
    console.error("Error creating room:", error);
    throw error;
  }
}

async function updatePlayerCharacter(roomId, playerName, catId) {
  const sessionId = getSessionId();
  try {
    return await callConvexViaProxy("rooms:updatePlayerCharacter", {
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

async function joinOnlineRoom(roomId, playerName, catId) {
  const sessionId = getSessionId();
  try {
    const result = await callConvexViaProxy("rooms:joinRoom", {
      roomId,
      sessionId,
      playerName,
      catId,
    });
    return result.roomId;
  } catch (error) {
    console.error("Error joining room:", error);
    throw error;
  }
}

async function getRoom(roomId) {
  try {
    return await callConvexViaProxy("rooms:getRoom", { roomId });
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
    return await callConvexViaProxy("rooms:rollDice", { roomId, sessionId });
  } catch (error) {
    console.error("Error rolling dice:", error);
    throw error;
  }
}

async function convexHoldScore(roomId) {
  const sessionId = getSessionId();
  try {
    return await callConvexViaProxy("rooms:holdScore", { roomId, sessionId });
  } catch (error) {
    console.error("Error holding score:", error);
    throw error;
  }
}

// Functions are available globally to script.js
