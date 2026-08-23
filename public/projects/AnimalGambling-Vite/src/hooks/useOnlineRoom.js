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
/* ►► La sala, siempre en forma de asientos. ◄◄
 *
 * El servidor nuevo ya la devuelve así, pero el cliente y el backend se
 * despliegan con DOS comandos distintos —`publish:game` y `convex deploy`—
 * y por lo tanto nunca están sincronizados al segundo. En esa ventana el
 * cliente nuevo le pedía `players` a un servidor viejo, recibía `undefined`,
 * y la partida se quedaba esperando para siempre a que se sentaran dos
 * jugadores en una mesa que leía vacía.
 *
 * Que el arreglo viva ACÁ y no repartido por la pantalla es lo que importa:
 * es el único punto por donde entra una sala, así que del efecto de
 * sincronía para adentro nadie sabe que existieron dos formas. Es el mismo
 * criterio que los adaptadores del servidor, del otro lado del cable.
 *
 * Se puede borrar cuando el backend desplegado sea el nuevo y no quede
 * ninguna sala vieja viva — media hora después del despliegue. */
function enAsientos(sala) {
  if (!sala || sala.players?.length) return sala;

  const players = [sala.player1, sala.player2].filter(Boolean);
  const seat =
    typeof sala.seat === "number" ? sala.seat : sala.turn === "player2" ? 1 : 0;
  const winner =
    typeof sala.winner === "number"
      ? sala.winner
      : sala.winner === "player2"
        ? 1
        : sala.winner === "player1"
          ? 0
          : undefined;

  return { ...sala, players, seat, winner };
}

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
  /* La sala existía y dejó de existir.
   *
   * Antes esto no podía pasarle a nadie: en el vestíbulo había como mucho
   * un invitado, y la sala sólo se borraba cuando ese invitado no estaba.
   * Con mesas de cuatro el anfitrión puede cancelar con tres esperando, y
   * sin este aviso los tres se quedaban mirando un vestíbulo muerto que
   * seguía diciendo "faltan 1" para siempre.
   *
   * Es una BANDERA y no un `room: null`: la diferencia entre "todavía no
   * llegó" y "ya no está" es justamente lo que hay que contar. */
  const [cerrada, setCerrada] = useState(false);

  /* En qué asiento estás sentado. Se busca en la mesa en vez de preguntar
     "¿sos el primero? entonces 0, si no 1" — que era una respuesta binaria y
     por lo tanto una mesa de dos.
     El −1 de `findIndex` se convierte en 0 para el instante en que la sala
     todavía no llegó: cualquier otro valor haría que la pantalla se dibuje
     un cuadro con el asiento de otro. */
  const miLado = room
    ? Math.max(0, (room.players ?? []).findIndex((p) => p?.sessionId === getSessionId()))
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

    /* Null con sondeo vivo es una sala borrada: el anfitrión canceló o
       venció el TTL. Se corta acá — seguir sondeando algo que ya no existe
       es una petición cada dos segundos, para siempre, contra la nada. */
    if (!sala) {
      vivo.current = false;
      clearRoomId();
      setSala(null);
      setRoom(null);
      setCerrada(true);
      return;
    }

    /* Se normaliza al ENTRAR, no al usarse: así hay un solo lugar que
       conoce la forma vieja en vez de un `??` en cada lectura. */
    setRoom(enAsientos(sala));

    const ev = sala.lastEvent;
    if (ev && ev._id !== ultimoEvento.current) {
      const primera = ultimoEvento.current === null;
      ultimoEvento.current = ev._id;
      // Lo propio ya se mostró al hacerlo; lo viejo no se reproduce.
      if (!primera && ev.sessionId !== getSessionId()) setNovedad(ev);
    }

    setTimeout(() => sondear(id), SONDEO_MS);
  }, []);

  const observar = useCallback(
    (id) => {
      vivo.current = true;
      ultimoEvento.current = null;
      setCerrada(false);
      sondear(id);
    },
    [sondear]
  );

  /* Sin argumentos: la sala se abre al tope y la arranca el anfitrión. */
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

  /* Arrancar sin esperar a que se llene. El estado real vuelve por el
     sondeo, igual que todo lo demás: acá sólo se manda la intención. */
  const empezar = useCallback(async () => {
    const id = getRoomId();
    if (!id) return;
    try {
      await api.startRoom(id);
    } catch (e) {
      setError(e);
      throw e;
    }
  }, []);

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
    roomId, room, miLado, error, novedad, cerrada,
    crear, unirse, empezar, salir, consumirNovedad, detener,
    // Acciones que van al servidor; el estado real vuelve por el sondeo.
    setCharacter: api.setCharacter,
    playCard: api.playCard,
    takeBackCard: api.takeBackCard,
    rollDice: api.rollDice,
    holdScore: api.holdScore,
  };
}
