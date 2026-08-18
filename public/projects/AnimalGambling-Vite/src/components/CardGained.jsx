import { useEffect, useRef, useState } from "react";
import { CardFace } from "./Hand";
import { ms } from "../theme";
import { medir } from "../medir";
import { CARD } from "../../convex/rules";

/* Adónde aterriza la carta que acabás de ganar.
 *
 * ►► La defensa no va al abanico. Nunca fue. ◄◄
 *
 * Las defensas se filtran del abanico y se dibujan como escuditos en la
 * línea del peleador (ver `jugables` / `defensas` en VersusScreen), porque
 * no se juegan: se gastan solas cuando te atacan. Pero la entrega las
 * mandaba igual al abanico, así que la carta viajaba hasta un lugar donde
 * no aparecía nunca y el escudo se encendía en la otra punta sin que nada
 * lo conectara con lo que se acababa de ver.
 *
 * El respaldo importa y no es decorativo: `.f-defensas` sólo existe en el
 * DOM cuando tenés al menos una defensa. Para la PRIMERA la fila todavía no
 * está pintada en el momento de medir, y ahí el abanico —que está pegado,
 * en la misma línea— deja la carta cerca en vez de tirarla al centro. */
function destinoDe(carta) {
  return carta.type === CARD.DEFENSE
    ? medir(".f-defensas") ?? medir(".hand-fan")
    : medir(".hand-fan");
}

/* La carta que entrega una casilla de bonus: aparece grande en el medio,
 * se deja ver, y después baja hasta el abanico.
 *
 * Sólo la ve quien la ganó. Mostrársela al rival sería regalarle qué le
 * están por tirar, que es justo lo que el juego esconde hasta que la carta
 * se da vuelta.
 *
 * Va en dos pasos y no en un movimiento continuo: si saliera viajando
 * desde el primer cuadro no habría tiempo de leerla, y saber qué te tocó
 * es el sentido de mostrarla.
 */
const LECTURA_MS = ms("cartaGanada.lectura");
const VIAJE_MS = ms("cartaGanada.viaja");

export default function CardGained({ carta, onDone }) {
  const [fase, setFase] = useState("entra");
  /* De dónde sale y a dónde va, medidos los dos. El destino importa desde
     que el abanico dejó de vivir siempre en el mismo rincón: ahora se dibuja
     del lado de su dueño, y una animación que apunte a un punto fijo tira la
     carta al lado equivocado la mitad de las veces. */
  const [origen, setOrigen] = useState(null);
  const [destino, setDestino] = useState(null);

  /* onDone queda en una referencia y fuera de las dependencias.
     Llega como función nueva en cada pintado del padre, y el padre se
     vuelve a pintar cada dos segundos por el sondeo de la sala: teniéndola
     como dependencia, el efecto se reiniciaba solo, cancelaba sus propios
     temporizadores y la carta se quedaba clavada en el primer paso sin
     llegar nunca a viajar. */
  const terminar = useRef(onDone);
  terminar.current = onDone;

  useEffect(() => {
    if (!carta) return;
    /* Se mide en cada entrega y no una sola vez: entre una y otra pudo
       girarse el teléfono o cambiar el tamaño de la ventana. */
    setOrigen(medir(".bonus-deck"));
    setDestino(destinoDe(carta));
    setFase("entra");

    const a = setTimeout(() => setFase("viaja"), LECTURA_MS);
    const b = setTimeout(() => terminar.current?.(), LECTURA_MS + VIAJE_MS);

    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    /* Sólo la carta reinicia la secuencia: es lo único que significa "hay
       una entrega nueva que mostrar". */
  }, [carta]);

  if (!carta) return null;

  return (
    <div
      className={`card-gained ${fase}`}
      aria-live="polite"
      style={{
        ...(origen ? { "--mazo-x": `${origen.x}px`, "--mazo-y": `${origen.y}px` } : null),
        ...(destino ? { "--mano-x": `${destino.x}px`, "--mano-y": `${destino.y}px` } : null),
      }}
    >
      <div className={`card ${carta.type}`}>
        <CardFace carta={carta} />
      </div>
      <div className="card-gained-label">¡Carta nueva!</div>
    </div>
  );
}
