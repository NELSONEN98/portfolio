
"use strict";
import {
  createOnlineRoom,
  updatePlayerCharacter,
  joinOnlineRoom,
  getRoom,
  watchRoom,
  convexRollDice,
  convexHoldScore,
  getSessionId,
} from './convex-client.js';
 
/* ============================================
   GAMBLING KATZ — game logic
   ============================================ */

/* The retired static cast. Nothing renders these any more — the selection
   screen and the versus both run off ROSTER below, which is animated. Kept
   because the writing is worth more than the 40 lines it costs, and these
   four come back the day they get drawn as boils. */
const CHARACTERS = [
  {
    id: "penguin",
    name: "Pingüino Fiscal",
    img: "img/penguin.png",
    age: "30",
    cond: "Buscado por evasión impositiva en tres jurisdicciones.",
    quote: "La casa siempre gana. Solo me falta ser la casa.",
    loseQuote: "Ahora sí me agarra la AFIP...",
    tags: ["PRÓFUGO", "SANGRE FRÍA"],
  },
  {
    id: "bear",
    name: "Bearnardo",
    img: "img/bear.png",
    age: "42",
    cond: "Ex matón de la mafia. Ahora se hace el carnicero.",
    quote: "Enterré cosas peores que mis pérdidas.",
    loseQuote: "No tendría que haber dejado a la familia...",
    tags: ["PESADO", "PACIENTE"],
  },
  {
    id: "duck",
    name: "Pato Suertudo",
    img: "img/duck.png",
    age: "25",
    cond: "Degenerado. Viene por la dopamina, no por la plata.",
    quote: "Una tirada más. Una sola. Te lo juro.",
    loseQuote: "La próxima la siento. Dejame jugar.",
    tags: ["IMPRUDENTE", "CALIENTE"],
  },
  {
    id: "egg",
    name: "Huevo Misterioso",
    img: "img/egg.png",
    age: "???",
    cond: "Desconocido. Nunca se lo vio fuera del cascarón.",
    quote: "...",
    loseQuote: "......",
    tags: ["???", "???"],
  },
];

/* ============================================
   ROSTER — who you can actually pick
   ============================================ */
/* Every fighter here is a boil: `frames` hand-drawn PNGs in `dir` that the
   CSS cycles through, keyed off `id` via .boil[data-cat="…"]. Adding a
   third cat is this entry plus its two CSS rules — nothing else in the
   selection screen or the versus needs to know. */
const ROSTER = [
  {
    id: "cat1",
    name: "Michi Bizco",
    dir: "cat1",
    frames: 9,
    img: "cat1/frame0000.png",
    age: "7",
    cond: "Le debe plata a todos los gatos del barrio.",
    quote: "Te dije que tenía un sistema.",
    loseQuote: "Los dados están cargados. Lo sé.",
    tags: ["ANSIOSO", "SIN FILTRO"],
  },
  {
    id: "cat2",
    name: "Tuco Rayado",
    dir: "cat2",
    frames: 9,
    img: "cat2/frame0000.png",
    age: "11",
    cond: "Dice que se retiró. Vuelve todas las noches.",
    quote: "Nunca dudé. Ni un segundo.",
    loseQuote: "Una más. Dale. Una más.",
    tags: ["VETERANO", "MENTIROSO"],
  },
  {
    id: "cat3",
    name: "Feliz Pinto",
    dir: "cat3",
    frames: 10,
    img: "cat3/frame0000.png",
    age: "5",
    cond: "Cree que esto es un juego. No entiende el dinero.",
    quote: "¡Esto es lo mejor que pasó en mi vida!",
    loseQuote: "Pero... ¿cuándo es mi turno de ganar?",
    tags: ["INGENUO", "PURO"],
  },
  {
    id: "cat4",
    name: "Sombra Negra",
    dir: "cat4",
    frames: 10,
    img: "cat4/frame0000.png",
    age: "??",
    cond: "Nadie sabe de dónde vino. Gana sin hablar.",
    quote: "...",
    loseQuote: "...",
    tags: ["MISTERIO", "SILENCIO"],
  },
];

/* The boil swaps background-image every 100ms; a frame that has not been
   decoded yet paints as a hole. Warming every drawing when the player
   leaves the title buys two clicks of head start, and keeps them from
   competing with the title artwork for bandwidth. */
let framesWarmed = false;
function warmRosterFrames() {
  if (framesWarmed) return;
  framesWarmed = true;
  ROSTER.forEach((c) => {
    for (let i = 0; i < c.frames; i++) {
      new Image().src = `${c.dir}/frame${String(i).padStart(4, "0")}.png`;
    }
  });
}

/* ============================================
   MAIN MENU
   ============================================ */
/* Sections and names come from md-guides/menu-y-flujo.md.
   `ready: false` renders the entry but keeps it unclickable — the mode has no
   implementation yet, and a dead button that looks alive is worse than one
   that says so. Building a mode means flipping the flag and adding a route. */
const MENU_ITEMS = [
  { id: "online", label: "Duelo Online", ready: true, route: "room-choice", mode: "online" },
  { id: "cpu", label: "Vs. IA", ready: false, note: "práctica" },
  // The only mode that exists today: two players sharing one screen.
  { id: "local", label: "Duelo Local", ready: true, route: "select", mode: "local" },
  { id: "skins", label: "Personalización", ready: false },
  { id: "shop", label: "Tienda", ready: false },
];

/* ============================================
   STATE
   ============================================ */
const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "goalScore": 50,
  "smokeOpacity": 0.35,
  "scanlines": true,
  "particles": true
}/*EDITMODE-END*/;

const state = {
  screen: "title", // "title" | "select" | "game" | "gameover"
  gameMode: "local", // "local" | "online"
  picking: 0, // which player is picking (0 or 1)
  /* En online la pantalla muestra a los dos, pero vos sos uno solo: sin
     esto los controles quedaban vivos en el turno del rival. */
  mySide: 0,
  players: [null, null], // each: { char, score, current }
  selectedCatP1: null,
  selectedCatP2: null,
  active: 0,
  playing: false,
  finished: false, // a round has actually been won — gates #/gameover
  rolling: false, // a die is mid-animation; blocks roll and hold
  rollsTotal: 0,
  goal: TWEAK_DEFAULS.goalScore,
};

/* ============================================
   ELEMENT REFS
   ============================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  title: $("#screen-title"),
  menu: $("#screen-menu"),
  "room-choice": $("#screen-room-choice"),
  select: $("#screen-select"),
  game: $("#screen-game"),
  gameover: $("#screen-gameover"),
};

/* ============================================
   RENDER — CHARACTER SELECT
   ============================================ */
/* Clean grid: just the frame, name, and description per fighter. */
function renderCharGrid() {
  const grid = $("#char-grid");
  grid.innerHTML = ROSTER.map((c, i) => `
    <div class="char-card" data-idx="${i}" data-id="${c.id}">
      <div class="char-art boil" data-cat="${c.id}" role="img" aria-label="${c.name}"></div>
      <div class="char-name">${c.name}</div>
      <div class="char-desc">${c.cond}</div>
    </div>
  `).join("");

  grid.querySelectorAll(".char-card").forEach((el) => {
    el.addEventListener("click", () => pickCharacter(parseInt(el.dataset.idx, 10)));
  });
}

function updateSelectHeader() {
  // Solo actualizar si los elementos existen
  if ($("#p1-pick")) {
    $("#p1-pick").textContent = state.players[0]?.char.name || "— ninguno —";
  }
  if ($("#p2-pick")) {
    $("#p2-pick").textContent = state.players[1]?.char.name || "— ninguno —";
  }
}

function updatePlayButton() {
  const btn = $("#btn-play");
  if (state.gameMode === "online") {
    // Online: solo necesita P1
    btn.disabled = !state.players[0];
  } else {
    // Local: necesita P1 y P2
    btn.disabled = !state.players[0] || !state.players[1];
  }
}

function pickCharacter(idx) {
  const card = $$(".char-card")[idx];

  // Prevent clicking same card twice
  if (card.classList.contains("selected")) return;

  // In online mode, allow switching: deselect previous P1 and select new one
  if (state.gameMode === "online") {
    $$(".char-card.selected").forEach((el) => {
      el.classList.remove("selected", "p1", "p2");
      el.removeAttribute("data-player");
    });
    state.picking = 0;
    state.players[0] = null;
    state.selectedCatP1 = null;
  } else {
    // Local mode: limit to 2 selections max
    const selectedCount = $$(".char-card.selected").length;
    if (selectedCount >= 2) return;
  }

  const char = ROSTER[idx];
  state.players[state.picking] = { char, score: 0, current: 0 };

  card.classList.add("selected", state.picking === 0 ? "p1" : "p2");
  card.setAttribute("data-player", state.picking === 0 ? "P1" : "P2");

  if (state.picking === 0) {
    state.selectedCatP1 = idx;
    if (state.gameMode === "online") {
      // Online: habilitar botón Jugar con solo P1
      updatePlayButton();
    } else {
      // Local: esperar P2
      state.picking = 1;
      $("#char-grid").classList.add("p2-turn");
      updateSelectHeader();
    }
  } else {
    // P2 elegido
    state.selectedCatP2 = idx;
    updateSelectHeader();
    updatePlayButton();
  }
}

/* ============================================
   RENDER — VERSUS SCREEN
   ============================================ */
/* There is no image src to set: the boil is CSS, selected by data-cat.
   Writing the attribute is the whole handoff from "who was picked" to
   "which 7 drawings cycle in that corner". */
function paintFighters() {
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (!p) continue;
    $(`#name-${i}`).textContent = p.char.name;
    $(`#fighter-${i} .fighter-art`).dataset.cat = p.char.id;
  }
}

function renderGameUI() {
  paintFighters();
  updateScores();
  updateActiveFighter();
  updateControls();
  $("#goal-num").textContent = state.goal;

  // Setup real-time sync for online mode
  if (state.gameMode === "online") {
    syncGameStateOnline();
  }
}

/* El rival elige su gato en su propia pantalla; hasta que la sala lo
   informa, de este lado se lo ve como el placeholder que puso startGame. */
function charFromCatId(catId) {
  return ROSTER.find((c) => c.id === catId) || null;
}

/* Una revancha vuelve a entrar a la pantalla de juego, y sin esto el poll
   anterior seguía vivo: dos sondeos escribiendo el mismo estado. */
let unwatchRoom = null;

/* Salir del versus tiene que apagar el sondeo. Al volver a selección los
   jugadores se ponen en null, y un poll huérfano seguía escribiendo
   puntajes sobre ellos cada dos segundos. */
function stopWatchingRoom() {
  if (!unwatchRoom) return;
  unwatchRoom();
  unwatchRoom = null;
}

function syncGameStateOnline() {
  const roomId = sessionStorage.getItem("roomId");
  if (!roomId) return;

  stopWatchingRoom();

  unwatchRoom = watchRoom(roomId, (room) => {
    if (!room) return;

    /* El objetivo lo fija el backend — el slider de ajustes no manda en
       online, y mostrar 100 mientras la sala corta en 50 es mentirle al
       jugador. */
    if (typeof room.goal === "number") {
      state.goal = room.goal;
      $("#goal-num").textContent = room.goal;
    }

    /* Cuál de los dos sos: la sala es la misma para ambos, lo único que
       distingue es el sessionId. */
    const mySession = getSessionId();
    if (room.player1.sessionId === mySession) state.mySide = 0;
    else if (room.player2 && room.player2.sessionId === mySession) state.mySide = 1;

    [room.player1, room.player2].forEach((side, i) => {
      const p = state.players[i];
      if (!side || !p) return;
      p.score = side.score;
      p.current = side.current;
      const char = charFromCatId(side.catId);
      if (char && p.char.id !== char.id) p.char = char;
    });

    state.active = room.turn === "player1" ? 0 : 1;

    paintFighters();
    updateScores();
    updateActiveFighter();
    updateControls();

    if (room.status === "finished" && !state.finished) {
      stopWatchingRoom();
      const p2Score = room.player2 ? room.player2.score : 0;
      winGame(room.player1.score >= p2Score ? 0 : 1);
    }
  });
}

function updateScores() {
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (!p) continue;
    $(`#score-${i}`).textContent = p.score;
    $(`#current-${i}`).textContent = p.current;
  }
}

function updateActiveFighter() {
  for (let i = 0; i < 2; i++) {
    $(`#fighter-${i}`).classList.toggle("active", i === state.active && state.playing);
  }
}

/* ============================================
   DICE
   ============================================ */
const DICE_ROTATIONS = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 0, y: 180 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 },
};

function setDiceFace(n) {
  const dice = $("#dice-3d");
  const rot = DICE_ROTATIONS[n];
  dice.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
}

/* The single source of truth for "a roll is in flight". The DOM `disabled`
   flag is a reflection of it, never the other way round — the keyboard
   bypasses button state entirely, so guarding on `disabled` guards nothing. */
function setRolling(rolling) {
  state.rolling = rolling;
  updateControls();
}

/* En local los dos comparten pantalla y el turno lo lleva el juego. En
   online cada uno maneja un solo lado. */
function isMyTurn() {
  return state.gameMode !== "online" || state.active === state.mySide;
}

function updateControls() {
  const blocked = state.rolling || !isMyTurn();
  $("#btn-roll").disabled = blocked;
  $("#btn-hold").disabled = blocked;
}

function rollDice() {
  if (!state.playing || state.rolling) return;
  /* El teclado no pasa por el botón, así que el disabled no alcanza: sin
     esto el backend respondía "Not your turn", que en producción Convex
     enmascara como "Server Error". */
  if (!isMyTurn()) return;

  if (state.gameMode === "online") {
    rollDiceOnline();
  } else {
    rollDiceLocal();
  }
}

async function rollDiceOnline() {
  try {
    const roomId = sessionStorage.getItem("roomId");

    setRolling(true);
    const result = await convexRollDice(roomId);

    animateDiceRoll(result.roll, result.isBust);
  } catch (error) {
    console.error("Error rolling dice online:", error);
    setRolling(false);
  }
}

function rollDiceLocal() {
  setRolling(true);

  const n = Math.trunc(Math.random() * 6) + 1;
  state.rollsTotal++;

  const dice = $("#dice-3d");
  dice.classList.remove("rolling");
  void dice.offsetWidth;
  dice.classList.add("rolling");

  setTimeout(() => {
    dice.classList.remove("rolling");
    setDiceFace(n);

    if (n === 1) {
      showSnakeEyes();
      const p = state.players[state.active];
      p.current = 0;
      setTimeout(() => {
        switchPlayer();
        setRolling(false);
      }, 900);
    } else {
      const p = state.players[state.active];
      p.current += n;
      updateScores();
      setRolling(false);
      if (p.score + p.current >= state.goal) holdScore();
    }
  }, 1150);
}

function animateDiceRoll(roll, isBust) {
  const dice = $("#dice-3d");
  dice.classList.remove("rolling");
  void dice.offsetWidth;
  dice.classList.add("rolling");

  setTimeout(() => {
    dice.classList.remove("rolling");
    setDiceFace(roll);

    if (isBust) {
      showSnakeEyes();
      setTimeout(() => {
        setRolling(false);
      }, 900);
    } else {
      setRolling(false);
    }
  }, 1150);
}

function showSnakeEyes() {
  const warn = $("#snake-warn");
  warn.classList.remove("show");
  void warn.offsetWidth;
  warn.classList.add("show");
}

function holdScore() {
  if (!state.playing || state.rolling) return;
  if (!isMyTurn()) return;

  if (state.gameMode === "online") {
    holdScoreOnline();
  } else {
    holdScoreLocal();
  }
}

async function holdScoreOnline() {
  try {
    const roomId = sessionStorage.getItem("roomId");

    setRolling(true);
    await convexHoldScore(roomId);
    setRolling(false);
  } catch (error) {
    console.error("Error holding score online:", error);
    setRolling(false);
  }
}

function holdScoreLocal() {
  const p = state.players[state.active];
  p.score += p.current;
  p.current = 0;
  updateScores();

  if (p.score >= state.goal) {
    winGame(state.active);
  } else {
    switchPlayer();
  }
}

function switchPlayer() {
  state.players[state.active].current = 0;
  state.active = state.active === 0 ? 1 : 0;
  updateScores();
  updateActiveFighter();
}

/* ============================================
   WIN / GAME OVER
   ============================================ */
function winGame(winnerIdx) {
  state.playing = false;
  state.finished = true;
  screens.game.classList.remove("in-play");
  const winner = $(`#fighter-${winnerIdx}`);
  const loser = $(`#fighter-${winnerIdx === 0 ? 1 : 0}`);
  winner.classList.add("winner");
  winner.classList.remove("active");
  loser.classList.add("loser");

  launchParticles();
  $("#btn-roll").disabled = true;
  $("#btn-hold").disabled = true;

  setTimeout(() => showGameOver(winnerIdx), 2400);
}

function showGameOver(winnerIdx) {
  const winner = state.players[winnerIdx];
  const loser = state.players[winnerIdx === 0 ? 1 : 0];

  $("#go-winner-img").src = winner.char.img;
  $("#go-winner-name").textContent = winner.char.name;
  $("#go-winner-score").textContent = winner.score;
  $("#go-winner-quote").textContent = `"${winner.char.quote}"`;

  $("#go-loser-img").src = loser.char.img;
  $("#go-loser-name").textContent = loser.char.name;
  $("#go-loser-score").textContent = loser.score;
  $("#go-loser-quote").textContent = `"${loser.char.loseQuote}"`;

  switchScreen("gameover");
  setTimeout(() => launchParticles(60), 200);
}

function launchParticles(count = 80) {
  if (!TWEAK_DEFAULS.particles) return;
  const layer = $("#particles");
  const colors = ["gold", "red", "bone"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = `particle ${colors[i % 3]}`;
    p.style.left = Math.random() * 100 + "%";
    p.style.top = -10 + "%";
    p.style.animationDelay = Math.random() * 1.5 + "s";
    p.style.animationDuration = 2 + Math.random() * 2 + "s";
    p.style.width = (0.6 + Math.random() * 1) + "rem";
    p.style.height = p.style.width;
    layer.appendChild(p);
    setTimeout(() => p.remove(), 5000);
  }
}

/* ============================================
   FLOW
   ============================================ */
/* Hash routing, not the History API. This ships as a static file opened
   straight from disk or from /projects/..., where pushState paths would
   404 on reload. "#/menu" survives both. */
const ROUTES = ["title", "menu", "room-choice", "select", "game", "gameover"];

function routeFromHash() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  return ROUTES.includes(raw) ? raw : "title";
}

/* A screen is only reachable if the state behind it exists. Anyone who
   pastes #/game before picking lands on the selection screen, and
   #/gameover before anyone has won lands on the versus, instead of on a
   podium for a round that never happened. */
function resolveRoute(name) {
  const picked = Boolean(state.players[0] && state.players[1]);
  if ((name === "game" || name === "gameover") && !picked) return "select";
  if (name === "gameover" && !state.finished) return "game";
  return name;
}

/* Renders. Never touches history. */
function applyScreen(name) {
  state.screen = name;
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle("active", k === name);
  });
  const table = $(".table");
  // artwork screens: pure black, no felt, no wood frame
  table.classList.toggle("on-title", name === "title" || name === "menu");
  // versus: the felt is a real object mid-screen, so the full-bleed one goes
  table.classList.toggle("on-versus", name === "game");
  closeRules();

  /* Fuera del versus no hay partida que sincronizar. renderGameUI lo vuelve
     a levantar al entrar. */
  if (name !== "game") stopWatchingRoom();

  // Reset select screen when entering
  if (name === "select") {
    state.picking = 0;
    state.players = [null, null];
    state.selectedCatP1 = null;
    state.selectedCatP2 = null;
    $$(".char-card").forEach((el) => el.classList.remove("selected", "p1", "p2"));
    $("#char-grid").classList.remove("p2-turn");
    $("#btn-play").disabled = true;
    renderCharGrid();
    updateSelectHeader();
  }
}

/* Navigates. The hashchange listener does the rendering, so a button click
   and the browser's back arrow travel exactly the same path — one flow,
   not two that drift apart. */
function switchScreen(name) {
  const target = resolveRoute(name);
  if (location.hash === `#/${target}`) {
    applyScreen(target);
    return;
  }
  location.hash = `#/${target}`;
}

window.addEventListener("hashchange", () => {
  const target = resolveRoute(routeFromHash());
  if (location.hash !== `#/${target}`) {
    // guard rewrote the destination — replace so back doesn't bounce
    location.replace(`#/${target}`);
    return;
  }
  applyScreen(target);
});

/* ============================================
   TITLE / MENU
   ============================================ */
function leaveTitle() {
  if (state.screen !== "title") return;
  // two clicks of head start for the boil frames
  warmRosterFrames();
  screens.title.classList.add("leaving");
  setTimeout(() => {
    screens.title.classList.remove("leaving");
    switchScreen("menu");
  }, 420);
}

function renderMenu() {
  const nav = $("#menu-options");
  nav.innerHTML = MENU_ITEMS.map((it) => `
    <button class="menu-option${it.ready ? "" : " locked"}"
            data-id="${it.id}"
            ${it.ready ? "" : 'disabled aria-disabled="true"'}>
      <span class="opt-label">${it.label}</span>
      ${it.ready
        ? (it.note ? `<span class="opt-note">${it.note}</span>` : "")
        : '<span class="opt-note locked-note">pronto</span>'}
    </button>
  `).join("");

  nav.querySelectorAll(".menu-option").forEach((el) => {
    const item = MENU_ITEMS.find((i) => i.id === el.dataset.id);
    if (!item?.ready) return;
    el.addEventListener("click", () => leaveMenu(item.route, item.mode || "local"));
  });
}

function leaveMenu(route = "select", mode = "local") {
  if (state.screen !== "menu") return;
  state.gameMode = mode;
  screens.menu.classList.add("leaving");
  setTimeout(() => {
    screens.menu.classList.remove("leaving");
    switchScreen(route);
  }, 420);
}

/* Opening a duel and taking a rematch are the same act — same two picks,
   scores back to zero — so they share one path. */
async function startGame() {
  state.active = 0;
  state.playing = true;
  state.finished = false;
  setRolling(false);
  state.rollsTotal = 0;

  // Ensure both players exist (in online, P2 is placeholder until joined)
  if (!state.players[1]) {
    state.players[1] = { char: { name: "...", id: "cat1" }, score: 0, current: 0 };
  }

  state.players.forEach((p) => {
    if (p) {
      p.score = 0;
      p.current = 0;
    }
  });

  // If online, update player character in room
  if (state.gameMode === "online") {
    try {
      const roomId = sessionStorage.getItem("roomId");
      /* El id sale del ROSTER, no de la posición: `cat${idx+1}` sólo
         funciona mientras el orden del array no cambie. */
      const pick = ROSTER[state.selectedCatP1];
      await updatePlayerCharacter(roomId, pick.name, pick.id);
    } catch (error) {
      console.error("Error updating character in room:", error);
    }
  }

  $$(".fighter").forEach((el) => el.classList.remove("winner", "loser", "active"));

  // Both online and local go directly to game
  switchScreen("game");
  screens.game.classList.add("in-play");
  renderGameUI();
  setDiceFace(1);
}

const newRound = startGame;

/* Drop both picks and go back to choosing. */
function fullReset() {
  screens.game.classList.remove("in-play");
  state.picking = 0;
  state.players = [null, null];
  state.active = 0;
  state.playing = false;
  state.finished = false;
  state.rolling = false;
  state.rollsTotal = 0;

  $$(".char-card").forEach((el) => {
    el.classList.remove("selected", "p1", "p2");
    el.removeAttribute("data-player");
  });
  $("#char-grid").classList.remove("p2-turn");
  $$(".fighter").forEach((el) => el.classList.remove("winner", "loser", "active"));

  updateSelectHeader();
  switchScreen("select");
}

/* ============================================
   INIT
   ============================================ */
function init() {
  renderCharGrid();
  renderMenu();
  updateSelectHeader();

  // honour a hash that is already in the URL (reload, bookmark, shared link)
  const initial = resolveRoute(routeFromHash());
  if (location.hash !== `#/${initial}`) location.replace(`#/${initial}`);
  applyScreen(initial);

  $("#btn-start").addEventListener("click", leaveTitle);
  screens.title.addEventListener("click", leaveTitle);

  $("#btn-menu-back").addEventListener("click", () => switchScreen("title"));
  $("#btn-room-back").addEventListener("click", () => switchScreen("menu"));
  $("#btn-select-back-top").addEventListener("click", () => switchScreen("menu"));
  $("#btn-play").addEventListener("click", startGame);
  $("#btn-create-room").addEventListener("click", handleCreateRoom);
  $("#btn-join-room").addEventListener("click", handleJoinRoom);
  $("#btn-cancel-wait").addEventListener("click", handleCancelWait);

  $("#btn-roll").addEventListener("click", rollDice);
  $("#btn-hold").addEventListener("click", holdScore);
  $("#btn-again").addEventListener("click", newRound);
  $("#btn-gameover-new").addEventListener("click", fullReset);

  /* The versus screen was stripped down to three things, and the top HUD —
     which held the only "Reglas" button — went with it. The modal, its
     styles and closeRules() are all still here and still work; what it no
     longer has is a way in. Wire openRules() to whatever entry point the
     new layout gets. */
  $("#btn-rules-close").addEventListener("click", closeRules);
  $("#rules-overlay").addEventListener("click", (e) => {
    if (e.target === $("#rules-overlay")) closeRules();
  });

  // keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeRules(); return; }
    if (state.screen === "title") { e.preventDefault(); leaveTitle(); return; }
    if (state.screen !== "game" || !state.playing) return;
    if (e.code === "Space") { e.preventDefault(); rollDice(); }
    if (e.key === "Enter") { e.preventDefault(); holdScore(); }
  });

  // apply tweaks
  applyTweaks();
  setupTweaks();
  // rules now open when the player leaves the title — see leaveTitle()
}

/* ============================================
   ONLINE DUELO
   ============================================ */
async function handleCreateRoom() {
  try {
    const roomId = await createOnlineRoom();

    // Mostrar código y esperar jugador 2
    $("#room-choice-content").style.display = "none";
    $("#room-waiting").style.display = "flex";
    $("#display-room-code").textContent = roomId;

    sessionStorage.setItem("roomId", roomId);
    sessionStorage.setItem("isCreator", "true");

    // Esperar al jugador 2
    const unsubscribe = watchRoom(roomId, (room) => {
      if (room && room.status === "playing") {
        unsubscribe();
        switchScreen("select");
      }
    });
  } catch (error) {
    console.error("Error creating room:", error);
    alert(`Error: ${error.message}`);
  }
}

async function handleJoinRoom() {
  try {
    const roomId = $("#room-code").value.toUpperCase().trim();
    if (!roomId) {
      alert("Pegá el código de la sala");
      return;
    }

    /* El gato se elige en la pantalla siguiente: acá todavía no hay nada
       que mandar, y leer ROSTER[null] reventaba el "Unirse". */
    await joinOnlineRoom(roomId);

    sessionStorage.setItem("roomId", roomId);
    switchScreen("select");
  } catch (error) {
    console.error("Error joining room:", error);
    alert(`Error: ${error.message}`);
  }
}

function handleCancelWait() {
  sessionStorage.removeItem("roomId");
  $("#room-choice-content").style.display = "flex";
  $("#room-waiting").style.display = "none";
  $("#room-code").value = "";
  switchScreen("menu");
}

/* ============================================
   RULES MODAL
   ============================================ */
function openRules() {
  $("#rules-overlay").classList.add("open");
}

function closeRules() {
  $("#rules-overlay").classList.remove("open");
}

/* ============================================
   TWEAKS
   ============================================ */
function applyTweaks() {
  const smoke = $(".smoke");
  if (smoke) smoke.style.opacity = TWEAK_DEFAULS.smokeOpacity;

  const scanlines = $(".scanlines");
  if (scanlines) scanlines.style.display = TWEAK_DEFAULS.scanlines ? "block" : "none";

  state.goal = TWEAK_DEFAULS.goalScore;
  const goalEl = $("#goal-num");
  if (goalEl) goalEl.textContent = state.goal;
}

function setupTweaks() {
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (d?.type === "__activate_edit_mode") $(".tweaks").classList.add("visible");
    if (d?.type === "__deactivate_edit_mode") $(".tweaks").classList.remove("visible");
  });

  const goalInput = $("#tweak-goal");
  const goalOut = $("#tweak-goal-val");
  goalInput.value = TWEAK_DEFAULS.goalScore;
  goalOut.textContent = TWEAK_DEFAULS.goalScore;
  goalInput.addEventListener("input", () => {
    const v = parseInt(goalInput.value, 10);
    TWEAK_DEFAULS.goalScore = v;
    state.goal = v;
    goalOut.textContent = v;
    const goalEl = $("#goal-num");
    if (goalEl) goalEl.textContent = v;
    postTweak({ goalScore: v });
  });

  const smokeInput = $("#tweak-smoke");
  const smokeOut = $("#tweak-smoke-val");
  smokeInput.value = TWEAK_DEFAULS.smokeOpacity;
  smokeOut.textContent = TWEAK_DEFAULS.smokeOpacity;
  smokeInput.addEventListener("input", () => {
    const v = parseFloat(smokeInput.value);
    TWEAK_DEFAULS.smokeOpacity = v;
    $(".smoke").style.opacity = v;
    smokeOut.textContent = v;
    postTweak({ smokeOpacity: v });
  });

  const btnScan = $("#tweak-scanlines");
  btnScan.classList.toggle("on", TWEAK_DEFAULS.scanlines);
  btnScan.addEventListener("click", () => {
    TWEAK_DEFAULS.scanlines = !TWEAK_DEFAULS.scanlines;
    $(".scanlines").style.display = TWEAK_DEFAULS.scanlines ? "block" : "none";
    btnScan.classList.toggle("on", TWEAK_DEFAULS.scanlines);
    postTweak({ scanlines: TWEAK_DEFAULS.scanlines });
  });

  const btnPart = $("#tweak-particles");
  btnPart.classList.toggle("on", TWEAK_DEFAULS.particles);
  btnPart.addEventListener("click", () => {
    TWEAK_DEFAULS.particles = !TWEAK_DEFAULS.particles;
    btnPart.classList.toggle("on", TWEAK_DEFAULS.particles);
    postTweak({ particles: TWEAK_DEFAULS.particles });
  });
}

function postTweak(edits) {
  try {
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
  } catch (e) {}
}

// announce edit-mode after listener is registered
window.addEventListener("load", () => {
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (e) {}
});

init();
