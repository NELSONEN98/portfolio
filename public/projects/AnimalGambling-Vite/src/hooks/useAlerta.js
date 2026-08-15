import { useCallback, useEffect, useRef, useState } from "react";
import { ms } from "../theme";

const VIDA_MS = ms("dado.quemado");

/* El cartel grande del medio de la pantalla.
 *
 * Es el hermano serio de los toasts: aquéllos entran por un costado y no
 * frenan nada, éste se planta en el centro y te obliga a leerlo. Se reserva
 * para lo que cambia el turno —te quemaste, perdiste la carta, la casa
 * invita—, no para información de fondo.
 *
 * ►► Van EN COLA, y ésa es la razón de que esto sea un hook. ◄◄
 *
 * Con un solo hueco, el segundo aviso pisaba al primero. No era teórico:
 * sacar un 1 y caer en un bonus con cerveza ocurre en la misma tirada, y
 * medido con los tiempos reales el "LA CASA INVITA" entraba a los 645ms
 * —un paso de ficha más la espera de casilla— cuando al "PIERDES TURNO" le
 * quedaban 755ms de vida. El jugador veía medio cartel y después otro, sin
 * llegar a leer ninguno de los dos.
 *
 * En cola se ven los dos enteros, uno atrás del otro. Cuesta que el par
 * tarde el doble, pero el momento en que esto pasa es justo cuando no hay
 * nada que decidir: el turno ya se quemó.
 *
 * No toca el DOM, así que en React Native el mismo hook alimenta una vista
 * nativa sin cambiarle una línea.
 *
 * `key` cambia en cada anuncio y no es decorativa: dos avisos iguales
 * seguidos tienen que reiniciar la animación, y sin algo que cambie React
 * reusa el nodo y el segundo no se ve.
 */
export function useAlerta() {
  const [cola, setCola] = useState([]);
  const timer = useRef(null);

  /* `tono` decide de qué color es el halo, no qué dice. Por defecto es una
     mala noticia porque ése era el único uso del cartel cuando nació, y
     porque las malas son las que más urge que se lean. */
  const anunciar = useCallback((texto, tono = "mala") => {
    setCola((prev) => [...prev, { texto, tono, key: Math.random() }]);
  }, []);

  const limpiar = useCallback(() => setCola([]), []);

  const actual = cola[0] ?? null;
  const turno = actual?.key;

  /* El temporizador se ata a la CLAVE del cartel en pantalla y no a la cola
     entera. Con la cola en las dependencias, cada aviso nuevo que se sumara
     al final reiniciaría la cuenta del que se está mostrando y lo dejaría
     más tiempo del que le toca — o para siempre, si siguen llegando. */
  useEffect(() => {
    if (!turno) return;
    timer.current = setTimeout(() => setCola((prev) => prev.slice(1)), VIDA_MS);
    return () => clearTimeout(timer.current);
  }, [turno]);

  return { alerta: actual, anunciar, limpiar };
}
