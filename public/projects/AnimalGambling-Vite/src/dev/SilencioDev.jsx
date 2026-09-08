import { useState } from "react";
import { silenciar } from "../audio/player";
import { guardarAjuste } from "../storage";
import { CLAVE, silencioDeDesarrollo } from "./silencio";

/* ►► EL BOTÓN DE SILENCIO DEL QUE DESARROLLA. ◄◄
 *
 * Nada de esto llega al juego publicado: se monta detrás de
 * `import.meta.env.DEV` en `main.jsx`, así que el bundler se lo lleva
 * entero al construir.
 *
 * ►► Por qué existe: el HMR recarga, y con el HMR vuelve la música. ◄◄
 *
 * Cada guardado de un archivo recarga la página, y cada recarga pasa por
 * el preloader, que arranca la música. Quien está ajustando un `clamp` y
 * guarda cuarenta veces seguidas escucha la misma pista empezar cuarenta
 * veces. Eso no es un detalle de comodidad: es la clase de fricción que
 * hace que alguien deje de verificar sus cambios en el navegador.
 *
 * ►► Y por qué NO reusa el ajuste `mute` del jugador. ◄◄
 *
 * `mute` es una preferencia de quien JUEGA y el juego ya la respeta. Si
 * este botón la escribiera, apagar la música para trabajar dejaría el
 * juego mudo para el que lo abra después en este navegador — y peor, al
 * revés: el día que alguien pruebe el juego de verdad y le suba el sonido,
 * el silencio de desarrollo se perdería sin aviso.
 *
 * Con una clave propia las dos cosas conviven: `devMute` gana mientras se
 * está desarrollando, `mute` sigue diciendo lo que el jugador quiso, y en
 * producción `devMute` no lo lee nadie porque este archivo no está.
 */

export default function SilencioDev() {
  const [mudo, setMudo] = useState(() => silencioDeDesarrollo());

  function alternar() {
    const nuevo = !mudo;
    setMudo(nuevo);
    guardarAjuste(CLAVE, nuevo);
    /* El player se entera AHORA y no en la próxima recarga: apagar la
       música tiene que cortar la que está sonando, no la siguiente.
       `persistir: false` es lo que impide que esto escriba `ag:mute` — el
       estado de este botón ya quedó guardado arriba, en su propia clave. */
    silenciar(nuevo, { persistir: false });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={mudo ? "Silencio de desarrollo ACTIVO — clic para oír" : "Silenciar mientras desarrollo"}
      aria-label={mudo ? "Quitar el silencio de desarrollo" : "Silenciar la música mientras desarrollo"}
      aria-pressed={mudo}
      style={{
        position: "fixed",
        /* Abajo a la izquierda: arriba a la derecha vive el botón de reglas
           y abajo al centro los de tirar. Ésta es la única esquina que el
           juego no usa en ninguna pantalla. */
        left: 12,
        bottom: 12,
        zIndex: 2147483647,
        width: 44,
        height: 44,
        display: "grid",
        placeItems: "center",
        fontSize: 20,
        lineHeight: 1,
        cursor: "pointer",
        borderRadius: 10,
        border: `2px solid ${mudo ? "#ff5a5a" : "rgba(255,255,255,.35)"}`,
        background: mudo ? "rgba(60,0,0,.85)" : "rgba(0,0,0,.6)",
        color: mudo ? "#ff9a9a" : "#e8e1cc",
        /* Estilos en línea y no en `style.css` a propósito: esta cosa no es
           parte del juego, y una clase suya en la hoja de estilos sería una
           regla que alguien tiene que acordarse de borrar el día que esto
           se vaya. Acá se va con el archivo. */
        backdropFilter: "blur(4px)",
      }}
    >
      {mudo ? "🔇" : "🔊"}
    </button>
  );
}
