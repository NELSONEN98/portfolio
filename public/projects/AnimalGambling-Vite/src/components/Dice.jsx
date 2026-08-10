import { useEffect, useRef } from "react";
import { crearEscena } from "../dice3d/escena";
import { ms } from "../theme";

/* El dado.
 *
 * Conserva la misma interfaz que tenía el cubo de CSS —`tirada`,
 * `esperando`, `onSettle`, `puedeTirar`— justamente para que cambiar cómo
 * se dibuja no obligue a tocar la pantalla ni el motor. Lo único que sabe
 * el resto del juego es que se le pasa una tirada y en algún momento avisa
 * que terminó.
 *
 * El número NO sale de acá. Lo decide resolveRoll() en local y el servidor
 * en online; este componente sólo se encarga de que los cubos terminen
 * mostrándolo.
 *
 * Hay dos formas de tirar y las dos terminan en el mismo lugar:
 *   · el botón, que lanza con el tiro de siempre;
 *   · agarrar el dado y arrojarlo, que además le pasa a la simulación la
 *     dirección y la fuerza de tu mano.
 */

/* Cuánto se espera como mucho antes de dar la tirada por vista. La escena
   avisa cuando los cubos frenaron de verdad, pero el turno no puede quedar
   colgado si por lo que sea ese aviso no llega. */
const TOPE_MS = ms("dado.esperaTirada") + 2600;

export default function Dice({ tirada, esperando, dobles, onSettle, onRoll, puedeTirar }) {
  const lienzo = useRef(null);
  const escena = useRef(null);
  const settle = useRef(onSettle);
  settle.current = onSettle;
  const tirar = useRef(onRoll);
  tirar.current = onRoll;
  const puede = useRef(puedeTirar);
  puede.current = puedeTirar;

  /* Si ya se avisó por esta tirada. Los cubos pueden frenar justo cuando
     vence el tope, y sin esto el turno avanzaría dos veces. */
  const avisado = useRef(false);
  /* El impulso del último lanzamiento a mano, esperando a que llegue el
     valor. En local llega en el mismo instante; en online, después de la
     red. */
  const impulso = useRef(null);
  /* Si el puntero está arrastrando un cubo. */
  const arrastrando = useRef(false);

  useEffect(() => {
    if (!lienzo.current) return;
    escena.current = crearEscena(lienzo.current);
    escena.current.redimensionar();
    escena.current.setCantidad(1);

    const alRedimensionar = () => escena.current?.redimensionar();
    window.addEventListener("resize", alRedimensionar);
    return () => {
      window.removeEventListener("resize", alRedimensionar);
      escena.current?.destruir();
      escena.current = null;
    };
  }, []);

  /* Con la carta de dos dados hay dos cubos en la mesa antes de tirar: que
     se vean esperando es lo que anuncia que la carta está activa. */
  useEffect(() => {
    escena.current?.setCantidad(dobles ? 2 : 1);
  }, [dobles]);

  useEffect(() => {
    if (!tirada || !escena.current) return;
    avisado.current = false;

    const listo = () => {
      if (avisado.current) return;
      avisado.current = true;
      settle.current?.(tirada);
    };

    /* Si la tirada viene de un lanzamiento a mano, la simulación busca un
       tiro que salga hacia donde apuntaste. Con el botón no hay impulso y
       el tiro es el de siempre. */
    const gesto = impulso.current;
    impulso.current = null;

    escena.current.lanzar(tirada.dice, listo, gesto);
    const tope = setTimeout(listo, TOPE_MS);
    return () => clearTimeout(tope);
  }, [tirada]);

  /* En online la respuesta del servidor tarda. Los cubos se tiran igual con
     valores de mentira para que el gesto tenga respuesta inmediata; cuando
     llega el resultado real, el efecto de arriba los vuelve a lanzar con
     los valores buenos. */
  useEffect(() => {
    if (!esperando || !escena.current) return;
    const cuantos = dobles ? 2 : 1;
    const provisorios = Array.from({ length: cuantos }, () => 1 + Math.floor(Math.random() * 6));
    escena.current.lanzar(provisorios, null, impulso.current);
  }, [esperando, dobles]);

  /* ─── el gesto ──────────────────────────────────────────────────────
     El lienzo cubre toda la mesa, así que hay que distinguir "agarré el
     dado" de "toqué el fieltro". La escena responde si el punto cayó sobre
     un cubo, y sólo entonces se captura el puntero: si no, el toque sigue
     su camino hacia lo que haya debajo. */
  const alApretar = (e) => {
    if (!puede.current || !escena.current) return;
    if (!escena.current.agarrar(e.clientX, e.clientY)) return;
    arrastrando.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const alMover = (e) => {
    if (!arrastrando.current) return;
    escena.current?.arrastrar(e.clientX, e.clientY);
  };

  const alSoltar = () => {
    if (!arrastrando.current) return;
    arrastrando.current = false;

    const gesto = escena.current?.soltar();
    /* Soltar el dado siempre lo tira, aunque el gesto haya sido lentísimo o
       un simple toque: la escena se encarga de darle fuerza mínima. Dejarlo
       quieto donde lo soltaste lo convertiría en una ficha que se acomoda a
       mano, y un dado no se acomoda. */
    if (!gesto || !puede.current) return;

    impulso.current = gesto;
    tirar.current?.();
  };

  return (
    <div
      className={`dice-arena-3d${puedeTirar ? " tirable" : ""}`}
      role={puedeTirar ? "button" : undefined}
      tabIndex={puedeTirar ? 0 : undefined}
      aria-label={puedeTirar ? "Tirar el dado" : undefined}
      onPointerDown={alApretar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onKeyDown={(e) => {
        if (!puedeTirar) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRoll?.();
        }
      }}
    >
      <canvas ref={lienzo} className="dice-canvas" />
    </div>
  );
}
