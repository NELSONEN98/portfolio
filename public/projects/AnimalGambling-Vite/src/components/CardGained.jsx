import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!carta) return;
    setFase("entra");

    const a = setTimeout(() => setFase("viaja"), LECTURA_MS);
    const b = setTimeout(() => onDone?.(), LECTURA_MS + VIAJE_MS);

    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [carta, onDone]);

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
