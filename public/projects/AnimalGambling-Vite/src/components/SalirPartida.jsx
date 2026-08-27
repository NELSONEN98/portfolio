import { useEffect, useRef, useState } from "react";

import { ms } from "../theme";

/* ►► LA PUERTA DE LA PARTIDA. ◄◄
 *
 * Hasta acá la pantalla de juego era la única de las cuatro sin salida: el
 * vestíbulo, la elección de gato y el final tenían su "volver", y la partida
 * no tenía ninguna. Mientras todo sale bien no se nota; el problema aparece
 * cuando algo se traba.
 *
 * Y trabarse es posible. El reloj de turno lo hace cumplir el navegador del
 * que está jugando, así que si esa persona cierra la pestaña, su turno no
 * vence nunca —el servidor no tiene reloj— y la mesa queda esperando. Cerrar
 * la pestaña tampoco suelta el asiento: no hay `beforeunload` en el proyecto.
 * Y como el código de sala vive en `sessionStorage`, recargar devuelve a la
 * MISMA mesa trabada.
 *
 * Sumado, el modo de falla no era "la mesa espera": era "la mesa espera y
 * nadie se puede ir", con la única salida real a los treinta minutos, cuando
 * vence la sala. Este botón no arregla la causa —eso es vigilancia del lado
 * del servidor, que se decidió no hacer todavía— pero convierte media hora
 * en un clic. Para un demo, una puerta vale más que un reloj.
 *
 * ►► Dos toques, y no un cartel de confirmación. ◄◄
 *
 * Un botón que abandona la partida no puede irse con un dedo distraído, pero
 * un modal encima de la mesa es una ventana que hay que construir, atrapar el
 * foco y cerrar con Escape — todo para una pregunta de una palabra.
 *
 * Con dos toques la confirmación ES el botón: el primero lo arma y lo pinta
 * de rojo, el segundo sale. Y se desarma solo a los tres segundos, que es lo
 * mejor de todo: el toque equivocado se deshace sin que el jugador haga
 * nada.
 */
export default function SalirPartida({ onSalir }) {
  const [armado, setArmado] = useState(false);
  const timer = useRef(null);

  /* El desarmado cuelga de `armado` y no de un temporizador suelto: si el
     componente se desmonta con el botón armado —porque la partida terminó
     sola mientras el jugador dudaba— la limpieza del efecto cancela la
     cuenta. Un `setTimeout` suelto seguiría vivo y escribiría estado sobre
     un componente que ya no está. */
  useEffect(() => {
    if (!armado) return undefined;
    timer.current = setTimeout(() => setArmado(false), ms("boton.confirmar"));
    return () => clearTimeout(timer.current);
  }, [armado]);

  return (
    <button
      className={`salir-partida${armado ? " armado" : ""}`}
      /* El rótulo cambia con el estado y no es adorno: quien navega con
         lector de pantalla tiene que oír que el primer toque no lo sacó de
         la partida, sino que dejó el botón esperando el segundo. */
      aria-label={armado ? "Confirmar: salir de la partida" : "Salir de la partida"}
      title={armado ? "Toca otra vez para salir" : "Salir de la partida"}
      onClick={() => (armado ? onSalir?.() : setArmado(true))}
    >
      {armado ? "¿SALIR?" : "✕"}
    </button>
  );
}
