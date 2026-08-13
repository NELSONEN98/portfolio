import { useCallback, useMemo, useRef, useState } from "react";
import {
  GOAL,
  CARD,
  hasRoomFor,
  PENALTY_POINTS,
  SQUARE,
  squareFor,
  advance,
  startingHand,
  randomBonusCard,
  resolveRoll,
  applyPenalty,
  targetOf,
  nextSeat,
  cappedScore,
  applyCard,
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

export function newPlayer(char) {
  return {
    char,
    score: 0,
    current: 0,
    pos: 0,
    hand: startingHand(),
    pendingCards: [],
    curseTurns: 0,
    doubleNext: false,
  };
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
    setPlaying(true);
    setFinished(false);
    setRolling(false);
    setEvents([]);
  }, []);

  /* Qué hace la casilla en la que la ficha YA está parada. No la mueve: el
     movimiento es la fase anterior y ocurre bastante antes en el tiempo.
     Devuelve el jugador modificado en vez de mutarlo: React necesita
     objetos nuevos para volver a pintar. */
  const efectoCasilla = useCallback((p, lado, tablero) => {
    /* `squareFor` y no `squareAt`: lo que la casilla HACE depende de quién
       la pisa. Con la maldición encima, el bonus de este jugador ya no
       entrega carta —le corta el turno—, y quien ejecuta ese corte es la
       pantalla, no esta función: acá alcanza con no entregar nada. */
    const casilla = squareFor(tablero, p.pos ?? 0, (p.curseTurns ?? 0) > 0);
    const hechos = [];
    let { score, hand } = p;

    if (casilla === SQUARE.PENALTY) {
      score = applyPenalty(score);
      /* El lado viaja con el hecho: la pantalla necesita saber a quién
         teñir de rojo, y el nombre no alcanza para ubicarlo. */
      hechos.push(
        evento("penitencia", { nombre: p.char.name, puntos: PENALTY_POINTS, lado })
      );
    } else if (casilla === SQUARE.BONUS) {
      /* Se sortea PRIMERO y se pregunta después, porque ahora la respuesta
         depende de qué salió: un escudo mira el tope de escudos y el resto
         mira el de la mano. Preguntando antes habría que adivinar cuál de
         los dos bolsillos va a hacer falta. */
      const ganada = randomBonusCard(rand, Date.now());
      if (hasRoomFor(ganada, hand ?? [], p.pendingCards ?? [])) {
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

    return { jugador: { ...p, score, hand }, hechos };
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

        /* La ficha avanza la SUMA DE LOS DADOS, no los puntos ganados.
           Son dos cosas distintas y usar una por la otra era el error:
           `gained` descarta los dados que salieron 1, así que con la carta
           de dos dados un [1,5] mostraba 6 en pantalla y movía 5. El
           puntaje sigue su regla —el 1 no suma— pero el tablero es
           posición física y tiene que coincidir con lo que se ve. */
        const pasos = tirada.dice.reduce((a, b) => a + b, 0);
        const destino = advance(p.pos ?? 0, pasos);

        const siguiente = [...prev];
        siguiente[active] = { ...p, pos: destino, doubleNext: false };
        return siguiente;
      });
    },
    [active]
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

      const { jugador, hechos } = efectoCasilla(p, active, board);
      if (hechos.length) emit(...hechos);

      const siguiente = [...prev];
      siguiente[active] = jugador;
      return siguiente;
    });
  }, [active, board, efectoCasilla, emit]);

  const endTurn = useCallback(() => {
    /* El turno gira en el mismo sentido que apuntan las cartas: al de tu
       derecha. Era `a === 0 ? 1 : 0`, que con dos jugadores da lo mismo y
       con cuatro daría siempre el segundo asiento. */
    setActive((a) => nextSeat(a, players.length));
    setRolling(false);
    /* Depende del NÚMERO de jugadores, no del array: `players.length` es un
       número, así que esta función sólo cambia de identidad cuando cambia
       el tamaño de la mesa —nunca durante una partida— y los efectos que la
       listan no se vuelven a disparar en cada tirada. */
  }, [players.length]);

  const playCard = useCallback(
    (uid) => {
      setPlayers((prev) => {
        const p = prev[active];
        if (!p) return prev;
        const carta = p.hand.find((c) => c.uid === uid);
        if (!carta || carta.type === CARD.DEFENSE) return prev;

        const siguiente = [...prev];
        const hand = dropCard(p.hand, uid);

        if (carta.type === CARD.DOUBLE) {
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
    const otro = targetOf(active, players.length);
    const rival = players[otro];
    if (!yo) return { gano: false, revelaciones: [] };

    let miScore = yo.score + yo.current;
    let rivalScore = rival?.score ?? 0;
    let rivalHand = rival?.hand ?? [];
    let rivalCurse = rival?.curseTurns ?? 0;
    const revelaciones = [];
    const hechos = [];

    /* Cada defensa tapa una sola carta: contra tres robos, una defensa
       frena el primero y los otros dos entran. Esa es la razón de poder
       acumular. */
    (yo.pendingCards ?? []).forEach((carta) => {
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
    const gano = miScore >= goal;
    hechos.push(evento(gano ? "ganado" : "plantado", { nombre: yo.char.name }));
    emit(...hechos);

    setPlayers((prev) => {
      const siguiente = [...prev];
      siguiente[active] = {
        ...prev[active],
        score: cappedScore(miScore),
        current: 0,
        pendingCards: [],
        curseTurns: Math.max(0, (prev[active].curseTurns ?? 0) - 1),
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
    return { gano, revelaciones };
  }, [players, active, goal, emit]);

  const winner = useMemo(() => {
    if (!finished) return null;
    return players[0]?.score >= players[1]?.score ? 0 : 1;
  }, [finished, players]);

  return {
    board, players, active, playing, finished, rolling, goal, events, miLado, hayPartida,
    setPlayers, setActive, setBoard, setPlaying, setFinished, setRolling, setGoal, setMiLado,
    start, roll, settleRoll, sumarPuntos, resolverCasilla, endTurn, playCard, hold, winner,
    emit, consumeEvents,
  };
}
