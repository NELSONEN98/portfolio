import { useEffect, useRef, useState } from "react";
import { BOARD_COLS as COLS, BOARD_ROWS as ROWS, BOARD_SIZE, SQUARE } from "../../convex/rules";
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

/* Cuánto dura el aterrizaje. Arranca cuando la ficha llegó, no cuando
   salió: la transición de posición dura 0.45s en el CSS. */
const VIAJE_MS = 450;
const IMPACTO_MS = 900;

export default function Board({ board, players }) {
  /* Dónde y de qué tipo fue el último impacto. Sólo las casillas que hacen
     algo se anuncian: encender también las vacías volvería el aviso ruido
     de fondo y dejaría de significar nada. */
  const [impacto, setImpacto] = useState(null);
  const [aterrizando, setAterrizando] = useState([false, false]);
  const posPrevia = useRef(players.map((p) => p?.pos ?? 0));

  useEffect(() => {
    const previas = posPrevia.current;
    posPrevia.current = players.map((p) => p?.pos ?? 0);

    players.forEach((p, i) => {
      if (!p || p.pos === previas[i]) return;

      // La ficha rebota al frenar, haya caído donde haya caído.
      setTimeout(() => {
        setAterrizando((prev) => {
          const s = [...prev];
          s[i] = true;
          return s;
        });
        setTimeout(
          () =>
            setAterrizando((prev) => {
              const s = [...prev];
              s[i] = false;
              return s;
            }),
          420
        );
      }, VIAJE_MS);

      const tipo = board[p.pos];
      if (tipo && tipo !== SQUARE.PLAIN) {
        /* La marca lleva una clave propia: dos caídas seguidas en la misma
           casilla tienen que reiniciar la animación, y sin algo que cambie
           React reusaría el nodo y no se vería la segunda. */
        setTimeout(() => setImpacto({ pos: p.pos, tipo, key: Date.now() }), VIAJE_MS);
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
      {board.map((tipo, i) => {
        const { col, row } = squareCell(i);
        const Icono = SQUARE_ICON[tipo];
        const golpeada = impacto?.pos === i;
        /* La casilla 0 es de dónde salen las fichas y por dónde vuelven a
           pasar cada vuelta: se marca como meta para que el recorrido tenga
           un principio visible. */
        const esMeta = i === 0;
        return (
          <span
            key={golpeada ? `${i}-${impacto.key}` : i}
            className={`square ${tipo}${golpeada ? " impacto" : ""}${esMeta ? " meta" : ""}`}
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

      {players.map((p, i) =>
        p ? (
          <span
            key={i}
            className={`token p${i + 1}${aterrizando[i] ? " aterriza" : ""}`}
            style={cellCenter(p.pos ?? 0)}
          />
        ) : null
      )}
    </div>
  );
}
