
"use strict";
import {
  createOnlineRoom,
  updatePlayerCharacter,
  joinOnlineRoom,
  leaveOnlineRoom,
  getRoom,
  watchRoom,
  convexPlayCard,
  convexRollDice,
  convexHoldScore,
  getSessionId,
} from './convex-client.js';

/* Las reglas viven bajo convex/ porque una función de Convex sólo puede
   importar de su propio directorio. Importarlas desde acá es lo que impide
   que el modo local y el online se separen. */
import {
  GOAL,
  BOARD,
  BOARD_SIZE,
  SQUARE,
  CARD,
  CARD_LABEL,
  HAND_LIMIT,
  CURSE_TURNS,
  squareAt,
  advance,
  startingHand,
  randomBonusCard,
  resolveRoll,
  applyPenalty,
  cappedScore,
  hasDefense,
  dropCard,
  dropFirstOfType,
} from '../convex/rules';
 
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
    name: "Bonifacio",
    dir: "cat1",
    frames: 9,
    img: "cat1/frame0000.webp",
    age: "7",
    cond: "Le debe plata a todos los gatos del barrio.",
    quote: "Te dije que tenía un sistema.",
    loseQuote: "Los dados están cargados. Lo sé.",
    tags: ["ANSIOSO", "SIN FILTRO"],
  },
  {
    id: "cat2",
    name: "Abilio",
    dir: "cat2",
    frames: 9,
    img: "cat2/frame0000.webp",
    age: "11",
    cond: "Dice que se retiró. Vuelve todas las noches.",
    quote: "Nunca dudé. Ni un segundo.",
    loseQuote: "Una más. Dale. Una más.",
    tags: ["VETERANO", "MENTIROSO"],
  },
  {
    id: "cat3",
    name: "Hermenegildo",
    dir: "cat3",
    frames: 10,
    img: "cat3/frame0000.webp",
    age: "5",
    cond: "Cree que esto es un juego. No entiende el dinero.",
    quote: "¡Esto es lo mejor que pasó en mi vida!",
    loseQuote: "Pero... ¿cuándo es mi turno de ganar?",
    tags: ["INGENUO", "PURO"],
  },
  {
    id: "cat4",
    name: "El Mago",
    dir: "cat4",
    frames: 10,
    img: "cat4/frame0000.webp",
    age: "??",
    cond: "Nadie sabe de dónde vino. Gana sin hablar.",
    quote: "...",
    loseQuote: "...",
    tags: ["MISTERIO", "SILENCIO"],
  },
];

/* The boil swaps background-image every 100ms; a frame that has not been
   decoded yet paints as a hole. */
let framesWarmed = false;
function warmRosterFrames() {
  if (framesWarmed) return;
  framesWarmed = true;
  ROSTER.forEach((c) => {
    for (let i = 0; i < c.frames; i++) {
      const img = new Image();
      /* Baja prioridad: son para dos pantallas más adelante y no deben
         competir con nada de lo que se está viendo. */
      img.fetchPriority = "low";
      img.src = `${c.dir}/frame${String(i).padStart(4, "0")}.webp`;
    }
  });
}

/* Los 38 dibujos de los gatos pesan casi un mega. Esperar al click dejaba
   la selección llena de agujeros mientras bajaban; arrancarlos antes los
   ponía a competir con el título. El evento `load` es justo el medio: el
   título ya está en pantalla y todavía faltan segundos hasta que el
   jugador decida entrar. */
if (document.readyState === "complete") {
  warmRosterFrames();
} else {
  window.addEventListener("load", warmRosterFrames, { once: true });
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
  "goalScore": 100,
  "smokeOpacity": 0.35,
  "scanlines": true,
  "particles": true,
  "uiShift": 0
}/*EDITMODE-END*/;

/* La animación del dado dura 0.7s, definida en .dice-3d.rolling. La cara se
   revela 50ms antes de que termine, para que el corte caiga todavía dentro
   del movimiento. Si cambia una duración hay que cambiar la otra: quedaron
   desfasadas cuando el CSS se acortó de 1.2s y el dado se quedaba quieto
   medio segundo antes de mostrar el número. */
const DICE_ROLL_MS = 650;

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

/* Un jugador arranca con su ficha en la salida y la mano que fija el
   reglamento: dos de robo y una de defensa. */
function newPlayer(char) {
  return {
    char,
    score: 0,
    current: 0,
    pos: 0,
    hand: startingHand(() => Math.random()),
    pendingCard: null,
    curseTurns: 0,
    doubleNext: false,
  };
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

    /* Cambiar de gato después de haber apretado Jugar cancela la espera:
       el botón volvía a decir "Esperando al rival" y quedaba muerto,
       porque el sondeo seguía apuntando al personaje anterior. */
    stopWatchingRoom();
    $("#btn-play").textContent = "Jugar";
  } else {
    // Local mode: limit to 2 selections max
    const selectedCount = $$(".char-card.selected").length;
    if (selectedCount >= 2) return;
  }

  const char = ROSTER[idx];
  state.players[state.picking] = newPlayer(char);

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
/* ============================================
   TABLERO
   ============================================ */
/* El camino es el perímetro de una grilla de 8×6, y ese tamaño no es
   arbitrario: el borde de una grilla de C columnas por F filas tiene
   2C + 2F − 4 celdas, y 8×6 da exactamente 24.

   Colocarlas así —en celdas y no en porcentajes sueltos— es lo que hace
   que las casillas se toquen entre sí como en un tablero de verdad. Con
   posiciones libres siempre quedaban puntos sueltos separados. */
const COLS = 8;
const ROWS = 6;

function squareCell(i) {
  const n = ((i % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  // Fila de arriba, de izquierda a derecha.
  if (n < COLS) return { col: n + 1, row: 1 };
  // Columna derecha, bajando (sin repetir las esquinas).
  if (n < COLS + (ROWS - 2)) return { col: COLS, row: n - COLS + 2 };
  // Fila de abajo, de derecha a izquierda.
  if (n < COLS * 2 + (ROWS - 2)) return { col: COLS - (n - COLS - (ROWS - 2)), row: ROWS };
  // Columna izquierda, subiendo. Cierra el círculo contra la celda 0.
  return { col: 1, row: ROWS - (n - COLS * 2 - (ROWS - 2)) - 1 };
}

/* Centro de la celda en porcentaje: las fichas van absolutas para poder
   deslizarse de una casilla a la otra, cosa que el grid no permite. */
function cellCenter(i) {
  const { col, row } = squareCell(i);
  return {
    x: ((col - 0.5) / COLS) * 100,
    y: ((row - 0.5) / ROWS) * 100,
  };
}

function renderBoard() {
  const track = $("#board-track");
  if (!track) return;

  const squares = BOARD.map((type, i) => {
    const { col, row } = squareCell(i);
    return `<span class="square ${type}" style="grid-column:${col};grid-row:${row}"></span>`;
  }).join("");

  track.innerHTML =
    squares +
    `<span class="token p1" id="token-0"></span>` +
    `<span class="token p2" id="token-1"></span>`;

  moveTokens();
}

function moveTokens() {
  for (let i = 0; i < 2; i++) {
    const el = $(`#token-${i}`);
    const p = state.players[i];
    if (!el || !p) continue;
    const { x, y } = cellCenter(p.pos ?? 0);
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
  }
}

/* ============================================
   CARTAS
   ============================================ */
function cardFace(c) {
  if (c.type === CARD.STEAL) {
    /* En negativo: lo que dice la carta es lo que le pasa al rival, y el
       signo lo deja claro sin tener que leer el rótulo. */
    return `<span class="card-kind">${CARD_LABEL.steal}</span><span class="card-value">-${c.value}</span>`;
  }
  const short = { defense: "🛡", curse: "☠", double: "⚄⚄" };
  return `<span class="card-value">${short[c.type]}</span><span class="card-kind">${CARD_LABEL[c.type]}</span>`;
}

function renderHand() {
  const row = $("#hand-row");
  if (!row) return;

  const me = state.players[state.gameMode === "online" ? state.mySide : state.active];
  const hand = me?.hand ?? [];

  /* La defensa se muestra pero no se puede soltar: se gasta sola cuando te
     atacan, y dejar que la jueguen sería tirarla. */
  row.innerHTML = hand
    .map((c) => {
      const playable = c.type !== CARD.DEFENSE && canPlayCards();
      return `<button class="card ${c.type}" data-uid="${c.uid}"
                ${playable ? "" : "disabled"}
                title="${CARD_LABEL[c.type]}${c.value ? " -" + c.value : ""}">
                ${cardFace(c)}
              </button>`;
    })
    .join("");

  row.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => playCardByUid(el.dataset.uid));
  });

  renderPlayedCard();
}

function canPlayCards() {
  if (!state.playing || state.rolling) return false;
  if (!isMyTurn()) return false;
  const me = state.players[state.gameMode === "online" ? state.mySide : state.active];
  return !me?.pendingCard;
}

/* La carta boca abajo sobre el fieltro. Se dibuja para los dos: el rival
   tiene que ver que hay algo esperándolo, aunque no sepa qué. */
function renderPlayedCard() {
  const felt = $(".pool-felt");
  if (!felt) return;

  const existing = $(".played-card");
  const anyPending = state.players.some((p) => p?.pendingCard);

  if (!anyPending) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;

  const el = document.createElement("div");
  el.className = "played-card";
  el.textContent = "?";
  el.title = "Carta jugada — se revela al plantarse";
  felt.appendChild(el);
}

function paintFighters() {
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (!p) continue;
    $(`#name-${i}`).textContent = p.char.name;
    $(`#fighter-${i} .fighter-art`).dataset.cat = p.char.id;
  }
}

/* En online el jugador tiene que verse siempre abajo. Como f1 es el de
   arriba, al que le tocó ser player1 se le dan vuelta las dos posiciones.
   En local no aplica: los dos miran la misma pantalla. */
function applySides() {
  const online = state.gameMode === "online";
  screens.game.classList.toggle("flip", online && state.mySide === 0);
}

function renderGameUI() {
  applySides();
  renderBoard();
  renderHand();
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

/* Soltar la sala al volver atrás. Va en un solo lugar y no en cada botón
   porque los caminos de salida son varios — cancelar la espera, volver
   desde selección, pedir otros jugadores — y el que se olvide de llamar
   acá es el que deja la sala colgada. */
function leaveCurrentRoom() {
  const roomId = sessionStorage.getItem("roomId");
  if (!roomId) return;
  sessionStorage.removeItem("roomId");
  state.wonByAbandon = false;
  // Sin await: la navegación no espera a la red. Si falla, limpia el cron.
  leaveOnlineRoom(roomId);
}

/* Última jugada ya reproducida de este lado. Sirve para no repetir la
   animación en cada sondeo y para no reproducir, al entrar, las tiradas
   que pasaron antes de que llegáramos. */
let lastSeenEventId = null;

function rivalRollFrom(room) {
  const ev = room.lastEvent;
  if (!ev) return null;

  const firstLook = lastSeenEventId === null;
  const isNew = ev._id !== lastSeenEventId;
  lastSeenEventId = ev._id;

  if (firstLook || !isNew) return null;
  if (ev.action !== "roll") return null;
  // La propia ya se animó al tirarla.
  if (ev.sessionId === getSessionId()) return null;

  return { roll: ev.payload.roll, isBust: Boolean(ev.payload.isBust) };
}

function syncGameStateOnline() {
  const roomId = sessionStorage.getItem("roomId");
  if (!roomId) return;

  stopWatchingRoom();
  lastSeenEventId = null;

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
    /* Sin condicionar a que haya cambiado: startGame renderiza antes del
       primer sondeo, con el mySide que quedó de la partida anterior. */
    applySides();

    const applyRoomState = () => {
      [room.player1, room.player2].forEach((side, i) => {
        const p = state.players[i];
        if (!side || !p) return;
        p.score = side.score;
        p.current = side.current;
        /* Tablero y cartas también los manda el servidor: es la única
           autoridad, y predecirlos de este lado sería adivinar el azar. */
        p.pos = side.pos ?? 0;
        p.hand = side.hand ?? [];
        p.pendingCard = side.pendingCard ?? null;
        p.curseTurns = side.curseTurns ?? 0;
        p.doubleNext = Boolean(side.doubleNext);
        const char = charFromCatId(side.catId);
        if (char && p.char.id !== char.id) p.char = char;
      });

      state.active = room.turn === "player1" ? 0 : 1;

      paintFighters();
      updateScores();
      updateActiveFighter();
      updateControls();
      moveTokens();
      renderHand();

      if (room.status === "finished" && !state.finished) {
        stopWatchingRoom();
        /* El ganador lo dice el backend. Deducirlo por puntaje se equivocaba
           justo en el abandono, donde el que se queda suele ir perdiendo. */
        const winnerIdx = room.winner === "player2" ? 1 : 0;
        state.wonByAbandon = Boolean(room.endedByAbandon);
        if (state.wonByAbandon) notify("Tu rival se levantó de la mesa");
        winGame(winnerIdx);
      }
    };

    /* Cuando tira el rival, su dado también rueda de este lado. El estado
       se aplica recién cuando frena: si se escribiera ahora, el puntaje
       subiría mientras el dado todavía está girando y contaría la jugada
       antes de mostrarla. */
    const rival = rivalRollFrom(room);
    if (!rival) {
      applyRoomState();
      return;
    }

    setRolling(true);
    animateDiceRoll(rival.roll, rival.isBust, applyRoomState);
  });
}

/* ---- contadores animados ----
   El puntaje sube de a saltos y cambiarlo de golpe lo vuelve invisible:
   justo el número que importa es el que nunca ves moverse. Estos dos mapas
   guardan, por elemento, a qué valor apunta y qué cuadro tiene pedido.
   El valor mostrado no es el del estado mientras la cuenta corre. */
const numberTarget = new Map();
const numberFrame = new Map();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function animateNumber(el, to) {
  const from = numberTarget.has(el) ? numberTarget.get(el) : to;
  numberTarget.set(el, to);

  // Una tirada nueva puede llegar con la anterior todavía contando.
  const pending = numberFrame.get(el);
  if (pending) cancelAnimationFrame(pending);

  if (from === to || reducedMotion.matches) {
    el.textContent = to;
    numberFrame.delete(el);
    return;
  }

  /* La duración sale de la distancia: sumar 3 no puede tardar lo mismo que
     sumar 40, o los saltos chicos se sienten pesados. */
  const dur = Math.min(140 + Math.abs(to - from) * 28, 620);
  const t0 = performance.now();

  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");

  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    // easeOutCubic: sale rápido y frena encima del número final
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased);

    if (p < 1) {
      numberFrame.set(el, requestAnimationFrame(step));
    } else {
      el.textContent = to;
      numberFrame.delete(el);
    }
  };

  numberFrame.set(el, requestAnimationFrame(step));
}

/* Al abrir una partida los marcadores vuelven a cero, y sin esto la
   primera lectura contaba hacia atrás desde el resultado de la anterior. */
function resetCounters() {
  numberFrame.forEach((id) => cancelAnimationFrame(id));
  numberFrame.clear();
  numberTarget.clear();
}

function updateScores() {
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (!p) continue;
    animateNumber($(`#score-${i}`), p.score);
    animateNumber($(`#current-${i}`), p.current);
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

    /* El puntaje se aplica cuando el dado frena, no cuando responde el
       servidor: si no, el número sube antes de que se vea la cara. */
    animateDiceRoll(result.roll, result.isBust, () => {
      const me = state.players[state.mySide];
      if (!me) return;
      me.current = result.isBust ? 0 : result.newCurrent;
      if (result.isBust) state.active = state.mySide === 0 ? 1 : 0;
      updateScores();
      updateActiveFighter();
    });
  } catch (error) {
    console.error("Error rolling dice online:", error);
    notify(errorText(error), "error");
    setRolling(false);
  }
}

/* ============================================
   JUGAR CARTAS
   ============================================ */
const rand = () => Math.random();

async function playCardByUid(uid) {
  if (!canPlayCards()) return;

  const side = state.gameMode === "online" ? state.mySide : state.active;
  const me = state.players[side];
  const card = me?.hand.find((c) => c.uid === uid);
  if (!card || card.type === CARD.DEFENSE) return;

  if (state.gameMode === "online") {
    try {
      await convexPlayCard(sessionStorage.getItem("roomId"), uid);
    } catch (error) {
      console.error("Error playing card:", error);
      notify(errorText(error), "error");
      return;
    }
    // El sondeo trae el estado real; esto es sólo para que responda ya.
    me.hand = dropCard(me.hand, uid);
    if (card.type === CARD.DOUBLE) me.doubleNext = true;
    else me.pendingCard = card;
    renderHand();
    return;
  }

  me.hand = dropCard(me.hand, uid);
  if (card.type === CARD.DOUBLE) {
    me.doubleNext = true;
    notify("Dos dados en tu próxima tirada");
  } else {
    me.pendingCard = card;
    notify("Carta sobre la mesa — se revela al plantarte");
  }
  renderHand();
}

/* Efecto de la casilla donde frenó la ficha. Mismo orden que el backend:
   la ficha avanza siempre, incluso quemándose. */
function applyLandingLocal(p, steps) {
  p.pos = advance(p.pos ?? 0, steps);
  const square = squareAt(p.pos);

  if (square === SQUARE.PENALTY) {
    p.score = applyPenalty(p.score);
    notify(`Penitencia — ${p.char.name} pierde 15`, "error");
  } else if (square === SQUARE.BONUS) {
    if ((p.hand?.length ?? 0) < HAND_LIMIT) {
      p.hand = [...(p.hand ?? []), randomBonusCard(rand, Date.now())];
      notify(`Bonus — carta nueva para ${p.char.name}`);
    } else {
      notify("Bonus, pero la mano está llena");
    }
  }
  moveTokens();
}

/* Revela la carta que estaba boca abajo y la resuelve. La defensa del
   rival se gasta sola: la regla es "si el rival no tiene defensa". */
function resolvePendingLocal(me, rival) {
  const card = me.pendingCard;
  if (!card || !rival) return;
  me.pendingCard = null;

  if (hasDefense(rival.hand ?? [])) {
    rival.hand = dropFirstOfType(rival.hand, CARD.DEFENSE);
    notify(`${rival.char.name} bloqueó la ${CARD_LABEL[card.type].toLowerCase()}`);
    return;
  }

  if (card.type === CARD.STEAL) {
    const taken = Math.min(card.value, rival.score);
    rival.score -= taken;
    me.score += taken;
    notify(`Robo de ${taken} a ${rival.char.name}`);
  } else if (card.type === CARD.CURSE) {
    rival.curseTurns = CURSE_TURNS;
    notify(`Maldición: ${rival.char.name} tira hasta 5 por ${CURSE_TURNS} turnos`);
  }
}

function rollDiceLocal() {
  setRolling(true);
  state.rollsTotal++;

  const p = state.players[state.active];
  const cursed = (p.curseTurns ?? 0) > 0;
  const outcome = resolveRoll(rand, cursed, Boolean(p.doubleNext));

  // Se consume tire lo que tire: la carta valía para esta tirada.
  p.doubleNext = false;
  p.curseTurns = Math.max(0, (p.curseTurns ?? 0) - 1);

  const dice = $("#dice-3d");
  dice.classList.remove("rolling");
  void dice.offsetWidth;
  dice.classList.add("rolling");

  setTimeout(() => {
    dice.classList.remove("rolling");
    /* Con dos dados el cubo muestra el mayor: son dos tiradas y una sola
       cara, así que el aviso del detalle va por el toast. */
    setDiceFace(Math.max(...outcome.dice));
    if (outcome.dice.length > 1) {
      notify(`Dos dados: ${outcome.dice.join(" y ")}`);
    }

    /* La ficha avanza aunque el turno se queme: el 1 te saca lo acumulado,
       no te devuelve al casillero anterior. */
    applyLandingLocal(p, outcome.isBust ? outcome.dice.length : outcome.gained);

    if (outcome.isBust) {
      showSnakeEyes();
      p.current = 0;
      updateScores();
      setTimeout(() => {
        switchPlayer();
        setRolling(false);
        renderHand();
      }, 900);
      return;
    }

    p.current += outcome.gained;
    updateScores();
    setRolling(false);
    renderHand();
    if (p.score + p.current >= state.goal) holdScore();
  }, DICE_ROLL_MS);
}

function animateDiceRoll(roll, isBust, onSettle) {
  const dice = $("#dice-3d");
  dice.classList.remove("rolling");
  void dice.offsetWidth;
  dice.classList.add("rolling");

  setTimeout(() => {
    dice.classList.remove("rolling");
    setDiceFace(roll);
    if (onSettle) onSettle();

    if (isBust) {
      showSnakeEyes();
      setTimeout(() => {
        setRolling(false);
      }, 900);
    } else {
      setRolling(false);
    }
  }, DICE_ROLL_MS);
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
    const result = await convexHoldScore(roomId);

    /* La mutation ya devuelve el resultado: aplicarlo acá en vez de
       esperar al sondeo. Con hasta 2s de espera, plantarse se sentía como
       que el botón no había respondido. */
    const me = state.players[state.mySide];
    if (me) {
      me.score = result.newScore;
      me.current = 0;
    }
    if (!result.gameFinished) state.active = state.mySide === 0 ? 1 : 0;

    updateScores();
    updateActiveFighter();
    setRolling(false);
  } catch (error) {
    console.error("Error holding score online:", error);
    notify(errorText(error), "error");
    setRolling(false);
  }
}

function holdScoreLocal() {
  const p = state.players[state.active];
  const rival = state.players[state.active === 0 ? 1 : 0];

  p.score += p.current;
  p.current = 0;

  /* Se revela acá, antes de contar: robar 22 puede ser justo lo que cierra
     la partida. */
  resolvePendingLocal(p, rival);

  const won = p.score >= state.goal;
  /* Al ganar el marcador queda clavado en el objetivo: el sobrante de la
     última tirada no es puntaje. */
  p.score = cappedScore(p.score);

  updateScores();
  renderHand();

  if (won) {
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

  /* Los retratos son boils, no imágenes: el dibujo lo elige el CSS por
     data-cat, igual que en la selección y en el versus. */
  $("#go-winner-img").dataset.cat = winner.char.id;
  $("#go-winner-img").setAttribute("aria-label", winner.char.name);
  $("#go-winner-name").textContent = winner.char.name;
  $("#go-winner-score").textContent = winner.score;
  $("#go-winner-quote").textContent = `"${winner.char.quote}"`;

  $("#go-loser-img").dataset.cat = loser.char.id;
  $("#go-loser-img").setAttribute("aria-label", loser.char.name);
  $("#go-loser-name").textContent = loser.char.name;
  $("#go-loser-score").textContent = loser.score;
  $("#go-loser-quote").textContent = state.wonByAbandon
    ? '"me borré."'
    : `"${loser.char.loseQuote}"`;

  /* Una revancha online necesita que los dos acepten y que la sala se
     reinicie; la de acá reusa los picks locales y contra una sala
     terminada el backend rechaza cada tirada. */
  $("#btn-again").style.display = state.gameMode === "online" ? "none" : "";
  $("#btn-gameover-new").textContent =
    state.gameMode === "online" ? "× Volver al menú" : "× Otros jugadores";

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

  /* Menú y título son los dos destinos donde ya no estás en ninguna sala.
     Selección y versus no cuentan: ahí seguís adentro. */
  if (name === "menu" || name === "title") leaveCurrentRoom();

  // Reset select screen when entering
  if (name === "select") {
    state.picking = 0;
    state.players = [null, null];
    state.selectedCatP1 = null;
    state.selectedCatP2 = null;
    $$(".char-card").forEach((el) => el.classList.remove("selected", "p1", "p2"));
    $("#char-grid").classList.remove("p2-turn");
    const play = $("#btn-play");
    play.disabled = true;
    // Puede venir de un intento anterior que quedó esperando al rival.
    play.textContent = "Jugar";
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
/* En online la mesa no se muestra hasta que los dos eligieron. Sin esto el
   primero en apretar Jugar entraba al versus contra un placeholder, con el
   dado ya a la vista, mientras el rival seguía en la selección. */
async function handlePlay() {
  if (state.gameMode !== "online") {
    startGame();
    return;
  }

  const btn = $("#btn-play");
  const roomId = sessionStorage.getItem("roomId");
  const pick = ROSTER[state.selectedCatP1];

  btn.disabled = true;
  btn.textContent = "Esperando al rival…";

  try {
    /* El id sale del ROSTER, no de la posición: `cat${idx+1}` sólo
       funciona mientras el orden del array no cambie. */
    await updatePlayerCharacter(roomId, pick.name, pick.id);
  } catch (error) {
    console.error("Error updating character in room:", error);
    notify(errorText(error), "error");
    btn.disabled = false;
    btn.textContent = "Jugar";
    return;
  }

  stopWatchingRoom();
  unwatchRoom = watchRoom(roomId, (room) => {
    if (!room) return;
    // Se fue de la pantalla mientras esperaba.
    if (state.screen !== "select") return stopWatchingRoom();

    const p1 = room.player1;
    const p2 = room.player2;
    if (!p1?.catId || !p2?.catId) return;

    stopWatchingRoom();

    /* Los dos personajes ya se conocen: se arma el par acá y el versus
       abre con el gato del rival puesto, sin el parpadeo de dos segundos
       que tardaría el primer sondeo en corregirlo. */
    state.mySide = p1.sessionId === getSessionId() ? 0 : 1;
    /* La mano y la ficha las reparte el backend al crear la sala: acá se
       copian, no se generan, o cada lado vería cartas distintas. */
    state.players[0] = { ...newPlayer(charFromCatId(p1.catId)), hand: p1.hand ?? [], pos: p1.pos ?? 0 };
    state.players[1] = { ...newPlayer(charFromCatId(p2.catId)), hand: p2.hand ?? [], pos: p2.pos ?? 0 };

    btn.textContent = "Jugar";
    startGame();
  });
}

function startGame() {
  state.active = 0;
  state.playing = true;
  state.finished = false;
  setRolling(false);
  state.rollsTotal = 0;
  resetCounters();

  state.players.forEach((p) => {
    if (p) {
      p.score = 0;
      p.current = 0;
    }
  });

  $$(".fighter").forEach((el) => el.classList.remove("winner", "loser", "active"));

  switchScreen("game");
  screens.game.classList.add("in-play");
  renderGameUI();
  /* No el 1: esa cara es quemarse, y arrancar mostrándola parecía una
     tirada perdida antes de que nadie hubiera tocado el dado. */
  setDiceFace(6);
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
  /* En online la sala murió con la partida: volver a elegir personaje sin
     sala nueva deja la pantalla de selección sin nada detrás. */
  switchScreen(state.gameMode === "online" ? "menu" : "select");
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
  $("#btn-play").addEventListener("click", handlePlay);
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
        notify("Tu rival entró — elegí tu gato");
        switchScreen("select");
      }
    });
  } catch (error) {
    console.error("Error creating room:", error);
    notify(errorText(error), "error");
  }
}

async function handleJoinRoom() {
  try {
    const roomId = $("#room-code").value.toUpperCase().trim();
    if (!roomId) {
      notify("Pegá el código de la sala", "error");
      return;
    }

    /* El gato se elige en la pantalla siguiente: acá todavía no hay nada
       que mandar, y leer ROSTER[null] reventaba el "Unirse". */
    await joinOnlineRoom(roomId);

    sessionStorage.setItem("roomId", roomId);
    switchScreen("select");
  } catch (error) {
    console.error("Error joining room:", error);
    notify(errorText(error), "error");
  }
}

function handleCancelWait() {
  /* El roomId NO se borra acá: switchScreen("menu") dispara
     leaveCurrentRoom, que lo necesita para avisarle al backend. */
  $("#room-choice-content").style.display = "flex";
  $("#room-waiting").style.display = "none";
  $("#room-code").value = "";
  switchScreen("menu");
}

/* ============================================
   AVISOS
   ============================================ */
/* El alert() del navegador frena la ejecución con una caja gris del
   sistema: rompe la escena y, en online, congela el sondeo de la sala
   mientras esté abierto. */
function notify(message, kind = "info") {
  const layer = $("#toast-layer");
  if (!layer) return;

  const el = document.createElement("div");
  el.className = kind === "error" ? "toast error" : "toast";
  el.textContent = message;
  layer.appendChild(el);

  setTimeout(() => {
    el.classList.add("leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    // Si las animaciones están desactivadas el evento no llega nunca.
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

/* Los errores de Convex vienen como ConvexError con el texto en `data`;
   el resto trae `message`. Sin esto el jugador leía "[object Object]". */
function errorText(error) {
  const raw = error?.data ?? error?.message ?? "Algo salió mal";
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const known = {
    "Room not found": "Esa sala no existe",
    "Room full or finished": "La sala ya está llena o terminó",
    "Game not active": "La partida ya terminó",
    "Not your turn": "No es tu turno",
    "You are not in this room": "Ya no estás en esta sala",
  };
  return known[text] || text;
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
/* Sube o baja peleadores, puntajes y controles sin mover la mesa. En rem,
   así acompaña la escala tipográfica de cada breakpoint. */
function applyUiShift() {
  screens.game.style.setProperty("--ui-shift", `${TWEAK_DEFAULS.uiShift}rem`);
}

function applyTweaks() {
  applyUiShift();
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

  const shiftInput = $("#tweak-shift");
  const shiftOut = $("#tweak-shift-val");
  shiftInput.value = TWEAK_DEFAULS.uiShift;
  shiftOut.textContent = TWEAK_DEFAULS.uiShift;
  shiftInput.addEventListener("input", () => {
    const v = parseFloat(shiftInput.value);
    TWEAK_DEFAULS.uiShift = v;
    shiftOut.textContent = v;
    applyUiShift();
    postTweak({ uiShift: v });
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
