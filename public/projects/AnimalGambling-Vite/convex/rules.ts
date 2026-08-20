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

/* Lo que cobra el bonus convertido por la maldición.
 *
 * Va SEPARADO de `PENALTY_POINTS` y no atado a él, aunque el efecto sea el
 * mismo. La casilla roja es un accidente del camino y está sorteada para
 * que aparezca cinco veces; el bonus convertido son SIETE casillas más que
 * se le vuelven en contra al maldito de golpe. Cobrando lo mismo, la
 * condena pasaba a valer casi el veinte por ciento del objetivo — medido:
 * 19.2 puntos sobre 100— y la convertía en la carta más cara del mazo por
 * lejos, con un 4% de probabilidad de salir.
 *
 * Es la mitad de la penitencia a propósito: el maldito ya paga el dado
 * capado, que le quema el turno una de cada cuatro tiradas en vez de una de
 * cada seis. Este número es el castigo EXTRA, no el castigo entero. */
export const CURSED_BONUS_POINTS = 3;

/* Lo que se cobra por dar una vuelta entera al tablero.
 *
 * ►► Este número parece chico y NO lo es. ◄◄
 *
 * El comentario que estaba acá decía que una vuelta son "once turnos
 * largos", y de ahí salía que tres puntos eran un premio menor a la
 * constancia. La cuenta estaba mal por un factor de tres: 40 casillas sobre
 * 3.5 de promedio son once TIRADAS, no once turnos, y un turno son casi
 * cuatro tiradas. Una vuelta cae cada tres turnos y medio.
 *
 * Medido sobre partidas completas —dado real, tablero real, plantándose a
 * los 20— salen 3.7 vueltas por partida: once puntos sobre un objetivo de
 * cien. El once por ciento del marcador entra por el camino.
 *
 * Subirlo hace dos cosas y las dos son malas. Acorta la partida, y sobre
 * todo le pasa el peso de la decisión al reloj: a diez puntos la vuelta,
 * casi el treinta por ciento del marcador sale de caminar, o sea de nada
 * que el jugador haya elegido. Plantarse o seguir es el juego; todo lo que
 * se paga por avanzar solo le come terreno a esa decisión.
 *
 * Hay un efecto de borde que conviene conocer antes de tocar nada: la ficha
 * camina en TODA tirada, incluida la que te quema, y la vuelta se cobra en
 * la fase de movimiento —ver `passedStart` y su uso—. O sea que quemarse
 * igual te acerca al bonus. Es el único premio consuelo del juego, y sube
 * junto con este número. */
export const LAP_BONUS = 3;

/* Con la maldición encima el dado del rival no pasa de 4: le saca los dos
   mejores resultados sin quitarle el riesgo del 1. Baja de 5 a 4 porque a 5
   la maldición se sentía un impuesto y no un castigo —perdías el 6 y poco
   más—; a 4 el turno maldito rinde un tercio menos y recién ahí vale la
   pena gastar una carta en ponerla. */
export const CURSED_MAX_ROLL = 4;
/* Dos turnos y no tres. La maldición hace DOS cosas a la vez —capa el dado
   y convierte los bonus del maldito en penitencias—, así que a tres turnos
   decidía la partida sola. Se acorta la condena en lugar de ablandarla: es
   preferible un castigo que se sienta y pase a uno tibio que dure. */
export const CURSE_TURNS = 2;

/* La cerveza dura lo mismo que la maldición, y no es pereza: las dos son
   condenas que se cuentan en turnos, y que duren distinto obligaría al
   jugador a llevar dos relojes en la cabeza para dos castigos que se ven
   parecido desde afuera. */
export const BEER_TURNS = 2;

/* Las cervezas se APILAN: la segunda no alarga la condena, la empeora. Dos
   cartas, el doble de borroso.
   El tope existe porque sin él la cuarta cerveza deja la mesa en blanco, y
   una carta que directamente impide jugar no es un castigo: es sacar al
   otro de la partida. A tres ya cuesta muchísimo, y cuesta tres cartas. */
export const BEER_MAX_STACKS = 3;

/* Una cerveza más encima. Refresca la condena y sube la borrosidad un
   escalón. La llaman los dos motores en el momento de JUGAR la carta, no al
   resolverla: la cerveza se aplica sobre el que la pone.
   Vive acá y no repetida en cada motor por lo de siempre: dos copias de una
   regla son dos reglas que se van a desincronizar. */
export function addBeer(beer: { beerTurns: number; beerStacks: number }) {
  return {
    beerTurns: BEER_TURNS,
    beerStacks: Math.min(beer.beerStacks + 1, BEER_MAX_STACKS),
  };
}

/* Un turno menos de cerveza. Cuando se agota, la borrosidad se va con ella:
   si `beerStacks` sobreviviera al contador, la próxima cerveza arrancaría
   con la intensidad acumulada de la anterior y nadie entendería por qué. */
export function tickBeer(beer: { beerTurns: number; beerStacks: number }) {
  const beerTurns = Math.max(0, beer.beerTurns - 1);
  return { beerTurns, beerStacks: beerTurns === 0 ? 0 : beer.beerStacks };
}

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
  /* El golpe: le saca puntos al rival sin transferirlos.
   *
   * La defensa lo tapa como a cualquier otra carta. Tuvo un período en que
   * no se bloqueaba y rompía el escudo —esa era su razón de existir, abrir
   * la guardia para que entrara el robo— y se le sacó a pedido.
   *
   * ►► Queda una deuda de balance abierta. ◄◄
   * Bloqueable y sin transferir, el golpe de −2 hace menos que un robo de
   * −3, que además te suma a vos y cuesta lo mismo jugar. O sea que hoy no
   * hay ninguna situación en la que convenga poner un golpe teniendo un
   * robo en la mano. Se arregla subiendo PUNCH_POINTS por encima del robo
   * chico, o devolviéndole algún efecto propio. */
  PUNCH: "punch",
  /* ►► La cerveza: te la tomás VOS. ◄◄
   *
   * No es un ataque: es la única carta que se aplica sobre el que la juega.
   * Nubla TU mesa por unos turnos — no toca puntos, no toca el dado, no
   * toca al rival. Lo único que se pierde es información propia.
   *
   * Por eso no va boca abajo con las demás: se resuelve en el momento de
   * jugarla, igual que los dos dados. No hay nada que revelar al plantarse
   * cuando el efecto no viaja a ningún lado, y una defensa enfrente no
   * tiene nada que tapar. */
  BEER: "beer",
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

/* Lo que saca el golpe. Este 2 se eligió cuando el golpe no se bloqueaba y
   su trabajo era romper escudos, no hacer daño — flojo a propósito.
   Ahora que la defensa lo tapa, el número quedó sin la regla que lo
   justificaba: ver la deuda anotada en CARD.PUNCH. */
export const PUNCH_POINTS = 2;

export const CARD_LABEL: Record<CardType, string> = {
  steal: "ROBAR",
  defense: "DEFENSA",
  curse: "MALDICIÓN",
  double: "DOS DADOS",
  punch: "GOLPE",
  beer: "CERVEZA",
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
      return `${CURSE_TURNS} turnos: su dado no pasa de ${CURSED_MAX_ROLL} y sus bonus le cobran ${CURSED_BONUS_POINTS}`;
    case CARD.DOUBLE:
      return "Tiras con dos dados y se suman los dos";
    case CARD.PUNCH:
      return `Le saca ${PUNCH_POINTS} puntos y no te los suma a vos`;
    case CARD.BEER:
      return `Te la tomás vos: ${BEER_TURNS} turnos con TU mesa borrosa, y se apilan`;
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
  /* ►► Ya no la produce nadie. ◄◄
   *
   * Era lo que devolvía `squareFor` al mirar un bonus con la maldición
   * encima: le cortaba el turno al maldito. Ahora esa conversión devuelve
   * `PENALTY` —le cobra puntos— y este tipo dejó de aparecer.
   *
   * Se conserva declarado porque el cliente y el servidor todavía saben
   * responderle, y borrarlo obliga a tocar los dos a la vez para ganar
   * nada. Si en algún momento se quiere una casilla que corte el turno de
   * verdad, el tipo ya está y sólo hay que sortearla en `makeBoard`. */
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
  /* ►► El bonus del maldito COBRA, no corta. ◄◄
   *
   * Antes devolvía `TURN_LOSS` y el bonus le terminaba el turno. El castigo
   * existía, pero era invisible en el marcador: el jugador se plantaba con
   * lo que tenía y ningún número decía lo que le había costado. Y el precio
   * real dependía de cuánto llevara acumulado —caer con 2 no dolía nada,
   * caer con 25 arruinaba la partida—, así que la misma casilla castigaba
   * distinto según un dato que no se ve.
   *
   * Devolviendo `PENALTY` el castigo no depende de lo acumulado y ya lo
   * cuenta todo lo que existe: descuenta, emite el hecho de penitencia,
   * tiñe al peleador de rojo y saca el −N al lado del marcador. No hizo
   * falta una rama nueva en ningún lado — la maldición pasa a hablar el
   * idioma que el tablero ya hablaba.
   *
   * CUÁNTO cobra es otra pregunta y la contesta `penaltyFor`: el bonus
   * convertido sale más barato que una casilla roja de verdad. Acá se
   * decide QUÉ es la casilla, no cuánto vale. */
  if (cursed && casilla === SQUARE.BONUS) return SQUARE.PENALTY;
  return casilla;
}

export function advance(pos: number, steps: number): number {
  return (pos + steps) % BOARD_SIZE;
}

/* Si este movimiento cruza la meta.
 *
 * Se pregunta ANTES de aplicar `advance`, porque después del módulo la
 * información se perdió: una ficha en la casilla 3 pudo llegar ahí desde la
 * 1 o dando la vuelta entera desde la 38, y el resultado es el mismo número.
 *
 * `>=` y no `>`: caer justo en la casilla 0 es completar la vuelta, no
 * quedarse a un paso. Y arrancar la partida parado en la meta no cuenta —
 * eso es `steps > 0`, no un caso especial. */
export function passedStart(pos: number, steps: number): boolean {
  return steps > 0 && pos + steps >= BOARD_SIZE;
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
/* Cuántas cartas se reparten al empezar. Sale como constante porque la
   pantalla la necesita para saber cuántas cartas animar en la apertura, y
   contarlas llamando a `startingHand` significaba repartir una mano de
   verdad —con su azar— sólo para medirla. */
export const STARTING_CARDS = 3;

/* Los tipos que pueden entrar a una mano, en el orden en que se usan de
   respaldo. Sin la cerveza, que no ocupa lugar en el abanico. */
const REPARTIBLES: CardType[] = [CARD.PUNCH, CARD.DEFENSE, CARD.STEAL, CARD.DOUBLE, CARD.CURSE];

/* La mano de arranque, sorteada.
 *
 * Era fija —un robo, una defensa y una maldición— y eso hacía que las
 * primeras jugadas de toda partida fueran las mismas. Ahora sale del MISMO
 * reparto que las casillas de bonus, así que el balance de las cartas se
 * ajusta en un solo lugar y la apertura lo hereda.
 *
 * ►► Dos reglas encima del sorteo, y ninguna es de gusto. ◄◄
 *
 * La cerveza no puede tocar una mano: se toma al recibirla y no ocupa
 * lugar, así que repartida al principio dejaría al jugador borracho antes
 * de la primera tirada — un castigo que nadie se ganó.
 *
 * Y no se repite el tipo de carta. Sortear tres veces del mazo de bonus da
 * un azar impecable y una apertura que se siente siempre igual: con golpe y
 * defensa al 35% cada uno, el 43% de las partidas arrancaba con una mano de
 * puro golpe/defensa, y una de cada cinco era exactamente
 * defensa+defensa+golpe. Aleatorio y variado no son lo mismo. Tres tipos
 * distintos ponen tres mecánicas sobre la mesa desde el primer turno, que es
 * lo que la apertura tiene que enseñar.
 *
 * Esta regla también reemplaza a la vieja de "al menos una carta jugable":
 * con una sola defensa por mano, la mano de tres defensas —que no se podía
 * jugar, porque la defensa se gasta sola cuando te atacan— dejó de existir.
 *
 * Los intentos van con tope. Un `while` sin techo a merced de una función
 * de azar ajena es un cuelgue esperando; si se agota, se fuerza un tipo que
 * falte y la partida sigue.
 */
export function startingHand(rand: () => number): Card[] {
  const mano: Card[] = [];
  const repetido = new Set<CardType>();

  /* El sorteo sigue saliendo de `randomBonusCard`: el balance de las cartas
     se toca en un solo lugar y la apertura lo hereda. Acá sólo se descarta
     lo que no puede entrar. */
  const sacar = (semilla: number): Card | null => {
    for (let intento = 0; intento < 40; intento++) {
      const carta = randomBonusCard(rand, semilla);
      if (carta.type === CARD.BEER) continue;
      if (repetido.has(carta.type)) continue;
      return carta;
    }
    return null;
  };

  /* El peor caso real deja libres robo, dos dados y maldición —un 21% del
     mazo—, así que agotar los cuarenta intentos es una rareza de una en
     dieciséis mil. Igual tiene salida: se toma el primer tipo que falte. */
  const forzar = (semilla: number): Card => {
    const tipo = REPARTIBLES.find((t) => !repetido.has(t)) ?? CARD.PUNCH;
    return tipo === CARD.STEAL
      ? makeCard(CARD.STEAL, randomStealValue(rand), semilla)
      : makeCard(tipo, undefined, semilla);
  };

  for (let i = 0; i < STARTING_CARDS; i++) {
    const carta = sacar(i) ?? forzar(i);
    repetido.add(carta.type);
    mano.push(carta);
  }

  return mano;
}

/* La misma mano, para otro asiento.
 *
 * ►► Por qué el reparto es ESPEJADO. ◄◄
 *
 * La mano de arranque es el único azar del juego que llega antes de la
 * primera decisión. Los dados los enfrentan los dos por igual y hay que
 * elegir cuándo plantarse; la carta del bonus depende de en qué casilla
 * caíste, o sea de hasta dónde empujaste la tirada. Eso es varianza que el
 * jugador se ganó. La mano inicial no: nadie tiró, nadie eligió.
 *
 * Y no era poca. Medida en puntos duros —lo que efectivamente mueve el
 * marcador— una mano de arranque vale entre 0 y 14 sobre un objetivo de
 * 100, y sorteando por separado el 58% de las partidas empezaba con una
 * brecha de 6 puntos o más. Un 14% del objetivo regalado antes del primer
 * dado, y encima invisible, porque las manos están ocultas: el que la
 * recibía ni se enteraba.
 *
 * Sorteando UNA mano y copiándola se conservan las dos cosas que importan:
 * cada partida abre distinto —que es lo que se ganó al dejar la mano fija—
 * y adentro de la partida nadie arranca arriba.
 *
 * Los uid se vuelven a estampar por asiento. Las cartas son las mismas, la
 * identidad no: hoy ninguna lista mezcla cartas de dos jugadores, pero
 * `uid` es la clave con la que se juega y se levanta una carta, y dos
 * jugadores con `punch-0` en la mano es una colisión esperando la primera
 * pantalla que los junte.
 */
export function mirrorHand(mano: Card[], asiento: number): Card[] {
  return mano.map((c, i) => makeCard(c.type, c.value, asiento * STARTING_CARDS + i));
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
/* ►► El golpe y la defensa NO se tocan. ◄◄
 *
 * Están al 35% cada uno. El empate venía de cuando el golpe rompía escudos
 * de a uno: si la defensa salía más seguido, la muralla se reponía más
 * rápido de lo que se podía tirar abajo. Con el golpe ya bloqueable esa
 * cuenta dejó de aplicar y el 35/35 quedó sin fundamento — se mantiene
 * porque cambiarlo es una decisión de balance aparte, no un arrastre de
 * este cambio.
 *
 * Toda carta nueva le saca probabilidad a alguien. La cerveza se la saca al
 * robo (17 → 14) y a los dos dados (9 → 7), que son los que tienen margen.
 * La maldición queda en su 4%, que ya estaba puesto ahí a mano.
 *
 * La cerveza no toca el marcador, así que puede abundar sin desbalancear
 * nada: sube a 9%. Sale de robar y de dos dados, que es de donde puede
 * salir. Robar baja a 12 y es el precio real de esto — es la carta que
 * cobra, y cada punto que se le saca acá se le saca al remate del bucle.
 *
 *   GOLPE 35 · DEFENSA 35 · ROBAR 12 · CERVEZA 9 · DOS DADOS 5 · MALDICIÓN 4
 */
export function randomBonusCard(rand: () => number, seed: number): Card {
  const roll = rand();
  if (roll < 0.35) return makeCard(CARD.PUNCH, undefined, seed);
  if (roll < 0.7) return makeCard(CARD.DEFENSE, undefined, seed);
  if (roll < 0.82) return makeCard(CARD.STEAL, randomStealValue(rand), seed);
  if (roll < 0.87) return makeCard(CARD.DOUBLE, undefined, seed);
  if (roll < 0.96) return makeCard(CARD.BEER, undefined, seed);
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
  beerTurns: number;
  beerStacks: number;
};

/* El puntaje nunca baja de cero: una penitencia con 4 puntos encima deja
   en 0, no en -11. */
export function applyPenalty(score: number, puntos: number = PENALTY_POINTS): number {
  return Math.max(0, score - puntos);
}

/* Cuánto cobra la casilla donde caíste.
 *
 * Existe para que la respuesta viva en UN lugar. El cliente y el servidor
 * resuelven la penitencia por su cuenta —el local para poder predecir, el
 * online porque es la autoridad— y con la cuenta escrita en los dos, la
 * primera vez que alguien toque un número van a discrepar en silencio: el
 * jugador vería bajar 3 y el servidor le descontaría 6.
 *
 * Recibe el tablero CRUDO y el estado de maldición, no la casilla ya
 * convertida: después de `squareFor` las dos son `PENALTY` y no hay forma
 * de saber cuál era un bonus. */
export function penaltyFor(
  board: SquareType[] | undefined,
  pos: number,
  cursed: boolean
): number {
  return cursed && squareAt(board, pos) === SQUARE.BONUS
    ? CURSED_BONUS_POINTS
    : PENALTY_POINTS;
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
  /* Sin nada de cerveza: es la única carta que no le llega al rival, así
     que su estado de borrachera no entra ni sale de esta función. */
  rival: { score: number; hand: Card[]; curseTurns: number }
): {
  score: number;
  hand: Card[];
  curseTurns: number;
  /* La tapó un escudo y no pasó nada. El golpe nunca sale bloqueado. */
  blocked: boolean;
  /* Cuánto le sacó, para que el robo sepa cuánto sumarse. */
  taken: number;
} {
  const base = { score: rival.score, hand: rival.hand, curseTurns: rival.curseTurns };

  /* La cerveza no le hace nada a nadie: se la toma el que la juega y se
     resuelve al ponerla, así que nunca debería llegar hasta acá.
     Pero "no debería" no alcanza. Una sala online abierta desde antes de
     este cambio puede tener una cerveza ya boca abajo sobre la mesa, y sin
     esta salida caería en el chequeo de abajo y le QUEMARÍA UN ESCUDO al
     rival a cambio de nada — el peor tipo de bug: silencioso, del lado del
     que ni jugó la carta, y sólo en partidas viejas. */
  if (card.type === CARD.BEER) {
    return { ...base, blocked: false, taken: 0 };
  }

  /* El resto sí: cada defensa tapa una sola carta, así que contra tres
     ataques una defensa frena el primero y los otros dos entran. Esa es la
     razón de poder acumular cartas puestas. */
  if (hasDefense(rival.hand)) {
    return {
      ...base,
      hand: dropFirstOfType(rival.hand, CARD.DEFENSE),
      blocked: true,
      taken: 0,
    };
  }

  if (card.type === CARD.STEAL) {
    /* El tope se recalcula carta por carta: dos robos seguidos no pueden
       sacar más de lo que el rival tenía. */
    const taken = Math.min(card.value ?? 0, rival.score);
    return { ...base, score: rival.score - taken, blocked: false, taken };
  }

  /* El golpe descuenta sin transferir: el rival pierde los puntos y nadie
     los gana. Va DESPUÉS del chequeo de defensa, como todas las demás —
     antes vivía arriba, saltándose el escudo, y ésa era justamente su regla
     especial. */
  if (card.type === CARD.PUNCH) {
    return { ...base, score: applyPunch(rival.score), blocked: false, taken: 0 };
  }

  if (card.type === CARD.CURSE) {
    return { ...base, curseTurns: CURSE_TURNS, blocked: false, taken: 0 };
  }


  return { ...base, blocked: false, taken: 0 };
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
