
/* El mazo del que salen las cartas de bonus, al lado del dado.
 *
 * No tiene lógica ni cuenta cartas: el mazo del juego es infinito —la
 * casilla de bonus sortea una nueva cada vez— así que mostrar un número
 * sería inventar una regla que no existe. Está para dar un origen visible a
 * la entrega: antes la carta aparecía en el medio de la pantalla salida de
 * la nada, y ahora se ve de dónde vino.
 *
 * Tres cartas y no una: una sola se leería como una carta olvidada sobre el
 * fieltro, y tres dicen "mazo" sin necesidad de rótulo.
 */
export default function BonusDeck({ entregando }) {
  return (
    <div
      className={`bonus-deck${entregando ? " entregando" : ""}`}
      aria-hidden="true"
      title="Mazo de bonus"
    >
      {[0, 1, 2].map((i) => (
        <span className="bonus-deck-card" key={i} style={{ "--i": i }}>
          {/* Sólo la de arriba lleva la marca: en las de abajo apenas asoma
              el borde, y un dibujo recortado se vería como suciedad.

              Una carta dentro de la carta, con un signo de pregunta: dice
              "acá hay una carta y no sabés cuál" sin depender de que el
              jugador reconozca un ícono. */}
          {i === 2 ? <span className="bonus-deck-mark">?</span> : null}
        </span>
      ))}
    </div>
  );
}
