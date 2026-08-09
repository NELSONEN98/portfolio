import { useCallback, useEffect, useRef, useState } from "react";

const VIDA_MS = 3200;

/* Avisos que entran, se van solos y no frenan nada.
 *
 * Reemplazan al alert() del navegador, que además de feo congela la
 * ejecución: en online eso detenía el sondeo de la sala mientras la caja
 * estuviera abierta.
 *
 * No toca el DOM, así que en React Native el mismo hook alimenta una vista
 * de avisos sin cambiarle una línea.
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (mensaje, tipo = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, mensaje, tipo }]);
      timers.current.set(id, setTimeout(() => dismiss(id), VIDA_MS));
      return id;
    },
    [dismiss]
  );

  // Los temporizadores no pueden sobrevivir al desmontaje.
  useEffect(() => {
    const pendientes = timers.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  return { toasts, notify, dismiss };
}

/* Los errores de Convex vienen como ConvexError con el texto en `data`; el
   resto trae `message`. Sin esto el jugador leía "[object Object]".
   Además, en producción Convex enmascara las excepciones comunes como
   "Server Error", que es por qué conviene que el backend use ConvexError. */
const CONOCIDOS = {
  "Room not found": "Esa sala no existe",
  "Room full or finished": "La sala ya está llena o terminó",
  "Game not active": "La partida ya terminó",
  "Not your turn": "No es tu turno",
  "You are not in this room": "Ya no estás en esta sala",
};

export function errorText(error) {
  const crudo = error?.data ?? error?.message ?? "Algo salió mal";
  const texto = typeof crudo === "string" ? crudo : JSON.stringify(crudo);
  return CONOCIDOS[texto] || texto;
}
