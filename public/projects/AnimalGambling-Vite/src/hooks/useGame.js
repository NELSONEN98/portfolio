import { useCallback, useMemo, useRef, useState } from "react";
import {
  GOAL,
  CARD,
  hasRoomFor,
  SQUARE,
  squareFor,
  advance,
  passedStart,
  LAP_BONUS,
  startingHand,
  mirrorHand,
  randomBonusCard,
  resolveRoll,
  pasosDe,
  applyPenalty,
  penaltyFor,
  targetOf,
  seatAfter,
  esDeFlujo,
  resolverFlujo,
  A_LA_DERECHA,
  cappedScore,
  applyCard,
  tickBeer,
  addBeer,
  dropCard,
  makeBoard,
} from "../../convex/rules";

/* Estado y reglas de una partida, sin una sola referencia al DOM.
 *
 * Esa restricción no es estética: es lo que hace que este archivo sobreviva
 * al salto a React Native. Los componentes que lo consumen se reescriben
 * allá; esto viaja tal cual. Si acá aparece un document.querySelector, se
 * pierde esa propiedad y no hay forma de darse cuenta hasta el día de la
 * migración.
 */

const rand = () => Math.random();

/* La mano llega de afuera y por defecto viene vacía.
 *
 * Antes se repartía acá adentro, y ese detalle era justamente el problema:
 * llamando una vez por jugador, cada uno sacaba una mano distinta. El
 * reparto subió un piso —a `newPlayers`— para que sea UNO solo y se copie.
 *
 * Vacía por defecto porque el otro que la usa es el sondeo del modo online,
 * que arma un jugador de base y le pisa la mano con la del servidor: ahí
 * repartir sería sortear cartas para tirarlas a la basura. */
export function newPlayer(char, hand = []) {
  return {
    char,
    score: 0,
    current: 0,
    pos: 0,
    hand,
    pendingCards: [],
    curseTurns: 0,
    beerTurns: 0,
    beerStacks: 0,
    doubleNext: false,
  };
}

/* La mesa entera, con UNA sola mano repartida y copiada a todos.
 *
 * El porqué del espejo está en `mirrorHand`, en las reglas. Acá interesa
 * que el sorteo ocurra una vez y afuera del bucle: es el modo local, así
 * que este es el equivalente de lo que `createRoom` hace en el servidor. */
export function newPlayers(chars) {
  const mano = startingHand(rand);
  return chars.map((char, asiento) => newPlayer(char, mirrorHand(mano, asiento)));
}

/* Los efectos que la interfaz tiene que mostrar salen como una lista de
   hechos, no como llamadas a notify() o a animaciones. El hook dice qué
   pasó; que se vea como un cartel o como un temblor lo decide la capa de
   arriba, que es la única que cambia entre web y móvil. */
function evento(tipo, datos = {}) {
  return { tipo, ...datos, id: Math.random().toString(36).slice(2) };
}

export function useGame() {
  const [board, setBoard] = useState([]);
  const [players, setPlayers] = useState([null, null]);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [goal, setGoal] = useState(GOAL);
  /* Hacia dónde va la ronda. Arranca hacia la derecha y lo da vuelta la
     carta de media vuelta. Vive en el motor y no en la pantalla porque es
     estado de la PARTIDA: decide el turno y los objetivos, no cómo se
     dibuja nada. */
  const [sentido, setSentido] = useState(A_LA_DERECHA);
  /* De qué lado está esta pantalla. En local siempre 0 —los dos miran la
     misma—; en online lo fija el sondeo comparando el sessionId. */
  const [miLado, setMiLado] = useState(0);
  const [events, setEvents] = useState([]);

  /* Si hay partida armada, en una referencia además del estado.
     setPlayers se aplica diferido, así que el guardia del router —que
     corre en la misma vuelta que start()— todavía veía la mano vacía y
     rebotaba a quien acababa de apretar Jugar. Una ref cambia en el acto. */
  const hayPartida = useRef(false);

  /* Los hechos se acumulan para que la interfaz los consuma; sin esto, dos
     efectos en el mismo turno pisarían el primero. */
  const emit = useCallback((...nuevos) => {
    setEvents((prev) => [...prev, ...nuevos]);
  }, []);

  const consumeEvents = useCallback(() => setEvents([]), []);

  /* Recibe la mesa entera como array, no dos jugadores sueltos. `(p1, p2)`
     era la última firma del motor que decía "acá juegan exactamente dos": el
     estado ya era un array, pero para llenarlo había que pasar por una
     puerta de dos. */
  const start = useCallback((jugadores) => {
    hayPartida.current = jugadores.length >= 2 && jugadores.every(Boolean);
    setBoard(makeBoard(rand));
    setPlayers(jugadores);
    setActive(0);
    // Toda partida empieza yendo hacia la derecha.
    setSentido(A_LA_DERECHA);
    setPlaying(true);
    setFinished(false);
    setRolling(false);
    setEvents([]);
  }, []);

  /* Qué hace la casilla en la que la ficha YA está parada. No la mueve: el
     movimiento es la fase anterior y ocurre bastante antes en el tiempo.
     Devuelve el jugador modificado en vez de mutarlo: React necesita
     objetos nuevos para volver a pintar. */
  const efectoCasilla = useCallback((p, lado, tablero, mesa) => {
    /* `squareFor` y no `squareAt`: lo que la casilla HACE depende de quién
       la pisa. Con la maldición encima, el bonus de este jugador no entrega
       carta: se lee como penitencia y cae por la rama de arriba, que le
       descuenta los puntos. Acá no hay ningún caso especial que escribir —
       la conversión ya ocurrió al leer la casilla. */
    const maldito = (p.curseTurns ?? 0) > 0;
    const casilla = squareFor(tablero, p.pos ?? 0, maldito);
    const hechos = [];
    let { score, hand } = p;
    let borrachera = { beerTurns: p.beerTurns ?? 0, beerStacks: p.beerStacks ?? 0 };

    if (casilla === SQUARE.PENALTY) {
      /* Cuánto cobra lo decide la regla, no este archivo: el bonus que la
         maldición convirtió sale más barato que una casilla roja, y esa
         cuenta tiene que dar igual acá y en el servidor. */
      const puntos = penaltyFor(tablero, p.pos ?? 0, maldito);
      score = applyPenalty(score, puntos);
      /* El lado viaja con el hecho: la pantalla necesita saber a quién
         teñir de rojo, y el nombre no alcanza para ubicarlo. */
      hechos.push(evento("penitencia", { nombre: p.char.name, puntos, lado }));
    } else if (casilla === SQUARE.BONUS) {
      /* Se sortea PRIMERO y se pregunta después, porque ahora la respuesta
         depende de qué salió: un escudo mira el tope de escudos y el resto
         mira el de la mano. Preguntando antes habría que adivinar cuál de
         los dos bolsillos va a hacer falta. */
      /* El tamaño de la mesa entra en el sorteo: el duelo no reparte media
         vuelta —con dos asientos no hace nada— y le baja la frecuencia al
         salto, que ahí vale el doble porque saltear al único rival es
         volver a jugar. Lo decide `mazoDe`, en las reglas. */
      const ganada = randomBonusCard(rand, Date.now(), mesa);

      if (ganada.type === CARD.BEER) {
        /* ►► La cerveza no entra a la mano: te la tomás ahí mismo. ◄◄
         *
         * Es la única carta que se consume al recibirla, y por eso es la
         * única que no ocupa lugar ni se puede guardar. Como jugable era una
         * carta muerta —sólo te perjudica a vos, así que nadie la iba a
         * poner nunca— y encima te robaba uno de los cinco espacios del
         * bolsillo, o sea que salir en el bonus era peor que no salir nada.
         *
         * Resuelta acá, la casilla de bonus pasa a tener riesgo de verdad:
         * caer en ella deja de ser gratis. */
        borrachera = addBeer(borrachera);
        hechos.push(evento("bonus", { nombre: p.char.name, carta: ganada }));
      } else if (hasRoomFor(ganada, hand ?? [], p.pendingCards ?? [])) {
        hand = [...(hand ?? []), ganada];
        /* La carta viaja con el hecho: la interfaz la muestra grande antes
           de que llegue al abanico, y comparando manos no podría separar la
           ganada de una devuelta al quemarse. */
        hechos.push(evento("bonus", { nombre: p.char.name, carta: ganada }));
      } else {
        /* El tipo viaja con el hecho: "no te entra otro escudo" y "tenés la
           mano llena" son dos cosas distintas, y con un solo mensaje el
           jugador no sabría cuál de los dos bolsillos destrabar. */
        hechos.push(evento("bonusLleno", { tipo: ganada.type }));
      }
    }

    return { jugador: { ...p, score, hand, ...borrachera }, hechos };
  }, []);

  /* Tira y devuelve todo lo que hay que mostrar. No toca los dados ni el
     marcador: eso lo hace el componente cuando la animación llega al final,
     y por eso la tirada se devuelve en vez de aplicarse acá. */
  const roll = useCallback(() => {
    const p = players[active];
    if (!p || !playing || rolling) return null;

    const maldito = (p.curseTurns ?? 0) > 0;
    const tirada = resolveRoll(rand, maldito, Boolean(p.doubleNext));
    setRolling(true);
    return tirada;
  }, [players, active, playing, rolling]);

  /* Se llama cuando el dado frenó: recién ahí el estado cambia, para que el
     número no se mueva antes de que se vea la cara. */
  const settleRoll = useCallback(
    (tirada) => {
      setPlayers((prev) => {
        const p = prev[active];
        if (!p) return prev;

        /* Cuánto camina la ficha. La misma función que usa el servidor: era
           esta cuenta escrita a mano en los dos lados, y dos copias que
           tienen que coincidir son una que va a dejar de coincidir. */
        const pasos = pasosDe(tirada);
        const desde = p.pos ?? 0;
        const destino = advance(desde, pasos);

        /* La vuelta se pregunta ANTES de que `advance` aplique el módulo:
           después, la casilla 3 no sabe si vino de la 1 o de la 38.
           Va al marcador y no al acumulado del turno, simétrico con la
           penitencia: son los dos efectos del CAMINO, y lo que da el camino
           no se pierde al quemarse. */
        const vuelta = passedStart(desde, pasos);

        const siguiente = [...prev];
        siguiente[active] = {
          ...p,
          pos: destino,
          score: vuelta ? p.score + LAP_BONUS : p.score,
          doubleNext: false,
        };
        if (vuelta) {
          emit(evento("vuelta", { nombre: p.char.name, puntos: LAP_BONUS }));
        }
        return siguiente;
      });
    },
    [active, emit]
  );

  /* Fase dos: lo que valió la tirada.
   *
   * Va separada de settleRoll y la dispara el tablero cuando la ficha
   * FRENÓ, no cuando salió. Aplicadas juntas, el marcador se movía mientras
   * la ficha todavía estaba recorriendo casillas, y el turno se leía como
   * varias cosas sueltas pasando a la vez en vez de una consecuencia de la
   * otra.
   */
  const sumarPuntos = useCallback(
    (tirada) => {
      setPlayers((prev) => {
        const p = prev[active];
        if (!p) return prev;

        const siguiente = [...prev];

        if (tirada.isBust) {
          /* Las cartas puestas vuelven a la mano sin revelarse: quemarse ya
             cuesta el turno entero. */
          const devueltas = p.pendingCards ?? [];
          const hechos = [];
          if (devueltas.length) {
            hechos.push(evento("cartasDevueltas", { cantidad: devueltas.length }));
          }
          emit(...hechos, evento("quemado"));
          siguiente[active] = {
            ...p,
            current: 0,
            hand: [...(p.hand ?? []), ...devueltas],
            pendingCards: [],
            curseTurns: Math.max(0, (p.curseTurns ?? 0) - 1),
            ...tickBeer({
              beerTurns: p.beerTurns ?? 0,
              beerStacks: p.beerStacks ?? 0,
            }),
          };
          return siguiente;
        }

        siguiente[active] = { ...p, current: p.current + tirada.gained };
        return siguiente;
      });
    },
    [active, emit]
  );

  /* Fase tres: lo que dio o costó la casilla.
   *
   * Separada de los puntos porque son dos noticias distintas —cuánto sumó
   * el dado y qué pasó por caer ahí— y encimadas se leen como una sola
   * cifra que cambió por razones que no se ven. */
  const resolverCasilla = useCallback(() => {
    setPlayers((prev) => {
      const p = prev[active];
      if (!p) return prev;

      const { jugador, hechos } = efectoCasilla(p, active, board, prev.length);
      if (hechos.length) emit(...hechos);

      const siguiente = [...prev];
      siguiente[active] = jugador;
      return siguiente;
    });
  }, [active, board, efectoCasilla, emit]);

  /* Cerrar el turno y pasárselo a quien corresponda.
   *
   * Los dos argumentos vienen de `hold`, y por eso son argumentos y no
   * estado leído acá adentro: `setSentido` es diferido, así que en la misma
   * vuelta en que se juega una media vuelta este `sentido` todavía vale el
   * de antes y el turno se iría para el lado equivocado. Quien resolvió las
   * cartas ya sabe la respuesta; que la pase.
   *
   * Sin argumentos es el turno normal —el que usa el quemarse—, donde las
   * cartas volvieron a la mano sin revelarse y por lo tanto nada del flujo
   * llegó a pasar. */
  const endTurn = useCallback(
    (saltos = 0, nuevoSentido) => {
      const haciaDonde = nuevoSentido ?? sentido;
      setActive((a) => seatAfter(a, players.length, haciaDonde, saltos));
      setRolling(false);
    },
    [players.length, sentido]
  );

  const playCard = useCallback(
    (uid) => {
      setPlayers((prev) => {
        const p = prev[active];
        if (!p) return prev;
        const carta = p.hand.find((c) => c.uid === uid);
        if (!carta || carta.type === CARD.DEFENSE) return prev;

        const siguiente = [...prev];
        const hand = dropCard(p.hand, uid);

        if (carta.type === CARD.BEER) {
          /* Se la toma el que la juega. Va por el mismo camino que los dos
             dados —efecto inmediato sobre uno mismo— y no por el de las
             cartas boca abajo: no hay nada que revelar al plantarse cuando
             el efecto no viaja a ningún lado. */
          siguiente[active] = {
            ...p,
            hand,
            ...addBeer({
              beerTurns: p.beerTurns ?? 0,
              beerStacks: p.beerStacks ?? 0,
            }),
          };
          emit(evento("cerveza"));
        } else if (carta.type === CARD.DOUBLE) {
          /* Vale para la tirada de este mismo turno, así que se aplica ya y
             no queda esperando al plantarse. */
          siguiente[active] = { ...p, hand, doubleNext: true };
          emit(evento("dosDados"));
        } else {
          const pendingCards = [...(p.pendingCards ?? []), carta];
          siguiente[active] = { ...p, hand, pendingCards };
          emit(evento("cartaPuesta", { cantidad: pendingCards.length }));
        }
        return siguiente;
      });
    },
    [active, emit]
  );

  /* Levantar una carta del fieltro y volver a guardarla en la mano.
   *
   * Mientras esté boca abajo no pasó nada: para el rival la carta recién
   * existe cuando el que la puso se planta, así que arrepentirse no le saca
   * información a nadie y no hace falta cobrarle nada.
   *
   * Sin chequeo de tope, y no es un olvido: `countPlayable` ya cuenta las
   * puestas, o sea que una que vuelve a la mano no mueve el total. Si entró,
   * hay lugar para que vuelva. */
  const takeBackCard = useCallback(
    (uid) => {
      setPlayers((prev) => {
        const p = prev[active];
        if (!p) return prev;
        const carta = (p.pendingCards ?? []).find((c) => c.uid === uid);
        if (!carta) return prev;

        const siguiente = [...prev];
        const pendingCards = dropCard(p.pendingCards ?? [], uid);
        siguiente[active] = { ...p, hand: [...(p.hand ?? []), carta], pendingCards };
        emit(evento("cartaRetirada", { cantidad: pendingCards.length }));
        return siguiente;
      });
    },
    [active, emit]
  );

  /* Plantarse: guarda lo del turno, revela las cartas y decide si ganó.
   *
   * El cálculo va sobre el estado actual y no adentro del setter: React
   * aplica los setters de forma diferida, así que leer el resultado desde
   * ahí devolvía el valor de la ronda anterior. Acá se resuelve primero,
   * se devuelve el resultado, y recién después se guarda.
   */
  const hold = useCallback(() => {
    const yo = players[active];
    /* A quién le pegan tus cartas: al de tu derecha, siempre. Con dos
       jugadores es el otro y no cambia nada; con cuatro, ya está resuelto.
       Esta línea era `active === 0 ? 1 : 0` — la suposición de que la mesa
       es de dos, escrita a mano en el medio de la resolución de cartas. */
    const otro = targetOf(active, players.length, sentido);
    const rival = players[otro];
    if (!yo) return { gano: false, revelaciones: [], saltos: 0, sentido };

    /* ►► Las cartas se parten en dos, y el orden importa. ◄◄
     *
     * Los ATAQUES van contra el objetivo que tenías al empezar el turno.
     * Las de FLUJO deciden lo que viene después. Si el flujo se aplicara
     * primero, poner una media vuelta y encima un robo te dejaría robarle a
     * OTRO — y eso rompe el "una sola víctima, un solo atacante" del que
     * cuelga todo el diseño direccional. */
    const pendientes = yo.pendingCards ?? [];
    const ataques = pendientes.filter((c) => !esDeFlujo(c));
    const flujo = resolverFlujo(pendientes, sentido);

    let miScore = yo.score + yo.current;
    let rivalScore = rival?.score ?? 0;
    let rivalHand = rival?.hand ?? [];
    let rivalCurse = rival?.curseTurns ?? 0;
    const revelaciones = [];
    const hechos = [];

    /* Cada defensa tapa una sola carta: contra tres robos, una defensa
       frena el primero y los otros dos entran. Esa es la razón de poder
       acumular. */
    ataques.forEach((carta) => {
      /* Qué hace la carta lo decide `applyCard`, en las reglas. Acá quedaba
         una cadena de `else if` que era una copia de la del servidor, y las
         dos se desincronizaron más de una vez. */
      const r = applyCard(carta, {
        score: rivalScore,
        hand: rivalHand,
        curseTurns: rivalCurse,
      });
      rivalScore = r.score;
      rivalHand = r.hand;
      rivalCurse = r.curseTurns;
      /* Lo único que no resuelve la regla: a quién van los puntos. El robo
         los transfiere, el golpe sólo los borra. */
      miScore += r.taken;

      const bloqueada = r.blocked;
      revelaciones.push({ carta, bloqueada });
      /* Quién la recibe viaja con el hecho. Deducirlo después por el turno
         no sirve: para cuando la carta termina de volar, el turno ya pasó
         al otro y el golpe le caía justo al que la tiró. */
      hechos.push(evento("cartaRevelada", { carta, bloqueada, destino: otro }));
    });

    /* El objetivo se mide después de las cartas: robar puede ser justo lo
       que cierra la partida. */
    /* Las de flujo también se cuentan, aunque no golpeen a nadie: el
       jugador puso una carta boca abajo y tiene derecho a ver qué era. Van
       después de los ataques, en el mismo orden en que se resuelven. */
    if (flujo.vueltas) {
      hechos.push(
        evento("mediaVuelta", { veces: flujo.vueltas, sentido: flujo.sentido })
      );
    }
    if (flujo.saltos) {
      hechos.push(evento("salto", { saltos: flujo.saltos, mesa: players.length }));
    }

    const gano = miScore >= goal;
    hechos.push(evento(gano ? "ganado" : "plantado", { nombre: yo.char.name }));
    emit(...hechos);
    /* El sentido nuevo queda guardado, pero `endTurn` NO lo va a leer de
       acá: setState es diferido y en esta misma vuelta todavía valdría el
       viejo. Por eso viaja también en el retorno. */
    if (flujo.sentido !== sentido) setSentido(flujo.sentido);

    setPlayers((prev) => {
      const siguiente = [...prev];
      siguiente[active] = {
        ...prev[active],
        score: cappedScore(miScore),
        current: 0,
        pendingCards: [],
        curseTurns: Math.max(0, (prev[active].curseTurns ?? 0) - 1),
        ...tickBeer({
          beerTurns: prev[active].beerTurns ?? 0,
          beerStacks: prev[active].beerStacks ?? 0,
        }),
      };
      if (prev[otro]) {
        siguiente[otro] = {
          ...prev[otro],
          score: rivalScore,
          hand: rivalHand,
          curseTurns: rivalCurse,
        };
      }
      return siguiente;
    });

    if (gano) setFinished(true);
    return { gano, revelaciones, saltos: flujo.saltos, sentido: flujo.sentido };
  }, [players, active, goal, emit, sentido]);

  /* El asiento con más puntos de la mesa.
   *
   * Era `players[0] >= players[1] ? 0 : 1` — una comparación entre DOS, o
   * sea la mesa de dos escrita en la única línea que quedaba del motor. Con
   * cuatro coronaba siempre a uno de los dos primeros aunque ganara el
   * tercero.
   *
   * El empate lo gana el asiento más bajo, que es lo que ya hacía el `>=`.
   * No hace falta más: para llegar acá alguien tuvo que cruzar el objetivo
   * al plantarse, y plantarse es de a uno. */
  const winner = useMemo(() => {
    if (!finished) return null;
    return players.reduce(
      (mejor, p, i) => ((p?.score ?? -1) > (players[mejor]?.score ?? -1) ? i : mejor),
      0
    );
  }, [finished, players]);

  return {
    board, players, active, playing, finished, rolling, goal, events, miLado, hayPartida, sentido,
    setPlayers, setActive, setBoard, setPlaying, setFinished, setRolling, setGoal, setMiLado, setSentido,
    start, roll, settleRoll, sumarPuntos, resolverCasilla, endTurn, playCard, takeBackCard, hold, winner,
    emit, consumeEvents,
  };
}
