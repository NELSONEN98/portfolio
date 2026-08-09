import { useEffect, useRef, useState } from "react";
import { CardFace } from "./Hand";

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
const LECTURA_MS = 900;
const VIAJE_MS = 520;

export default function CardGained({ carta, onDone }) {
  const [fase, setFase] = useState("entra");

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
    <div className={`card-gained ${fase}`} aria-live="polite">
      <div className={`card ${carta.type}`}>
        <CardFace carta={carta} />
      </div>
      <div className="card-gained-label">¡Carta nueva!</div>
    </div>
  );
}
