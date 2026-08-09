import { useCallback, useMemo, useRef, useState } from "react";
import {
  GOAL,
  CARD,
  HAND_LIMIT,
  CURSE_TURNS,
  PENALTY_POINTS,
  SQUARE,
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
  const [events, setEvents] = useState([]);

  /* Los hechos se acumulan para que la interfaz los consuma; sin esto, dos
     efectos en el mismo turno pisarían el primero. */
  const emit = useCallback((...nuevos) => {
    setEvents((prev) => [...prev, ...nuevos]);
  }, []);

  const consumeEvents = useCallback(() => setEvents([]), []);

  const start = useCallback((p1, p2) => {
    setBoard(makeBoard(rand));
    setPlayers([p1, p2]);
    setActive(0);
    setPlaying(true);
    setFinished(false);
    setRolling(false);
    setEvents([]);
  }, []);

  /* Aplica lo que pasa al frenar la ficha. Devuelve el jugador modificado
     en vez de mutarlo: React necesita objetos nuevos para volver a pintar. */
  const aplicarCasilla = useCallback((p, pasos, tablero) => {
    const pos = advance(p.pos ?? 0, pasos);
    const casilla = squareAt(tablero, pos);
    const hechos = [];
    let { score, hand } = p;

    if (casilla === SQUARE.PENALTY) {
      score = applyPenalty(score);
      hechos.push(evento("penitencia", { nombre: p.char.name, puntos: PENALTY_POINTS }));
    } else if (casilla === SQUARE.BONUS) {
      const ocupadas = (hand?.length ?? 0) + (p.pendingCards?.length ?? 0);
      if (ocupadas < HAND_LIMIT) {
        hand = [...(hand ?? []), randomBonusCard(rand, Date.now())];
        hechos.push(evento("bonus", { nombre: p.char.name }));
      } else {
        hechos.push(evento("bonusLleno"));
      }
    }

    return { jugador: { ...p, pos, score, hand }, hechos };
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

        const pasos = tirada.isBust ? tirada.dice.length : tirada.gained;
        const { jugador, hechos } = aplicarCasilla(
          { ...p, doubleNext: false },
          pasos,
          board
        );

        if (tirada.isBust) {
          /* Las cartas puestas vuelven a la mano sin revelarse: quemarse ya
             cuesta el turno entero. */
          const devueltas = jugador.pendingCards ?? [];
          if (devueltas.length) {
            hechos.push(evento("cartasDevueltas", { cantidad: devueltas.length }));
          }
          emit(...hechos, evento("quemado"));
          const siguiente = [...prev];
          siguiente[active] = {
            ...jugador,
            current: 0,
            hand: [...(jugador.hand ?? []), ...devueltas],
            pendingCards: [],
            curseTurns: Math.max(0, (jugador.curseTurns ?? 0) - 1),
          };
          return siguiente;
        }

        emit(...hechos);
        const siguiente = [...prev];
        siguiente[active] = { ...jugador, current: p.current + tirada.gained };
        return siguiente;
      });
    },
    [active, board, aplicarCasilla, emit]
  );

  const endTurn = useCallback(() => {
    setActive((a) => (a === 0 ? 1 : 0));
    setRolling(false);
  }, []);

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

  /* Plantarse: guarda lo del turno, revela las cartas y decide si ganó. */
  const hold = useCallback(() => {
    let gano = false;

    setPlayers((prev) => {
      const yo = prev[active];
      const rival = prev[active === 0 ? 1 : 0];
      if (!yo) return prev;

      let miScore = yo.score + yo.current;
      let rivalScore = rival?.score ?? 0;
      let rivalHand = rival?.hand ?? [];
      let rivalCurse = rival?.curseTurns ?? 0;
      const hechos = [];

      /* Cada defensa tapa una sola carta: contra tres robos, una defensa
         frena el primero y los otros dos entran. */
      (yo.pendingCards ?? []).forEach((carta) => {
        const bloqueada = hasDefense(rivalHand);
        if (bloqueada) {
          rivalHand = dropFirstOfType(rivalHand, CARD.DEFENSE);
        } else if (carta.type === CARD.STEAL) {
          const robado = Math.min(carta.value ?? 0, rivalScore);
          rivalScore -= robado;
          miScore += robado;
        } else if (carta.type === CARD.CURSE) {
          rivalCurse = CURSE_TURNS;
        }
        hechos.push(evento("cartaRevelada", { carta, bloqueada }));
      });

      gano = miScore >= goal;
      hechos.push(evento(gano ? "ganado" : "plantado", { nombre: yo.char.name }));
      emit(...hechos);

      const siguiente = [...prev];
      siguiente[active] = {
        ...yo,
        score: cappedScore(miScore),
        current: 0,
        pendingCards: [],
        curseTurns: Math.max(0, (yo.curseTurns ?? 0) - 1),
      };
      if (rival) {
        siguiente[active === 0 ? 1 : 0] = {
          ...rival,
          score: rivalScore,
          hand: rivalHand,
          curseTurns: rivalCurse,
        };
      }
      return siguiente;
    });

    /* Se lee después del setPlayers porque el cálculo vive adentro; el
       componente necesita saberlo para cortar el turno o abrir el final. */
    return () => gano;
  }, [active, goal, emit]);

  const winner = useMemo(() => {
    if (!finished) return null;
    return players[0]?.score >= players[1]?.score ? 0 : 1;
  }, [finished, players]);

  return {
    board, players, active, playing, finished, rolling, goal, events,
    setPlayers, setActive, setBoard, setPlaying, setFinished, setRolling, setGoal,
    start, roll, settleRoll, endTurn, playCard, hold, winner,
    emit, consumeEvents,
  };
}
