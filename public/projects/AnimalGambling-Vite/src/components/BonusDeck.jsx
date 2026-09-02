import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ms } from "../theme";

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

/* El mismo umbral que separa el toque del mantener en las cartas de la mano.
   Sale de ahí y no de un número nuevo: si algún día se ajusta el gesto, se
   ajusta en un solo lugar y los dos se mueven juntos. */
const MANTENER_MS = ms("cartaMano.mantenerHueco");

/* Qué es este mazo, dicho como lo dicen las cartas: una frase, sin rodeos y
   sin nombrar la mecánica dos veces. Vive acá y no en `rules.ts` porque no es
   una carta — es el sitio de donde salen. */
const QUE_ES =
  "De acá sale una carta cada vez que caes en una casilla de bonus. Cuál te toca no se sabe hasta que llega";

export default function BonusDeck({ entregando }) {
  /* ►► Abierta se guarda acá y no arriba. ◄◄
   *
   * Nadie más necesita saber que el mazo está siendo mirado: no cambia el
   * turno, no cambia la mesa, no viaja por la red. Subirlo a `VersusScreen`
   * sería un estado más que mantener al día a cambio de nada. */
  const [abierta, setAbierta] = useState(false);
  /* Cuándo se apoyó el dedo. Es lo único que hace falta para distinguir el
     toque del mantener, y va en un ref porque no se dibuja. */
  const desde = useRef(0);

  const cerrar = useCallback(() => setAbierta(false), []);

  /* Soltar cierra SÓLO si fue un mantener. El toque corto la deja trabada, y
     de bajarla se encarga el toque siguiente. */
  const alSoltar = useCallback(() => {
    if (Date.now() - desde.current >= MANTENER_MS) setAbierta(false);
  }, []);

  /* ►► Se cierra desde la VENTANA, no desde el mazo. ◄◄
   *
   * Es la misma lección que dejó escrita la vista previa de la mano: si el
   * cierre cuelga sólo del elemento, basta con que el puntero se suelte en
   * otro lado —o que el componente se vuelva a dibujar en el medio— para que
   * la ampliación quede clavada en la pantalla sin nadie que la baje.
   *
   * Y engancha `pointerdown` además de `pointerup`: con la previa trabada por
   * un toque corto, lo que la baja es el siguiente toque, caiga donde caiga.
   *
   * ►► El `pointerup` de la ventana pregunta; no cierra a ciegas. ◄◄
   *
   * Primero cerraba siempre, y eso le ganaba a la regla del toque corto: la
   * previa se abría con el `pointerdown` y el `pointerup` de ese mismo toque
   * la bajaba en el acto — medido, el toque no trababa nada. La ventana tiene
   * que aplicar la MISMA regla que el mazo, no una propia; si no, el gesto
   * queda decidido por quién escuchó primero. */
  useEffect(() => {
    if (!abierta) return undefined;
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", cerrar);
    window.addEventListener("pointerdown", cerrar);
    return () => {
      window.removeEventListener("pointerup", alSoltar);
      window.removeEventListener("pointercancel", cerrar);
      window.removeEventListener("pointerdown", cerrar);
    };
  }, [abierta, cerrar, alSoltar]);

  /* ►► Un toque la deja puesta; sostener la muestra mientras dure. ◄◄
   *
   * Los dos gestos abren, y lo que cambia es cuándo se cierra. Sostener es
   * "mostrámela un momento" y se cierra al soltar; el toque corto es
   * "quiero leerla" y se queda hasta el siguiente toque.
   *
   * El listener de la ventana se monta recién cuando `abierta` pasa a
   * verdadero, o sea DESPUÉS de este `pointerdown` — así que este mismo toque
   * no la cierra al vuelo. Es un detalle del orden de React que conviene que
   * quede escrito: mover el listener a un `addEventListener` suelto acá
   * adentro rompería justo eso. */
  const apoyar = (e) => {
    e.stopPropagation();
    desde.current = Date.now();
    setAbierta(true);
  };

  return (
    <>
      {/* Un botón de verdad y no un div con manejadores: se llega con el
          tabulador y se abre con Enter, igual que las cartas de la mano. Deja
          de ser `aria-hidden` justamente porque ahora hace algo — esconderle a
          un lector de pantalla un control que existe es peor que no tenerlo. */}
      <button
        type="button"
        className={`bonus-deck${entregando ? " entregando" : ""}`}
        aria-label="Mazo de bonus — mantén apretado para ver qué es"
        title="Mazo de bonus"
        onPointerDown={apoyar}
        onPointerCancel={cerrar}
        /* La jugada la decide el gesto, igual que en la mano. */
        onClick={(e) => e.preventDefault()}
        /* Y el menú del navegador tampoco: sostener es NUESTRO gesto. */
        onContextMenu={(e) => e.preventDefault()}
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
      </button>

      {/* ►► La ampliación se dibuja en el BODY. ◄◄
       *
       * Mismo motivo que la de la mano: `.card-preview` es `position: fixed`,
       * y basta un `transform` o una `perspective` en cualquier ancestro para
       * que `fixed` deje de significar "la pantalla" y pase a significar "esa
       * caja". Acá arriba hay las dos —el fieltro y la arena del dado—, así
       * que colgarla del `body` no es precaución: es la única forma de que se
       * dibuje del tamaño que dice su propia regla. */}
      {abierta &&
        createPortal(
          <div className="card-preview" aria-hidden="true">
            {/* Se dibuja el REVERSO y no una carta cualquiera: el mazo está
                boca abajo y mostrar una carta concreta prometería saber cuál
                sale, que es exactamente lo que el juego no sabe. */}
            <div className="card bonus-mazo">?</div>
            <p className="card-preview-hint">{QUE_ES}</p>
          </div>,
          document.body
        )}
    </>
  );
}
