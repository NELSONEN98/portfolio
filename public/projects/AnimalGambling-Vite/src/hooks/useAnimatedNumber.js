import { useEffect, useRef, useState } from "react";
import { ms } from "../theme";

/* Cuenta desde el valor anterior hasta el nuevo.
 *
 * Devuelve el número que hay que mostrar y si viene bajando, que es lo que
 * la interfaz usa para pintarlo en rojo. No toca ningún nodo: en React
 * Native el mismo hook alimenta un <Text>.
 *
 * requestAnimationFrame existe en las dos plataformas, así que esto no es
 * un puente que haya que rehacer.
 */
export function useAnimatedNumber(target, { duracionMax = ms("numero.conteoMax") } = {}) {
  const [shown, setShown] = useState(target);
  const [bajando, setBajando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  /* Cuánto cambió, CON SIGNO y guardado aparte: la referencia con el valor
     de partida ya fue pisada por el nuevo cuando la interfaz lee esto.
     Antes sólo se anotaba lo perdido, y por eso el marcador podía explicar
     por qué bajaba pero no por qué subía — un bonus de vuelta o un robo a
     favor movían el número sin decir de dónde salía. */
  const [delta, setDelta] = useState(0);
  const desde = useRef(target);
  const frame = useRef(null);
  /* El apagador de las banderas, guardado para poder cancelarlo.
   *
   * ►► No tenerlo era un bug, y de los que no se ven leyendo. ◄◄
   *
   * Cada cambio programaba su apagado a 900ms y nadie cancelaba el del
   * cambio anterior. Con dos movimientos seguidos —acumular y enseguida
   * plantarse, que es la secuencia MÁS común del juego— el apagador viejo
   * caía en la mitad del conteo nuevo y bajaba `bajando` y `subiendo`
   * mientras el número todavía se estaba moviendo.
   *
   * De ahí salían dos síntomas que parecían no tener nada que ver: el rojo
   * del marcador se apagaba antes de tiempo al recibir un golpe poco
   * después de acumular, y la cifra del cambio aparecía a mitad de un
   * volcado que tenía que quedarse callado.
   *
   * El `cancelAnimationFrame` de más abajo ya cuidaba el conteo; faltaba
   * cuidar la cola. */
  const apagado = useRef(null);

  useEffect(() => {
    const from = desde.current;
    desde.current = target;

    if (from === target) {
      setShown(target);
      return;
    }

    const baja = target < from;
    setBajando(baja);
    setSubiendo(!baja);
    setDelta(target - from);

    /* La duración sale de la distancia: sumar 3 no puede tardar lo mismo
       que sumar 40, o los saltos chicos se sienten pesados. */
    const dur = Math.min(
      ms("numero.conteoBase") + Math.abs(target - from) * ms("numero.conteoPorPunto"),
      duracionMax
    );
    const t0 = performance.now();

    const paso = (ahora) => {
      const p = Math.min((ahora - t0) / dur, 1);
      // easeOutCubic: sale rápido y frena encima del número final
      const suavizado = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * suavizado));

      if (p < 1) {
        frame.current = requestAnimationFrame(paso);
      } else {
        setShown(target);
        /* El color se sostiene un momento después de frenar: apagándolo con
           el último cuadro, quien no estaba mirando no llega a ver que se
           movió.
           Las dos banderas se bajan juntas y no cada una por su lado: son
           excluyentes por construcción —un cambio sube o baja— y apagarlas
           en dos lugares distintos deja la puerta abierta a que se pisen
           cuando llega un cambio nuevo con el anterior todavía vivo. */
        apagado.current = setTimeout(() => {
          setBajando(false);
          setSubiendo(false);
        }, 900);
      }
    };

    // Una tirada nueva puede llegar con la anterior todavía contando.
    if (frame.current) cancelAnimationFrame(frame.current);
    if (apagado.current) clearTimeout(apagado.current);
    frame.current = requestAnimationFrame(paso);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (apagado.current) clearTimeout(apagado.current);
    };
  }, [target, duracionMax]);

  return { shown, bajando, subiendo, delta };
}
