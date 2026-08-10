import { useEffect, useRef, useState } from "react";
import {
  BOARD_COLS as COLS,
  BOARD_ROWS as ROWS,
  BOARD_SIZE,
  PENALTY_POINTS,
  SQUARE,
} from "../../convex/rules";
import { ms } from "../theme";
import { SQUARE_ICON } from "./icons";

/* El camino es el borde de una grilla de COLS×ROWS, y ese tamaño no es
   arbitrario: el borde de una grilla tiene 2C + 2F − 4 celdas, que es
   exactamente el largo de BOARD. Si cambian las constantes, el tablero
   acompaña solo.

   Las casillas van en celdas y no en posiciones porcentuales sueltas: es
   lo que hace que se toquen entre sí como en un tablero de verdad. Con
   posiciones libres quedaban puntos separados. */
export function squareCell(i) {
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
    left: `${((col - 0.5) / COLS) * 100}%`,
    top: `${((row - 0.5) / ROWS) * 100}%`,
  };
}

/* Cuánto tarda la ficha en pasar de una casilla a la SIGUIENTE, no de
   origen a destino: el recorrido se camina de a una. Interpolando las
   coordenadas de punta a punta, la transición movía `left` y `top` a la
   vez y la ficha cruzaba en diagonal por adentro del tablero en lugar de
   doblar la esquina. Entre casillas vecinas eso no puede pasar: comparten
   fila o columna, así que sólo una de las dos coordenadas cambia. */
const PASO_MS = ms("tablero.pasoFicha");
const VIAJE_MAX_MS = ms("tablero.viajeMaximo");
const REBOTE_MS = ms("tablero.aterriza");
const IMPACTO_MS = ms("tablero.casillaGolpe");
const PISADA_MS = ms("tablero.pisada");

/* Cuánto dura cada paso de un recorrido de N casillas. Las tiradas cortas
   van al ritmo natural; las largas aceleran para no pasarse del techo. */
function pasoDe(pasos) {
  return Math.min(PASO_MS, Math.max(24, Math.round(VIAJE_MAX_MS / pasos)));
}

export default function Board({ board, players, onLlegada, retrasoCasilla = 0 }) {
  /* Dónde y de qué tipo fue el último impacto. Sólo las casillas que hacen
     algo se anuncian: encender también las vacías volvería el aviso ruido
     de fondo y dejaría de significar nada. */
  const [impacto, setImpacto] = useState(null);
  const [aterrizando, setAterrizando] = useState([false, false]);
  /* Las casillas que la ficha viene pisando, con una clave por pisada. Es
     la estela del recorrido: sin ella, con el paso lento la ficha parecía
     deslizarse por encima del dibujo en vez de ir tocando casillas. */
  const [pisadas, setPisadas] = useState({});

  /* Dónde se DIBUJA cada ficha, que mientras camina no es dónde está en la
     partida: el estado del juego salta a la casilla final de una, y esto
     va quedando atrás hasta alcanzarlo. */
  const [posVisual, setPosVisual] = useState(() => players.map((p) => p?.pos ?? 0));
  /* Espejo del anterior para poder leerlo dentro del efecto sin esperar al
     re-pintado: si un movimiento nuevo llega mientras la ficha camina, hay
     que arrancar el tramo desde donde quedó y no desde donde debería estar. */
  const posActual = useRef(players.map((p) => p?.pos ?? 0));
  /* Cuánto dura el paso de cada ficha en el recorrido que está haciendo.
     Va por jugador porque los dos pueden estar caminando tramos de largo
     distinto al mismo tiempo. */
  const pasoActual = useRef([PASO_MS, PASO_MS]);
  /* A qué casilla va cada ficha. No es lo mismo que dónde está: mientras
     camina, el destino ya está decidido y la posición todavía no. */
  const destino = useRef([]);
  /* Una lista por jugador: al llegar una posición nueva se cancela lo que
     quedaba pendiente de esa ficha sin tocar el recorrido de la otra. */
  const timers = useRef([[], []]);

  useEffect(() => () => timers.current.forEach((l) => l?.forEach(clearTimeout)), []);

  useEffect(() => {
    players.forEach((p, i) => {
      if (!p) return;
      const fin = p.pos ?? 0;
      const desde = posActual.current[i];


      /* Primera vez que se ve esta ficha: se la coloca donde está, sin
         caminar. Sembrar el registro con los jugadores del primer render
         no alcanza — en online ese render ocurre ANTES de que el sondeo
         los traiga, así que el registro quedaba vacío. Y sin este caso
         `desde` valía undefined, la resta daba NaN, el bucle de pasos no
         llegaba a ejecutarse ni una vez y la ficha no volvía a moverse en
         toda la partida, porque el registro sólo se actualiza al caminar. */
      if (desde === undefined) {
        posActual.current[i] = fin;
        destino.current[i] = fin;
        setPosVisual((prev) => {
          const s = [...prev];
          s[i] = fin;
          return s;
        });
        return;
      }

      /* Ya viene caminando hacia esa casilla: no hay nada que rehacer.
         El sondeo repite la misma posición cada dos segundos, y sin esta
         guarda cada repetición cancelaba los pasos pendientes y los volvía
         a programar — el recorrido llegaba igual, pero partido en tramos en
         vez de andar de corrido. */
      if (destino.current[i] === fin) return;
      destino.current[i] = fin;

      if (fin === desde) return;

      timers.current[i] ??= [];
      timers.current[i].forEach(clearTimeout);
      timers.current[i] = [];

      /* Siempre hacia adelante. El recorrido es circular, así que cuando el
         destino tiene índice menor que el origen es porque se dio la vuelta
         entera: yendo para atrás se desharía justo el tramo que la ficha
         acaba de recorrer. */
      const pasos = (((fin - desde) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;

      /* El paso se decide por recorrido y se guarda para que el CSS lo lea:
         la transición tiene que durar lo mismo que la pausa entre pasos, o
         la ficha llega antes de tiempo y se queda esperando a la siguiente. */
      const paso = pasoDe(pasos);
      pasoActual.current[i] = paso;

      for (let n = 1; n <= pasos; n++) {
        const casilla = (desde + n) % BOARD_SIZE;
        timers.current[i].push(
          setTimeout(() => {
            posActual.current[i] = casilla;
            setPosVisual((prev) => {
              const s = [...prev];
              s[i] = casilla;
              return s;
            });

            /* La casilla acusa el paso de la ficha. La clave es un número
               que sube: dos vueltas seguidas pisan las mismas casillas, y
               sin algo que cambie React reusaría el nodo y la segunda no se
               vería animar. */
            setPisadas((prev) => ({ ...prev, [casilla]: (prev[casilla] ?? 0) + 1 }));
            timers.current[i].push(
              setTimeout(() => {
                setPisadas((prev) => {
                  const s = { ...prev };
                  delete s[casilla];
                  return s;
                });
              }, PISADA_MS)
            );
          }, n * paso)
        );
      }

      /* Todo lo que pasa al frenar arranca cuando la ficha LLEGÓ, y ahora
         eso depende de cuánto caminó: siete casillas tardan siete veces más
         que una, hasta el techo. */
      const viaje = pasos * paso;

      // La ficha rebota al frenar, haya caído donde haya caído.
      timers.current[i].push(
        setTimeout(() => {
          setAterrizando((prev) => {
            const s = [...prev];
            s[i] = true;
            return s;
          });
          timers.current[i].push(
            setTimeout(
              () =>
                setAterrizando((prev) => {
                  const s = [...prev];
                  s[i] = false;
                  return s;
                }),
              REBOTE_MS
            )
          );
        }, viaje)
      );

      const tipo = board[fin];
      const castiga = tipo === SQUARE.PENALTY;

      /* El aviso de que la ficha frenó. Es el que ordena el turno: el
         tablero es el único que sabe cuándo terminó el recorrido —depende
         de cuántas casillas caminó—, y recién ahí tienen sentido los puntos
         y lo que haya dado la casilla. Sale siempre, caiga donde caiga,
         porque la secuencia no puede depender del tipo de casilla. */
      timers.current[i].push(setTimeout(() => onLlegada?.(i, tipo), viaje));

      if (tipo && tipo !== SQUARE.PLAIN) {
        /* La marca lleva una clave propia: dos caídas seguidas en la misma
           casilla tienen que reiniciar la animación, y sin algo que cambie
           React reusaría el nodo y no se vería la segunda. */
        timers.current[i].push(
          setTimeout(() => {
            setImpacto({
              pos: fin,
              tipo,
              key: Date.now(),
              /* Cuánto costó caer ahí. Sale de las reglas y no de un número
                 escrito acá: el que descuenta de verdad es el motor, y dos
                 fuentes distintas se desincronizan calladas. */
              puntos: castiga ? PENALTY_POINTS : 0,
            });
            /* Espera lo mismo que la pantalla antes de resolver la casilla:
               el −6 y el destello del peleador cuentan lo mismo, y salidos
               con medio segundo de diferencia se leían como dos cosas
               distintas —una anunciando un descuento que todavía no había
               ocurrido—. */
          }, viaje + retrasoCasilla)
        );
      }
    });
  }, [players, board]);

  useEffect(() => {
    if (!impacto) return;
    const t = setTimeout(() => setImpacto(null), IMPACTO_MS);
    return () => clearTimeout(t);
  }, [impacto]);

  return (
    <div
      className="board-track"
      aria-hidden="true"
      style={{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
      }}
    >
      {/* El camino se dibuja SIEMPRE entero, a partir de la geometría, y no
          una casilla por cada elemento del tablero recibido.

          Los dos números coinciden mientras el tablero venga de estas mismas
          constantes, pero no siempre vienen de acá: en online lo genera el
          servidor, y una sala creada antes de un cambio de tamaño lo guarda
          con el anterior. Recorriendo el dato, el camino quedaba cortado —al
          pasar de 8 a 10 filas faltaba media columna izquierda, que son
          justo los últimos índices—. Recorriendo la geometría, lo que falta
          es información de una casilla, no la casilla. */}
      {Array.from({ length: BOARD_SIZE }, (_, i) => {
        const tipo = board[i] ?? SQUARE.PLAIN;
        const { col, row } = squareCell(i);
        const Icono = SQUARE_ICON[tipo];
        const golpeada = impacto?.pos === i;
        /* La casilla 0 es de dónde salen las fichas y por dónde vuelven a
           pasar cada vuelta: se marca como meta para que el recorrido tenga
           un principio visible. */
        const esMeta = i === 0;
        const pisada = pisadas[i];
        return (
          <span
            key={golpeada ? `${i}-${impacto.key}` : pisada ? `${i}-p${pisada}` : i}
            className={`square ${tipo}${golpeada ? " impacto" : ""}${esMeta ? " meta" : ""}${
              pisada ? " pisada" : ""
            }`}
            style={{ gridColumn: col, gridRow: row }}
          >
            {Icono ? <Icono /> : null}
          </span>
        );
      })}

      {/* El destello sale de la casilla hacia afuera: es lo que conecta el
          lugar donde cayó la ficha con el número que se mueve. */}
      {impacto && (
        <span
          key={impacto.key}
          className={`impacto-onda ${impacto.tipo}`}
          style={cellCenter(impacto.pos)}
        />
      )}

      {/* Cuánto se perdió, dicho en la casilla donde pasó. El marcador ya
          muestra su propio −N, pero está lejos del tablero: sin este, hay
          que atar dos cosas que ocurren a la vez en puntas opuestas de la
          pantalla para entender que una causó la otra. */}
      {impacto?.puntos > 0 && (
        <span
          key={`hit-${impacto.key}`}
          className="casilla-hit"
          style={cellCenter(impacto.pos)}
          aria-hidden="true"
        >
          −{impacto.puntos}
        </span>
      )}

      {players.map((p, i) => {
        if (!p) return null;
        /* Las fichas sólo se corren del centro cuando comparten casilla.
           Antes el desplazamiento era fijo, así que cada ficha quedaba
           descentrada de su propia casilla siempre — y al empezar, con las
           dos en la meta, la distancia entre ellas se leía como que una
           arrancaba una casilla más adelante que la otra.

           Se compara lo que se ve y no lo que dice la partida: mientras una
           ficha camina, las dos pueden cruzarse por una casilla que ninguna
           de las dos tiene como destino. */
        const otro = i === 0 ? 1 : 0;
        const juntas = Boolean(players[otro]) && posVisual[otro] === posVisual[i];
        return (
          <span
            key={i}
            className={`token p${i + 1}${aterrizando[i] ? " aterriza" : ""}${juntas ? " juntas" : ""}`}
            style={{
              ...cellCenter(posVisual[i] ?? 0),
              "--paso": `${pasoActual.current[i] ?? PASO_MS}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
