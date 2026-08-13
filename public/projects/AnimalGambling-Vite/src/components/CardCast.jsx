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
/* El bloqueo dura más que el vuelo: la carta tiene que romperse y el sello
   tiene que poder leerse. Sin esto, la mejor noticia del turno pasaba en el
   mismo tiempo que un ataque que sí llegó. */
const BLOQUEO_MS = ms("cartaLanzada.selloVida");

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
    const b = setTimeout(() => terminar.current?.(), LECTURA_MS + (bloqueada ? BLOQUEO_MS : VUELO_MS));

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
      {/* Al bloquearse la carta se parte: las dos mitades son la misma cara
          recortada por lados opuestos, así que el corte calza exacto y lo
          que se ve es UNA carta quebrándose, no dos pedazos que aparecen.
          Mientras se rompe llegan la carta entera —debajo— y el sello. */}
      {fase === "bloqueada" ? (
        <>
          <div className={`card ${carta.type} mitad izq`}>
            <CardFace carta={carta} />
          </div>
          <div className={`card ${carta.type} mitad der`}>
            <CardFace carta={carta} />
          </div>
          <div className="bloqueado-sello">BLOQUEADO</div>
        </>
      ) : (
        <>
          <div className={`card ${carta.type}`}>
            <CardFace carta={carta} />
          </div>
          <div className="card-cast-label">{CARD_LABEL[carta.type]}</div>
        </>
      )}
    </div>
  );
}

/* De qué color destella el rival según lo que le llegó. La defensa no
   aparece acá: cuando bloquea no hay impacto que mostrar. */
export const COLOR_IMPACTO = {
  [CARD.STEAL]: "robo",
  [CARD.CURSE]: "maldicion",
  /* El golpe tiñe de rojo igual que el robo: los dos le hacen daño al que
     los recibe, y el destello cuenta QUE le pasó algo malo —no con qué
     carta—. Inventarle un color propio sugeriría una consecuencia distinta
     de la que tiene. */
  [CARD.PUNCH]: "robo",
};
