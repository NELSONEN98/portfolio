/* Reglas del juego, en un solo lugar.
 *
 * Vive bajo convex/ porque una función de Convex sólo puede importar desde
 * su propio directorio, pero el cliente también lo importa: Vite compila
 * este TypeScript sin problema. Así el modo local y el online no pueden
 * divergir — un ajuste de balance se hace una vez y vale para los dos.
 *
 * Todo acá es puro: sin acceso a base, sin DOM, sin azar salvo donde se
 * declara. Eso hace que el backend pueda validar exactamente lo mismo que
 * el cliente predice.
 */

export const GOAL = 100;

/* Un 1 quema el turno. Es la regla original y sigue siendo la que sostiene
   toda la tensión del juego. */
export const BUST = 1;

export const PENALTY_POINTS = 15;

/* Con la maldición encima el dado del rival no pasa de 5: le saca el mejor
   resultado sin quitarle el riesgo del 1. */
export const CURSED_MAX_ROLL = 5;
export const CURSE_TURNS = 3;

export const HAND_LIMIT = 5;

export const CARD = {
  STEAL: "steal",
  DEFENSE: "defense",
  CURSE: "curse",
  DOUBLE: "double",
} as const;

export type CardType = (typeof CARD)[keyof typeof CARD];

export type Card = {
  /* Identifica a la carta dentro de la mano. Sin esto, jugar "una de robo
     de 8" cuando tenés dos es ambiguo. */
  uid: string;
  type: CardType;
  value?: number;
};

export const STEAL_VALUES = [8, 15, 22];

export const CARD_LABEL: Record<CardType, string> = {
  steal: "ROBO",
  defense: "DEFENSA",
  curse: "MALDICIÓN",
  double: "DOS DADOS",
};

/* ============================================
   TABLERO
   ============================================ */

export const SQUARE = {
  PLAIN: "plain",
  PENALTY: "penalty",
  BONUS: "bonus",
} as const;

export type SquareType = (typeof SQUARE)[keyof typeof SQUARE];

/* El camino es el borde de una grilla de 9×8: 2·9 + 2·8 − 4 = 30 casillas.
   Estas tres constantes son la única definición del tamaño — el cliente
   dibuja la grilla con COLS y ROWS, y BOARD_SIZE sale de las dos. Tocar
   una sola descuadra el tablero.

   El camino es circular, así que no hay meta: se gana por puntos y las
   casillas son lo que le pasa a tu ficha en el camino. */
export const BOARD_COLS = 9;
export const BOARD_ROWS = 8;
export const BOARD_SIZE = 2 * BOARD_COLS + 2 * BOARD_ROWS - 4;

export const PENALTY_COUNT = 6;
export const BONUS_COUNT = 6;

/* El tablero se sortea por partida, así que deja de ser constante: pasa a
   ser estado de la sala. Si cada lado lo generara por su cuenta verían
   casillas distintas en el mismo lugar. */
export function makeBoard(rand: () => number): SquareType[] {
  const board: SquareType[] = new Array(BOARD_SIZE).fill(SQUARE.PLAIN);

  /* Dos especiales pegadas hacen que una tirada de 6 se sienta arbitraria:
     caés en penitencia y la casilla de al lado también te castiga. */
  const isolated = (i: number) => {
    const prev = (i - 1 + BOARD_SIZE) % BOARD_SIZE;
    const next = (i + 1) % BOARD_SIZE;
    return (
      board[i] === SQUARE.PLAIN &&
      board[prev] === SQUARE.PLAIN &&
      board[next] === SQUARE.PLAIN
    );
  };

  const place = (type: SquareType, count: number) => {
    let placed = 0;
    /* Tope de intentos: al final quedan pocos huecos aislados y buscarlos
       al azar puede no encontrarlos nunca. */
    for (let guard = 0; placed < count && guard < 600; guard++) {
      const i = Math.floor(rand() * BOARD_SIZE);
      if (!isolated(i)) continue;
      board[i] = type;
      placed++;
    }
    // Si la separación no alcanzó, se completa pegado antes que dejar el
    // tablero con menos casillas de las que corresponde.
    for (let i = 0; placed < count && i < BOARD_SIZE; i++) {
      if (board[i] === SQUARE.PLAIN) {
        board[i] = type;
        placed++;
      }
    }
  };

  place(SQUARE.PENALTY, PENALTY_COUNT);
  place(SQUARE.BONUS, BONUS_COUNT);
  return board;
}

/* Tolera un tablero ausente —salas creadas antes de que se sorteara— y
   cualquier posición, negativa o mayor que la vuelta. */
export function squareAt(board: SquareType[] | undefined, pos: number): SquareType {
  if (!board || board.length === 0) return SQUARE.PLAIN;
  return board[((pos % board.length) + board.length) % board.length];
}

export function advance(pos: number, steps: number): number {
  return (pos + steps) % BOARD_SIZE;
}

/* ============================================
   CARTAS
   ============================================ */

/* El uid no necesita ser único en el mundo, sólo dentro de una mano. */
export function makeCard(type: CardType, value: number | undefined, seed: number): Card {
  return value === undefined
    ? { uid: `${type}-${seed}`, type }
    : { uid: `${type}${value}-${seed}`, type, value };
}

/* Mano inicial: dos de robo y una de defensa, como pidió el diseño. Los
   valores de robo salen al azar de los tres posibles. */
export function startingHand(rand: () => number): Card[] {
  const steals = [0, 1].map((i) => {
    const v = STEAL_VALUES[Math.floor(rand() * STEAL_VALUES.length)];
    return makeCard(CARD.STEAL, v, i);
  });
  return [...steals, makeCard(CARD.DEFENSE, undefined, 2)];
}

/* Lo que entrega una casilla de bonus. El robo pesa más que el resto
   porque es la carta que mueve el marcador; la defensa aparece seguido
   para que atacar no sea siempre gratis. */
export function randomBonusCard(rand: () => number, seed: number): Card {
  const roll = rand();
  if (roll < 0.4) {
    const v = STEAL_VALUES[Math.floor(rand() * STEAL_VALUES.length)];
    return makeCard(CARD.STEAL, v, seed);
  }
  if (roll < 0.7) return makeCard(CARD.DEFENSE, undefined, seed);
  if (roll < 0.88) return makeCard(CARD.CURSE, undefined, seed);
  return makeCard(CARD.DOUBLE, undefined, seed);
}

/* ============================================
   TIRADA
   ============================================ */

export function rollOnce(rand: () => number, cursed: boolean): number {
  const faces = cursed ? CURSED_MAX_ROLL : 6;
  return Math.floor(rand() * faces) + 1;
}

export type RollOutcome = {
  dice: number[];
  /* Cuánto suma al acumulado del turno. Los dados en 1 no cuentan. */
  gained: number;
  /* El turno se quema: con un dado, sacar 1; con dos, sacar 1 en ambos. */
  isBust: boolean;
};

/* Con dos dados, un 1 anula sólo ese dado y el otro sigue valiendo. Los dos
   en 1 queman el turno igual que siempre. */
export function resolveRoll(rand: () => number, cursed: boolean, double: boolean): RollOutcome {
  const dice = double
    ? [rollOnce(rand, cursed), rollOnce(rand, cursed)]
    : [rollOnce(rand, cursed)];

  const alive = dice.filter((d) => d !== BUST);
  const isBust = alive.length === 0;
  const gained = isBust ? 0 : alive.reduce((a, b) => a + b, 0);

  return { dice, gained, isBust };
}

/* ============================================
   EFECTOS
   ============================================ */

export type PlayerLike = {
  score: number;
  current: number;
  pos: number;
  hand: Card[];
  curseTurns: number;
};

/* El puntaje nunca baja de cero: una penitencia con 4 puntos encima deja
   en 0, no en -11. */
export function applyPenalty(score: number): number {
  return Math.max(0, score - PENALTY_POINTS);
}

/* Al ganar el marcador queda clavado en el objetivo: el sobrante de la
   última tirada no es puntaje. */
export function cappedScore(raw: number): number {
  return Math.min(raw, GOAL);
}

export function hasDefense(hand: Card[]): boolean {
  return hand.some((c) => c.type === CARD.DEFENSE);
}

export function dropCard(hand: Card[], uid: string): Card[] {
  const i = hand.findIndex((c) => c.uid === uid);
  if (i === -1) return hand;
  return [...hand.slice(0, i), ...hand.slice(i + 1)];
}

export function dropFirstOfType(hand: Card[], type: CardType): Card[] {
  const i = hand.findIndex((c) => c.type === type);
  if (i === -1) return hand;
  return [...hand.slice(0, i), ...hand.slice(i + 1)];
}
