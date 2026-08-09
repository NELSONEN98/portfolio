import { BOARD_COLS as COLS, BOARD_ROWS as ROWS, BOARD_SIZE } from "../../convex/rules";
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

function Token({ side, pos }) {
  return <span className={`token p${side + 1}`} style={cellCenter(pos)} />;
}

export default function Board({ board, players }) {
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
        return (
          <span
            key={i}
            className={`square ${tipo}`}
            style={{ gridColumn: col, gridRow: row }}
          >
            {Icono ? <Icono /> : null}
          </span>
        );
      })}

      {players.map((p, i) =>
        p ? <Token key={i} side={i} pos={p.pos ?? 0} /> : null
      )}
    </div>
  );
}
