import { useEffect, useRef, useState } from "react";
import { CardFace } from "./Hand";
import { CARD, CARD_LABEL } from "../../convex/rules";
import { ms } from "../theme";

/* La carta que se revela al plantarse: sale del mazo, se agranda en el
 * medio para que se lea, y vuela hacia el rival.
 *
 * Si el rival la bloquea con una defensa, no viaja: se desvanece donde
 * está. Ese corte es la información — la carta salió y no llegó a ninguna
 * parte, que es exactamente lo que hizo la defensa.
 *
 * El impacto en el rival lo dispara el padre cuando esto termina, no este
 * componente: el color del destello depende del tipo de carta y el que
 * sabe dónde está cada peleador es la pantalla.
 */
const LECTURA_MS = ms("cartaLanzada.lectura");
const VUELO_MS = ms("cartaLanzada.vuela");

export default function CardCast({ carta, bloqueada, haciaArriba, onDone }) {
  const [fase, setFase] = useState("sale");

  /* Igual que en la entrega: onDone llega como función nueva en cada
     pintado del padre, y como dependencia reiniciaría la secuencia. */
  const terminar = useRef(onDone);
  terminar.current = onDone;

  useEffect(() => {
    if (!carta) return;
    setFase("sale");

    const a = setTimeout(() => setFase(bloqueada ? "bloqueada" : "vuela"), LECTURA_MS);
    const b = setTimeout(() => terminar.current?.(), LECTURA_MS + VUELO_MS);

    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [carta, bloqueada]);

  if (!carta) return null;

  return (
    <div
      className={`card-cast ${fase}`}
      style={{ "--vuelo-y": haciaArriba ? "-36vh" : "36vh" }}
      aria-live="polite"
    >
      <div className={`card ${carta.type}`}>
        <CardFace carta={carta} />
      </div>

      <div className="card-cast-label">
        {bloqueada ? "BLOQUEADA" : CARD_LABEL[carta.type]}
      </div>
    </div>
  );
}

/* De qué color destella el rival según lo que le llegó. La defensa no
   aparece acá: cuando bloquea no hay impacto que mostrar. */
export const COLOR_IMPACTO = {
  [CARD.STEAL]: "robo",
  [CARD.CURSE]: "maldicion",
};
