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

/* Un turno gana +7,7 puntos en promedio. A 15 y con seis casillas de
   penitencia el castigo superaba a la ganancia —neto −3,9 por turno— y el
   marcador nunca llegaba a 100 por progresión: sólo se ganaba por rachas o
   robando. Con 5 puntos y tres casillas el neto queda cómodamente
   positivo. */
export const PENALTY_POINTS = 6;

/* Con la maldición encima el dado del rival no pasa de 4: le saca los dos
   mejores resultados sin quitarle el riesgo del 1. Baja de 5 a 4 porque a 5
   la maldición se sentía un impuesto y no un castigo —perdías el 6 y poco
   más—; a 4 el turno maldito rinde un tercio menos y recién ahí vale la
   pena gastar una carta en ponerla. */
export const CURSED_MAX_ROLL = 4;
export const CURSE_TURNS = 3;

export const HAND_LIMIT = 5;

export const CARD = {
  STEAL: "steal",
  DEFENSE: "defense",
  CURSE: "curse",
  DOUBLE: "double",
  /* El golpe. Saca poco —tres puntos— pero es la carta que ROMPE defensas:
     contra un rival escudado, robar o maldecir es tirar la carta a la
     basura, porque la defensa se gasta igual tape lo que tape. El golpe
     existe para gastársela barato y dejar la siguiente sin tapa. */
  PUNCH: "punch",
} as const;

export type CardType = (typeof CARD)[keyof typeof CARD];

export type Card = {
  /* Identifica a la carta dentro de la mano. Sin esto, jugar "una de robo
     de 8" cuando tenés dos es ambiguo. */
  uid: string;
  type: CardType;
  value?: number;
};

/* Lo que el robo le saca al rival y le suma a quien la juega. Con el
   objetivo en 100, tres valores chicos hacen que la carta sea un empujón y
   no una partida ganada de una. */
export const STEAL_VALUES = [5, 10, 15];

/* El robo grande sale mucho más seguido que los otros dos: la carta tiene
   que sentirse una amenaza real, y con reparto parejo dos de cada tres
   veces salía la versión floja. */
const STEAL_WEIGHTS: Array<[number, number]> = [
  [15, 70],
  [10, 20],
  [5, 10],
];

export function randomStealValue(rand: () => number): number {
  const total = STEAL_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let tick = rand() * total;
  for (const [value, weight] of STEAL_WEIGHTS) {
    tick -= weight;
    if (tick < 0) return value;
  }
  return STEAL_WEIGHTS[0][0];
}

/* Lo que saca el golpe. Chico a propósito: su valor no está en el daño sino
   en que obliga al rival a gastar la defensa. Si sacara tanto como un robo
   no habría motivo para jugar ninguna otra carta. */
export const PUNCH_POINTS = 3;

export const CARD_LABEL: Record<CardType, string> = {
  steal: "ROBAR",
  defense: "DEFENSA",
  curse: "MALDICIÓN",
  double: "DOS DADOS",
  punch: "GOLPE",
};

/* Qué hace la carta, en una línea.
 *
 * Vive acá y no en el componente que la muestra porque los números que
 * cita —cuánto roba, cuántos turnos dura la maldición, hasta dónde limita
 * el dado— son las constantes de arriba. Escrito en la pantalla, el día
 * que se toque el balance el texto seguiría diciendo lo viejo, y una
 * explicación que miente es peor que no tener ninguna.
 *
 * En una línea a propósito: se lee mientras se mantiene la carta apretada,
 * con el pulgar encima y en medio del turno. Lo largo va en las reglas. */
export function cardHint(card: Card): string {
  switch (card.type) {
    case CARD.STEAL:
      return `Le saca ${card.value} puntos al rival y te los suma`;
    case CARD.DEFENSE:
      return "Se gasta sola cuando te atacan y anula el golpe";
    case CARD.CURSE:
      return `${CURSE_TURNS} turnos: el dado del rival no pasa de ${CURSED_MAX_ROLL}`;
    case CARD.DOUBLE:
      return "Tiras con dos dados y se suman los dos";
    case CARD.PUNCH:
      return `Le saca ${PUNCH_POINTS} puntos al rival, o le quema la defensa`;
    default:
      return "";
  }
}

/* ============================================
   TABLERO
   ============================================ */

export const SQUARE = {
  PLAIN: "plain",
  PENALTY: "penalty",
  BONUS: "bonus",
} as const;

export type SquareType = (typeof SQUARE)[keyof typeof SQUARE];

/* El camino es el borde de una grilla de 12×10: 2·12 + 2·10 − 4 = 40 casillas.
   Estas tres constantes son la única definición del tamaño — el cliente
   dibuja la grilla con COLS y ROWS, y BOARD_SIZE sale de las dos. Tocar
   una sola descuadra el tablero.

   Al pasar de 11 a 12 columnas hay que acompañar dos cosas del CSS que no
   se recalculan solas: la proporción de `.pool-table` y el `--board-cols`
   de `.pool-felt`, que es de donde se ubican el mazo y las cartas puestas.

   El camino es circular, así que no hay meta: se gana por puntos y las
   casillas son lo que le pasa a tu ficha en el camino. */
export const BOARD_COLS = 12;
export const BOARD_ROWS = 10;
export const BOARD_SIZE = 2 * BOARD_COLS + 2 * BOARD_ROWS - 4;

/* Sobre 40 casillas. Con seis penitencias sobre treinta se pisaba alguna
   casi una vez por turno y el recorrido era más castigo que camino; con
   tres quedaba inofensivo. Un bonus de más que penitencias inclina el
   tablero apenas a favor del que avanza.

   Los dos números suben con el camino —de 3 y 4 sobre 30 a 4 y 5 sobre
   40— para mantener la MISMA densidad. Dejándolos fijos, agrandar la mesa
   habría sido además un cambio de balance: las especiales se pisarían un
   cuarto menos seguido sin que nadie lo hubiera pedido. */
export const PENALTY_COUNT = 4;
/* Un bonus más: seis sobre cuarenta. Las cartas ahora se gastan mucho más
   rápido —el golpe existe para quemarse contra una defensa— así que el
   tablero tiene que reponerlas al mismo ritmo o la mano se seca. */
export const BONUS_COUNT = 6;

/* La salida. Es de donde arrancan las fichas y por dónde vuelven a pasar en
   cada vuelta, así que se dibuja a cuadros de bandera y NO puede llevar
   encima ninguna casilla especial: son dos fondos peleando por el mismo
   lugar, y el que gana es el que la hoja de estilos declare último. Con una
   penitencia en la salida el damero desaparecía y quedaba un cuadrado rojo
   donde tendría que estar la referencia del recorrido. */
export const START_SQUARE = 0;

/* El tablero se sortea por partida, así que deja de ser constante: pasa a
   ser estado de la sala. Si cada lado lo generara por su cuenta verían
   casillas distintas en el mismo lugar. */
export function makeBoard(rand: () => number): SquareType[] {
  const board: SquareType[] = new Array(BOARD_SIZE).fill(SQUARE.PLAIN);

  /* Un lugar donde se puede poner algo. Dos condiciones:
     · la salida queda libre siempre —ver START_SQUARE—;
     · dos especiales pegadas hacen que una tirada de 6 se sienta
       arbitraria: caés en penitencia y la casilla de al lado también te
       castiga. */
  const libre = (i: number) => i !== START_SQUARE && board[i] === SQUARE.PLAIN;

  const isolated = (i: number) => {
    const prev = (i - 1 + BOARD_SIZE) % BOARD_SIZE;
    const next = (i + 1) % BOARD_SIZE;
    return libre(i) && board[prev] === SQUARE.PLAIN && board[next] === SQUARE.PLAIN;
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
    /* Si la separación no alcanzó, se completa pegado antes que dejar el
       tablero con menos casillas de las que corresponde. Arranca en 1 y
       vuelve a preguntar por `libre`: este era el camino por el que se
       colaba una especial en la salida —el azar de arriba la evitaba, pero
       el relleno recorría el tablero desde el índice 0 y la primera
       casilla vacía que encontraba era justamente esa—. */
    for (let i = 1; placed < count && i < BOARD_SIZE; i++) {
      if (libre(i)) {
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

/* Mano inicial fija: un robo chico, una defensa y una maldición. Que sea
   siempre la misma iguala el arranque —nadie empieza con mejor mano— y
   pone las tres mecánicas en juego desde el primer turno. Los robos
   grandes hay que salir a buscarlos a las casillas de bonus. */
export function startingHand(): Card[] {
  return [
    makeCard(CARD.STEAL, STEAL_VALUES[0], 0),
    makeCard(CARD.DEFENSE, undefined, 1),
    makeCard(CARD.CURSE, undefined, 2),
  ];
}

/* Lo que entrega una casilla de bonus.
 *
 * El reparto ES la mecánica, no un ajuste de balance. El juego que se busca
 * es: el rival se escuda, vos le gastás la defensa a golpes, y recién con la
 * guardia baja entra el robo o la maldición. Para que esa secuencia ocurra
 * de verdad hacen falta las dos mitades a la vez —golpes Y escudos—, y por
 * eso son las dos más probables y salen empatadas: si los escudos escasearan
 * no habría nada que quemar, y si escasearan los golpes no habría con qué.
 *
 *   golpe 28% · defensa 28% · robo 22% · maldición 12% · dos dados 10%
 *
 * El robo baja de 35 a 22 y sigue siendo la carta que decide partidas: lo
 * que cambió es que ahora hay que ABRIRSE PASO hasta poder usarlo, en vez de
 * que caiga solo. Dos dados baja a 10 porque es la única que no participa de
 * ese intercambio — no ataca ni defiende, así que es la que sobra. */
export function randomBonusCard(rand: () => number, seed: number): Card {
  const roll = rand();
  if (roll < 0.28) return makeCard(CARD.PUNCH, undefined, seed);
  if (roll < 0.56) return makeCard(CARD.DEFENSE, undefined, seed);
  if (roll < 0.78) return makeCard(CARD.STEAL, randomStealValue(rand), seed);
  if (roll < 0.9) return makeCard(CARD.CURSE, undefined, seed);
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

/* El golpe tampoco puede dejar el marcador en negativo. Va acá y no escrito
   en los dos lugares que resuelven cartas —el motor local y el servidor—
   porque dos restas iguales copiadas se desincronizan calladas. */
export function applyPunch(score: number): number {
  return Math.max(0, score - PUNCH_POINTS);
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
