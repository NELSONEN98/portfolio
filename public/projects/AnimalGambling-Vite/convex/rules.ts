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
/* Dos turnos y no tres. La maldición ahora hace DOS cosas a la vez —capa el
   dado y convierte los bonus del maldito en casillas que le cortan el
   turno—, así que a tres turnos decidía la partida sola. Se acorta la
   condena en lugar de ablandarla: es preferible un castigo que se sienta y
   pase a uno tibio que dure. */
export const CURSE_TURNS = 2;

/* ►► Dos bolsillos, no uno. ◄◄
 *
 * `HAND_LIMIT` cuenta SÓLO las cartas que se juegan. Las defensas van
 * aparte, con su propio tope, y la razón no es de balance sino del bucle
 * que sostiene el juego: se junta munición de golpes, se dumpea toda en un
 * turno para tirar abajo la muralla de escudos, y recién entonces entra el
 * robo. Ese plan necesita poder ACUMULAR golpes.
 *
 * Con un solo bolsillo era imposible. La defensa no se juega —se gasta sola
 * cuando te atacan—, así que si el rival no ataca se queda ocupando lugar
 * para siempre. Medido sobre 3000 partidas: el 52% de las casillas de bonus
 * no entregaba NADA porque la mano estaba tapada de escudos que nadie podía
 * sacar. Subir la probabilidad del escudo empeoraba el acceso al golpe: los
 * dos síntomas eran el mismo problema.
 *
 * El tope de los escudos existe por lo contrario: sin él, el que no recibe
 * ataques apila una muralla infinita y no hay dumpeo que la rompa. Con tres,
 * cuatro golpes guardados siempre alcanzan — y cuatro entran en la mano. */
export const HAND_LIMIT = 5;
export const DEFENSE_LIMIT = 3;

export const CARD = {
  STEAL: "steal",
  DEFENSE: "defense",
  CURSE: "curse",
  DOUBLE: "double",
  /* ►► El golpe: la única carta que la defensa NO tapa. ◄◄
   *
   * Vuelve, pero con otra regla. La primera versión sacaba 3 puntos sin
   * transferir y el escudo la frenaba como a cualquier otra — o sea que
   * hacía lo mismo que un robo chico pero sin darte los puntos: una carta
   * estrictamente peor que otra, que nadie tenía motivo para jugar.
   *
   * Ahora no se bloquea: ROMPE el escudo. Si el rival no tiene ninguno,
   * pega flojo. Eso la vuelve una herramienta con un uso propio —abrir la
   * guardia— en vez de una versión aguada del robo, y hace explícito el
   * bucle: golpe para romper, robo para cobrar. */
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

/* Lo que el robo le saca al de tu derecha y te suma a vos.
 *
 * Dos denominaciones y nada más: 3 y 6.
 *
 * El 3 es munición: sale barato, y contra un rival escudado su trabajo no
 * es sacar puntos sino GASTARLE LA DEFENSA —que se consume igual tape lo
 * que tape—. El 6 es el que cobra de verdad, y sólo entra con la guardia ya
 * abierta. Ese es el bucle entero del juego, dicho con una sola carta. */
export const STEAL_VALUES = [3, 6];

/* Y acá el peso se DA VUELTA respecto de antes.
   Con los valores viejos el grande salía el 70%: la carta tenía que
   sentirse una amenaza y el reparto parejo la volvía floja. Ahora el que
   tiene que abundar es el CHICO, porque es el que se gasta de a varios para
   abrir la guardia. Si el de 6 fuera el común, cada rompimiento de muralla
   costaría media partida en puntos regalados a las defensas. */
const STEAL_WEIGHTS: Array<[number, number]> = [
  [3, 70],
  [6, 30],
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

/* Lo que saca el golpe cuando NO encuentra escudo que romper. Flojo a
   propósito: su valor está en abrir la guardia, no en el daño. Si pegara
   como un robo, romper dejaría de ser el motivo para jugarla. */
export const PUNCH_POINTS = 2;

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
      return `Le saca ${card.value} puntos al de tu derecha y te los suma`;
    case CARD.DEFENSE:
      return "Se gasta sola cuando te atacan y anula una carta entera";
    case CARD.CURSE:
      return `${CURSE_TURNS} turnos: su dado no pasa de ${CURSED_MAX_ROLL} y sus bonus le cortan el turno`;
    case CARD.DOUBLE:
      return "Tiras con dos dados y se suman los dos";
    case CARD.PUNCH:
      return `La defensa no lo tapa: le rompe un escudo, o le saca ${PUNCH_POINTS} si no tiene`;
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
  /* La casilla que le corta el turno al maldito.
   *
   * ►► No existe en ningún tablero guardado. ◄◄
   * `makeBoard` no la sortea nunca: aparece SÓLO como resultado de mirar un
   * bonus con la maldición encima (ver `squareFor`). Esa es la propiedad que
   * hace que todo esto funcione — el tablero es uno solo y compartido, y la
   * maldición la sufre uno solo, así que la conversión no puede guardarse en
   * el dato o se la estaríamos aplicando también al que la lanzó. */
  TURN_LOSS: "turnloss",
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
/* Una de cada una más: cinco penitencias y siete bonus sobre cuarenta.
   Suben las dos juntas y no sólo los premios: el bonus reparte las cartas
   que mueven la partida, y sin más castigo del otro lado el camino se
   volvería un pasillo de regalos donde avanzar no tiene ningún riesgo. */
export const PENALTY_COUNT = 5;
export const BONUS_COUNT = 7;

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

/* Qué es esa casilla PARA ESTE JUGADOR, ahora.
 *
 * Es la única función que hay que llamar para resolver o para dibujar una
 * casilla; `squareAt` queda debajo, diciendo qué hay guardado en el dato.
 * La diferencia entre las dos es todo el mecanismo de la maldición.
 *
 * Con la maldición encima, los bonus dejan de ser premios: el maldito pisa
 * lo que para el otro es una carta y se le termina el turno. Y como es una
 * transformación de LECTURA y no de estado:
 *   · el tablero guardado nunca cambia, así que las salas online abiertas
 *     antes de esto siguen siendo válidas y no hay nada que migrar;
 *   · no hay que acordarse de deshacerla cuando la condena vence — se
 *     deshace sola al llegar `cursed` en falso;
 *   · y sobre todo, el rival sigue viendo sus bonus como bonus, que es
 *     imposible si se toca el array compartido. */
export function squareFor(
  board: SquareType[] | undefined,
  pos: number,
  cursed: boolean
): SquareType {
  const casilla = squareAt(board, pos);
  if (cursed && casilla === SQUARE.BONUS) return SQUARE.TURN_LOSS;
  return casilla;
}

export function advance(pos: number, steps: number): number {
  return (pos + steps) % BOARD_SIZE;
}

/* ============================================
   LA MESA: QUIÉN LE PEGA A QUIÉN
   ============================================ */

/* Cuántos entran en la mesa. Dos es el mínimo para que haya partida; cuatro
   es el techo, y no por capricho: cada jugador de más multiplica la espera
   entre tus turnos, y con cinco ya son cuatro turnos ajenos mirando. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/* A quién le toca después. Los jugadores están sentados en círculo y el
   turno gira siempre en el mismo sentido. */
export function nextSeat(seat: number, total: number): number {
  return (seat + 1) % total;
}

/* ►► A quién apuntan TUS cartas: al de tu derecha. Siempre. ◄◄
 *
 * El ataque es DIRECCIONAL y no elegible, y esa decisión vale mucho más de
 * lo que cuesta:
 *
 *  · No hace falta elegir objetivo. Cero interfaz de selección, cero
 *    decisión extra por carta.
 *  · Mata el apaleo del líder. Con objetivo libre, pegarle al que va
 *    ganando es la jugada correcta para TODOS los demás a la vez: el
 *    puntero no se puede despegar nunca, la partida se aplana y termina
 *    ganando el que estaba segundo cuando alguien por fin rompe. Con
 *    dirección fija, cada uno tiene exactamente un atacante y una víctima.
 *  · Le devuelve el valor a la defensa. Un escudo tapa una carta; contra
 *    tres atacantes vale un tercio, contra uno vale lo que siempre valió.
 *
 * Con dos jugadores devuelve al otro, así que hoy no cambia nada de lo que
 * ya funciona. Esa es justamente la idea: reemplaza al `active === 0 ? 1 : 0`
 * que estaba escrito a mano en los dos motores —la suposición de que la mesa
 * es de dos— por algo que ya vale para cuatro. */
export function targetOf(seat: number, total: number): number {
  return nextSeat(seat, total);
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
 *   golpe 35% · defensa 35% · robo 17% · dos dados 9% · maldición 4%
 *
 * Golpe y defensa son SETENTA POR CIENTO del mazo, y salen empatados. Esa
 * igualdad es la mecánica: el golpe rompe escudos uno a uno, así que si la
 * defensa saliera más seguido la muralla se repondría más rápido de lo que
 * se puede tirar abajo y nunca caería; si saliera menos, el escudo dejaría
 * de significar algo. Empatados, romper la guardia es trabajo pero es
 * posible — que es exactamente el juego que se busca.
 *
 * El robo baja a 17% y esa escasez es el punto: es el premio de haber
 * abierto la guardia, no el recurso con el que se pelea. Cuando salía la
 * mitad del mazo no hacía falta romper nada, alcanzaba con insistir.
 *
 * La maldición, 4%: una de cada veinticinco. Capa el dado Y le convierte los
 * bonus en trampas al que la recibe. Una carta que cambia el tablero entero
 * no puede salir seguido, o el juego pasa a ser sobre ella. Sale poco, y por
 * eso cuando sale duele.
 *
 * Dos dados sube apenas, a 9: es la única que no participa del intercambio
 * —no ataca ni defiende— y con el robo tan raro conviene que haya alguna
 * otra forma de empujar el marcador. */
export function randomBonusCard(rand: () => number, seed: number): Card {
  const roll = rand();
  if (roll < 0.35) return makeCard(CARD.PUNCH, undefined, seed);
  if (roll < 0.7) return makeCard(CARD.DEFENSE, undefined, seed);
  if (roll < 0.87) return makeCard(CARD.STEAL, randomStealValue(rand), seed);
  if (roll < 0.96) return makeCard(CARD.DOUBLE, undefined, seed);
  return makeCard(CARD.CURSE, undefined, seed);
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

export function applyPunch(score: number): number {
  return Math.max(0, score - PUNCH_POINTS);
}

export function hasDefense(hand: Card[]): boolean {
  return hand.some((c) => c.type === CARD.DEFENSE);
}

/* ►► Qué le hace una carta puesta a quien la recibe. ◄◄
 *
 * Vive acá, en las reglas, y no repetida en el motor local y en el servidor.
 * Antes cada uno tenía su propia cadena de `else if` y había que acordarse
 * de tocar las dos: la carta de golpe de la primera versión llegó a estar en
 * una y no en la otra, y el modo local y el online jugaban distinto sin que
 * nada se quejara.
 *
 * Devuelve el estado nuevo del rival y qué pasó, para que la pantalla lo
 * cuente. No toca al que la juega —eso lo resuelve quien llama, porque el
 * robo transfiere y las demás no— ni emite eventos: es una función pura. */
export function applyCard(
  card: Card,
  rival: { score: number; hand: Card[]; curseTurns: number }
): {
  score: number;
  hand: Card[];
  curseTurns: number;
  /* La tapó un escudo y no pasó nada. El golpe nunca sale bloqueado. */
  blocked: boolean;
  /* El golpe encontró escudo y lo rompió. */
  broke: boolean;
  /* Cuánto le sacó, para que el robo sepa cuánto sumarse. */
  taken: number;
} {
  const base = { score: rival.score, hand: rival.hand, curseTurns: rival.curseTurns };

  /* El golpe se resuelve ANTES de preguntar por la defensa, y es el único.
     Preguntarle primero al escudo sería tratarlo como a las demás, y su
     regla es justamente que el escudo no lo para. */
  if (card.type === CARD.PUNCH) {
    if (hasDefense(rival.hand)) {
      return {
        ...base,
        hand: dropFirstOfType(rival.hand, CARD.DEFENSE),
        blocked: false,
        broke: true,
        taken: 0,
      };
    }
    return { ...base, score: applyPunch(rival.score), blocked: false, broke: false, taken: 0 };
  }

  /* El resto sí: cada defensa tapa una sola carta, así que contra tres
     ataques una defensa frena el primero y los otros dos entran. Esa es la
     razón de poder acumular cartas puestas. */
  if (hasDefense(rival.hand)) {
    return {
      ...base,
      hand: dropFirstOfType(rival.hand, CARD.DEFENSE),
      blocked: true,
      broke: false,
      taken: 0,
    };
  }

  if (card.type === CARD.STEAL) {
    /* El tope se recalcula carta por carta: dos robos seguidos no pueden
       sacar más de lo que el rival tenía. */
    const taken = Math.min(card.value ?? 0, rival.score);
    return { ...base, score: rival.score - taken, blocked: false, broke: false, taken };
  }

  if (card.type === CARD.CURSE) {
    return { ...base, curseTurns: CURSE_TURNS, blocked: false, broke: false, taken: 0 };
  }

  return { ...base, blocked: false, broke: false, taken: 0 };
}

export function countDefense(hand: Card[]): number {
  return hand.filter((c) => c.type === CARD.DEFENSE).length;
}

/* Cuántas cartas jugables se están ocupando. Las que ya están boca abajo
   sobre la mesa cuentan: pueden volver a la mano al quemarse, y sin contarlas
   la mano terminaría con una de más. */
export function countPlayable(hand: Card[], pendingCards: Card[] = []): number {
  return hand.filter((c) => c.type !== CARD.DEFENSE).length + pendingCards.length;
}

/* Si esta carta entra. Cada bolsillo mira su propio tope, así que una mano
   llena de golpes no impide recibir un escudo ni al revés.
   Vive acá y no en los dos motores para que el cliente y el servidor no
   puedan discrepar sobre si una carta entró o se perdió. */
export function hasRoomFor(
  card: Card,
  hand: Card[],
  pendingCards: Card[] = []
): boolean {
  return card.type === CARD.DEFENSE
    ? countDefense(hand) < DEFENSE_LIMIT
    : countPlayable(hand, pendingCards) < HAND_LIMIT;
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
