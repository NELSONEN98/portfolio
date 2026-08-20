import { useEffect, useRef, useState } from "react";
import {
  BOARD_COLS as COLS,
  BOARD_ROWS as ROWS,
  BOARD_SIZE,
  START_SQUARE,
  SQUARE,
  squareFor,
} from "../../convex/rules";
import { ms } from "../theme";
import { SQUARE_ICON } from "./icons";
import { CONFETI_PAPELES } from "./confeti";

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
const CONFETI_MS = ms("tablero.confeti");

/* Cuánto dura cada paso de un recorrido de N casillas. Las tiradas cortas
   van al ritmo natural; las largas aceleran para no pasarse del techo. */
function pasoDe(pasos) {
  return Math.min(PASO_MS, Math.max(24, Math.round(VIAJE_MAX_MS / pasos)));
}

/* De quién es la vista del tablero. En online cada uno pinta la suya; en
   local hay una sola pantalla para dos jugadores, así que manda el que está
   jugando el turno — sus bonus se ven convertidos mientras le toca y vuelven
   a la normalidad cuando pasa. Que el camino cambie de color al cambiar el
   turno no es un efecto: es la forma de que el maldito VEA su condena.
   Sin dibujarla, la maldición sería una trampa escondida —caer en lo que
   parece un premio y perder el turno— y eso no es dificultad, es que el
   juego mienta. */
export default function Board({
  board,
  players,
  mirandoLado = 0,
  onLlegada,
  /* Quién acaba de completar una vuelta, avisado en el paso que pisa la
     meta. Lo cuenta el TABLERO y no el motor por la misma razón que la
     penitencia: en online las casillas las resuelve el servidor y el hecho
     nunca llega al cliente, pero la ficha camina igual en los dos modos.
     Acá el cruce es literal y se ve en local y en online. */
  onVuelta,
  retrasoCasilla = 0,
}) {
  const maldito = (players[mirandoLado]?.curseTurns ?? 0) > 0;
  /* Dónde y de qué tipo fue el último impacto. Sólo las casillas que hacen
     algo se anuncian: encender también las vacías volvería el aviso ruido
     de fondo y dejaría de significar nada. */
  const [impacto, setImpacto] = useState(null);
  const [aterrizando, setAterrizando] = useState([false, false]);
  /* Las casillas que la ficha viene pisando, con una clave por pisada. Es
     la estela del recorrido: sin ella, con el paso lento la ficha parecía
     deslizarse por encima del dibujo en vez de ir tocando casillas. */
  const [pisadas, setPisadas] = useState({});
  /* El confeti de la meta. Es una clave que sube, no un booleano: dos
     vueltas seguidas tienen que volver a estallar, y sin algo que cambie
     React reusaría los nodos y la segunda no se vería. */
  const [confeti, setConfeti] = useState(0);

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

  /* `onVuelta` en una referencia y fuera de las dependencias del efecto que
     camina la ficha. Llega como función nueva en cada pintado del padre, y
     el padre se repinta con cada sondeo de la sala: como dependencia,
     cancelaría sus propios temporizadores y la ficha se quedaría clavada a
     mitad del recorrido. Es la misma trampa que ya está documentada en
     CardGained con `onDone`. */
  const onVueltaRef = useRef(onVuelta);
  /* La copia se hace en un efecto y no en el cuerpo del componente. Escribir
     un ref durante el pintado es lo que hace `CardGained` con `onDone`, y es
     justamente lo que el linter marca ahí: React puede descartar un render a
     medio hacer, y esa escritura ya habría pasado. En un efecto corre
     después del commit, que es cuando el valor es real. */
  useEffect(() => {
    onVueltaRef.current = onVuelta;
  }, [onVuelta]);

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

            /* Cruzar la meta. Se detecta acá, en el paso que la pisa, y no
               a partir de la posición final: el estado del juego salta al
               destino de una, así que desde afuera no hay forma de saber en
               qué momento la ficha tocó la casilla 0 — ni si pasó por ella.
               Acá el recorrido se camina de a una, y el cruce es literal. */
            if (casilla === START_SQUARE) {
              setConfeti((n) => n + 1);
              /* Y el festejo del que la dio. La casilla dice DÓNDE pasó, que
                 con dos fichas encima no alcanza para saber de quién fue la
                 vuelta ni a qué marcador le van a entrar los tres puntos. */
              onVueltaRef.current?.(i);
              timers.current[i].push(
                setTimeout(() => setConfeti(0), CONFETI_MS)
              );
            }
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

      /* La casilla se lee para EL QUE LLEGA, no para el que mira: en local
         los dos comparten pantalla, y el aviso que sale de acá es el que
         ordena el turno del jugador que acaba de caer. */
      const tipo = squareFor(board, fin, (p.curseTurns ?? 0) > 0);

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
        const tipo = squareFor(board, i, maldito);
        const { col, row } = squareCell(i);
        const Icono = SQUARE_ICON[tipo];
        const golpeada = impacto?.pos === i;
        /* La casilla 0 es de dónde salen las fichas y por dónde vuelven a
           pasar cada vuelta: se marca como meta para que el recorrido tenga
           un principio visible. */
        const esMeta = i === 0;
        const pisada = pisadas[i];
        /* Las tres esquinas redondeadas del tablero. Cada una se redondea
           SÓLO por su lado de afuera: con las cuatro esquinas curvas, la
           casilla se despega del camino y queda como una pastilla suelta en
           la punta en vez de ser el canto del anillo.
           La superior izquierda queda a escuadra a propósito: es la casilla
           0, la meta, y el ángulo vivo marca dónde arranca el recorrido.
           Sale de col/row y no de índices escritos a mano, así que si el
           tablero cambia de medida las esquinas se siguen encontrando. */
        const esquina =
          row === 1 && col === COLS
            ? " esq-sd"
            : row === ROWS && col === COLS
              ? " esq-id"
              : row === ROWS && col === 1
                ? " esq-ii"
                : "";
        return (
          <span
            key={golpeada ? `${i}-${impacto.key}` : pisada ? `${i}-p${pisada}` : i}
            className={`square ${tipo}${golpeada ? " impacto" : ""}${esMeta ? " meta" : ""}${
              pisada ? " pisada" : ""
            }${esquina}`}
            style={{ gridColumn: col, gridRow: row }}
          >
            {Icono ? <Icono /> : null}
            {esMeta && confeti > 0 ? (
              <span className="confeti" key={confeti} aria-hidden="true">
                {CONFETI_PAPELES.map((c, n) => (
                  <i className={`papel ${c}`} key={n} style={{ "--n": n }} />
                ))}
              </span>
            ) : null}
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

      {/* Acá vivía un −N sobre la casilla, el mismo que muestra el marcador.
          Existía porque los dos avisos estaban en puntas opuestas de la
          pantalla y había que atarlos con la mirada; ahora la cifra sale
          pegada al marcador y VIAJA hacia él, así que la unión la cuenta la
          animación y repetir el número acá eran dos avisos del mismo hecho.
          Lo que la casilla sigue diciendo es que la ficha cayó ahí: el
          destello y la onda, que son suyos. */}

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
        /* Quiénes están parados en esta misma casilla, en orden de asiento.
           Era `const otro = i === 0 ? 1 : 0` — una mesa de dos escrita en el
           cálculo del desvío, que con cuatro dejaba a las fichas 3 y 4
           siempre pegadas en el centro.
           El desvío reparte a todos alrededor del medio: con dos quedan a
           −0.17 y +0.17 de casilla, con cuatro a −0.51, −0.17, +0.17, +0.51.
           Lo consume el CSS como `--junta`. */
        const enLaCasilla = players.reduce(
          (acc, p, k) => (p && posVisual[k] === posVisual[i] ? [...acc, k] : acc),
          []
        );
        const juntas = enLaCasilla.length > 1;
        const lugar = enLaCasilla.indexOf(i);
        const desvio = juntas ? (lugar - (enLaCasilla.length - 1) / 2) * 0.34 : 0;
        return (
          <span
            key={i}
            className={`token p${i + 1}${aterrizando[i] ? " aterriza" : ""}${juntas ? " juntas" : ""}`}
            style={{
              ...cellCenter(posVisual[i] ?? 0),
              "--paso": `${pasoActual.current[i] ?? PASO_MS}ms`,
              "--junta": desvio,
            }}
          >
            {/* El número del jugador, dentro de la ficha.
                Va en un <svg> con viewBox y no como texto suelto porque el
                tamaño de la ficha sale de un porcentaje del tablero: no hay
                forma de atar un `font-size` a eso —los porcentajes de
                font-size miden contra la letra del padre, no contra su
                ancho—. Con el viewBox el dígito escala solo, exacto, en
                cualquier pantalla. Es el mismo recurso que usa el "?" de
                las casillas de bonus. */}
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <text x="5" y="7.35" textAnchor="middle">
                {i + 1}
              </text>
            </svg>
          </span>
        );
      })}
    </div>
  );
}
