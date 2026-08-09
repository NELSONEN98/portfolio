import { useEffect, useRef, useState } from "react";

/* Cuenta desde el valor anterior hasta el nuevo.
 *
 * Devuelve el número que hay que mostrar y si viene bajando, que es lo que
 * la interfaz usa para pintarlo en rojo. No toca ningún nodo: en React
 * Native el mismo hook alimenta un <Text>.
 *
 * requestAnimationFrame existe en las dos plataformas, así que esto no es
 * un puente que haya que rehacer.
 */
export function useAnimatedNumber(target, { duracionMax = 620 } = {}) {
  const [shown, setShown] = useState(target);
  const [bajando, setBajando] = useState(false);
  /* Cuánto se perdió, guardado aparte: la referencia con el valor de
     partida ya fue pisada por el nuevo cuando la interfaz lee esto. */
  const [perdido, setPerdido] = useState(0);
  const desde = useRef(target);
  const frame = useRef(null);

  useEffect(() => {
    const from = desde.current;
    desde.current = target;

    if (from === target) {
      setShown(target);
      return;
    }

    const baja = target < from;
    setBajando(baja);
    if (baja) setPerdido(from - target);

    /* La duración sale de la distancia: sumar 3 no puede tardar lo mismo
       que sumar 40, o los saltos chicos se sienten pesados. */
    const dur = Math.min(140 + Math.abs(target - from) * 28, duracionMax);
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
        /* El rojo se sostiene un momento después de frenar: apagándolo con
           el último cuadro, quien no estaba mirando no llega a ver que
           bajó. */
        setTimeout(() => setBajando(false), 900);
      }
    };

    // Una tirada nueva puede llegar con la anterior todavía contando.
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paso);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duracionMax]);

  return { shown, bajando, perdido };
}
