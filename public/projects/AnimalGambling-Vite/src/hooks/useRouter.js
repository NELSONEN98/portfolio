import { useCallback, useEffect, useState } from "react";

export const ROUTES = ["title", "menu", "room-choice", "select", "game", "gameover"];

/* Navegación por hash.
 *
 * El hash y no un router de verdad porque el juego se sirve como archivos
 * estáticos: cualquier ruta con barra daría 404 al recargar.
 *
 * En React Native no hay URL, así que este hook se reemplaza por el
 * navigator de turno. Es el único de los cuatro que no viaja — y por eso
 * la pantalla actual se expone como un string simple: cambiar de motor de
 * navegación no debería obligar a tocar ningún componente.
 */
function rutaDelHash() {
  const r = (location.hash || "").replace(/^#\/?/, "");
  return ROUTES.includes(r) ? r : "title";
}

export function useRouter({ puedeEntrar }) {
  const [screen, setScreen] = useState(rutaDelHash);

  const go = useCallback((destino) => {
    /* El guardia decide si esa pantalla tiene sentido ahora: entrar a
       #/game escribiendo la URL, sin jugadores elegidos, reventaba. */
    const permitido = puedeEntrar ? puedeEntrar(destino) : destino;
    if (location.hash === `#/${permitido}`) {
      setScreen(permitido);
      return;
    }
    location.hash = `#/${permitido}`;
  }, [puedeEntrar]);

  useEffect(() => {
    const alCambiar = () => {
      const pedida = rutaDelHash();
      const permitida = puedeEntrar ? puedeEntrar(pedida) : pedida;
      if (pedida !== permitida) {
        // replace y no assign: así el botón atrás no rebota entre las dos.
        location.replace(`#/${permitida}`);
        return;
      }
      setScreen(permitida);
    };
    window.addEventListener("hashchange", alCambiar);
    alCambiar();
    return () => window.removeEventListener("hashchange", alCambiar);
  }, [puedeEntrar]);

  return { screen, go };
}
