import { useState } from "react";
import { medir } from "../medir";
import { ms } from "../theme";

const ESCALON_MS = ms("apertura.escalon");

/* Las cartas saliendo del mazo hacia cada jugador, al abrir la partida.
 *
 * Van boca abajo y sin cara: lo que se cuenta acá es el REPARTO, no qué
 * tocó. Mostrar las caras además de ser información que no le corresponde
 * al rival, obligaría a esperar a que se lean — y esto tiene que sentirse
 * como un crupier tirando cartas, rápido.
 *
 * ►► El destino se mide, no se calcula. ◄◄
 * Cada jugador tiene su línea en un lado distinto de la mesa, y con cuatro
 * la grilla los reacomoda. Un punto fijo por jugador tira las cartas al
 * lado equivocado en cuanto cambia el tamaño de la ventana.
 *
 * Para el jugador de esta pantalla se apunta a su abanico; para los demás,
 * a su línea. No es asimetría por descuido: el abanico de los otros no
 * existe en el DOM —el juego esconde sus manos— así que no hay nada que
 * medir, y su línea es exactamente donde el jugador espera que vayan.
 */
export default function Reparto({ jugadores, porJugador, ladoMano }) {
  /* Se mide UNA vez, al montarse, y no en un efecto.
   *
   * Un efecto que llama a setState encadena un pintado extra: el componente
   * aparece vacío y recién al segundo cuadro sabe adónde van las cartas. En
   * una animación de 420ms ese cuadro se ve.
   *
   * Medir durante el pintado es seguro acá porque este componente se monta
   * 900ms después que la pantalla —cuando termina el cartel de las reglas—
   * así que el navegador ya resolvió el layout hace rato. En el primer
   * pintado de la mesa no lo sería. */
  const [vuelos] = useState(() => {
    const origen = medir(".bonus-deck");

    /* Adónde va cada jugador, medido una vez. */
    const destinos = [];
    for (let j = 0; j < jugadores; j++) {
      /* El abanico propio existe siempre —vacío durante la apertura— así
         que acá ya se puede medir y las cartas van a dónde van a quedar.
         Para los demás jugadores no hay abanico que medir: el juego esconde
         sus manos. Se apunta a su fila, que es donde el jugador las espera. */
      destinos[j] =
        (j === ladoMano ? medir(".hand-fan") : null) ??
        medir(`.fighter-linea.f${j + 1}`);
    }

    /* Intercalado por vuelta y no jugador por jugador: primero una carta a
       cada uno, después la segunda a cada uno. Es como se reparte de verdad,
       y de paso las cartas salen hacia lados distintos en vez de irse todas
       juntas al mismo rincón. */
    const orden = [];
    for (let c = 0; c < porJugador; c++) {
      for (let j = 0; j < jugadores; j++) {
        if (destinos[j]) orden.push(destinos[j]);
      }
    }

    return { origen, orden };
  });

  if (!vuelos?.orden.length) return null;

  return (
    <div className="reparto" aria-hidden="true">
      {vuelos.orden.map((v, i) => (
        <span
          key={i}
          className="carta-repartida"
          style={{
            /* El origen puede faltar si el mazo todavía no se dibujó; en ese
               caso las cartas salen del centro, que es de donde salen los
               valores de respaldo del CSS. */
            "--de-x": `${vuelos.origen?.x ?? 0}px`,
            "--de-y": `${vuelos.origen?.y ?? 0}px`,
            "--a-x": `${v.x}px`,
            "--a-y": `${v.y}px`,
            animationDelay: `${i * ESCALON_MS}ms`,
          }}
        >
          ?
        </span>
      ))}
    </div>
  );
}
