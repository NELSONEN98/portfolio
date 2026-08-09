import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../convex";
import { getSessionId, getRoomId, setRoomId, clearRoomId } from "../storage";
import { ms } from "../theme";

const SONDEO_MS = ms("red.sondeo");
const REINTENTO_MS = ms("red.reintento");

/* La sala online: la sondea, dice de qué lado estás y avisa lo que hizo el
   rival.
 *
 * Sondeo y no suscripción porque se usa ConvexHttpClient. El paso natural
 * es mover esto a ConvexClient, que trae reactividad de verdad; cuando eso
 * pase, cambia sólo este archivo y ningún componente se entera.
 *
 * Lo que devuelve son datos, no efectos: quién sos, cómo está la sala y qué
 * pasó desde la última mirada. Traducir eso a animaciones es de la capa de
 * arriba, que es la única que cambia entre web y móvil.
 */
export function useOnlineRoom() {
  const [roomId, setSala] = useState(() => getRoomId());
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  /* Última jugada ya vista de este lado: sin esto, cada sondeo repetiría la
     misma animación, y al entrar a una partida en curso se reproducirían de
     golpe todas las tiradas anteriores. */
  const ultimoEvento = useRef(null);
  const [novedad, setNovedad] = useState(null);
  const vivo = useRef(false);

  const miLado = room
    ? room.player1?.sessionId === getSessionId()
      ? 0
      : 1
    : 0;

  const detener = useCallback(() => {
    vivo.current = false;
  }, []);

  const sondear = useCallback(async (id) => {
    if (!vivo.current) return;
    let sala;
    try {
      sala = await api.getRoom(id);
    } catch (e) {
      /* Un fallo de red no es lo mismo que un fallo del consumidor: se
         espera más y se reintenta, sin tocar el estado. */
      console.error("Error sondeando la sala:", e);
      setTimeout(() => sondear(id), REINTENTO_MS);
      return;
    }

    if (!vivo.current) return;
    if (sala) {
      setRoom(sala);

      const ev = sala.lastEvent;
      if (ev && ev._id !== ultimoEvento.current) {
        const primera = ultimoEvento.current === null;
        ultimoEvento.current = ev._id;
        // Lo propio ya se mostró al hacerlo; lo viejo no se reproduce.
        if (!primera && ev.sessionId !== getSessionId()) setNovedad(ev);
      }
    }

    setTimeout(() => sondear(id), SONDEO_MS);
  }, []);

  const observar = useCallback(
    (id) => {
      vivo.current = true;
      ultimoEvento.current = null;
      sondear(id);
    },
    [sondear]
  );

  const crear = useCallback(async () => {
    try {
      const id = await api.createRoom();
      setRoomId(id);
      setSala(id);
      observar(id);
      return id;
    } catch (e) {
      setError(e);
      throw e;
    }
  }, [observar]);

  const unirse = useCallback(
    async (codigo) => {
      try {
        const id = await api.joinRoom(codigo);
        setRoomId(id);
        setSala(id);
        observar(id);
        return id;
      } catch (e) {
        setError(e);
        throw e;
      }
    },
    [observar]
  );

  const salir = useCallback(() => {
    const id = getRoomId();
    detener();
    clearRoomId();
    setSala(null);
    setRoom(null);
    ultimoEvento.current = null;
    // Sin await: la navegación no espera a la red.
    api.leaveRoom(id);
  }, [detener]);

  // Recargar la página no debería cortar el sondeo de una sala en curso.
  useEffect(() => {
    if (roomId && !vivo.current) observar(roomId);
    return detener;
  }, [roomId, observar, detener]);

  const consumirNovedad = useCallback(() => setNovedad(null), []);

  return {
    roomId, room, miLado, error, novedad,
    crear, unirse, salir, consumirNovedad, detener,
    // Acciones que van al servidor; el estado real vuelve por el sondeo.
    setCharacter: api.setCharacter,
    playCard: api.playCard,
    rollDice: api.rollDice,
    holdScore: api.holdScore,
  };
}
