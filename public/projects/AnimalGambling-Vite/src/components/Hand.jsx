import { useCallback, useRef, useState } from "react";
import { CARD, CARD_LABEL } from "../../convex/rules";
import { CARD_ICON } from "./icons";

/* La cara de una carta: el robo muestra su valor en negativo —es lo que le
   pasa al rival, y el signo lo dice sin leer el rótulo— y el resto su
   ícono. */
export function CardFace({ carta }) {
  if (carta.type === CARD.STEAL) {
    return (
      <>
        <span className="card-kind">{CARD_LABEL.steal}</span>
        <span className="card-value">−{carta.value}</span>
      </>
    );
  }
  const Icono = CARD_ICON[carta.type];
  return (
    <>
      <span className="card-icon">{Icono ? <Icono /> : null}</span>
      <span className="card-kind">{CARD_LABEL[carta.type]}</span>
    </>
  );
}

/* Abanico: 3° entre carta y carta, repartidos alrededor del centro.
 *
 *   3 cartas →        −3°  0°  3°
 *   5 cartas →   −6° −3°  0°  3°  6°
 *   7 cartas → −9° −6° −3°  0°  3°  6°  9°
 *
 * Sale de una fórmula y no de una tabla porque la mano crece y se achica
 * durante la partida: con valores fijos, cuatro cartas quedarían
 * descentradas. */
const PASO_GRADOS = 3;

export function anguloDe(i, total) {
  return (i - (total - 1) / 2) * PASO_GRADOS;
}

/* Cuánto se mete cada carta sobre la anterior. En un abanico real las
   cartas se tapan; sin superposición esto sería una lista inclinada. */
const SOLAPE = 0.42;

/* Mantener apretado muestra la carta grande; un toque la juega. El umbral
   es lo que separa las dos intenciones — sin él, cualquier toque
   levantaría la vista previa y jugar se volvería incómodo. */
const MANTENER_MS = 260;

export default function Hand({ cartas = [], habilitada, onPlay }) {
  const [preview, setPreview] = useState(null);
  const timer = useRef(null);
  const fuePreview = useRef(false);

  const soltar = useCallback(() => {
    clearTimeout(timer.current);
    setPreview(null);
  }, []);

  const apretar = useCallback((carta) => {
    fuePreview.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fuePreview.current = true;
      setPreview(carta);
    }, MANTENER_MS);
  }, []);

  const levantar = useCallback(
    (carta) => {
      clearTimeout(timer.current);
      setPreview(null);
      // Sólo el toque corto juega; el largo era para mirarla.
      if (!fuePreview.current && habilitada && carta.type !== CARD.DEFENSE) {
        onPlay(carta.uid);
      }
      fuePreview.current = false;
    },
    [habilitada, onPlay]
  );

  return (
    <>
      <div className="hand-fan" aria-label="Tus cartas">
        {cartas.map((c, i) => {
          /* La defensa se muestra pero no se puede soltar: se gasta sola
             cuando te atacan, y jugarla sería tirarla. */
          const jugable = c.type !== CARD.DEFENSE && habilitada;
          return (
            <button
              key={c.uid}
              className={`card ${c.type}${jugable ? "" : " no-jugable"}`}
              style={{
                "--giro": `${anguloDe(i, cartas.length)}deg`,
                "--solape": SOLAPE,
                zIndex: i,
              }}
              title={`${CARD_LABEL[c.type]}${c.value ? ` −${c.value}` : ""}`}
              onPointerDown={() => apretar(c)}
              onPointerUp={() => levantar(c)}
              onPointerLeave={soltar}
              onPointerCancel={soltar}
              /* El click nativo se ignora: la jugada la decide el gesto,
                 que distingue el toque del mantener. */
              onClick={(e) => e.preventDefault()}
            >
              <CardFace carta={c} />
            </button>
          );
        })}
      </div>

      {preview && (
        <div className="card-preview" aria-hidden="true">
          <div className={`card ${preview.type}`}>
            <CardFace carta={preview} />
          </div>
        </div>
      )}
    </>
  );
}
