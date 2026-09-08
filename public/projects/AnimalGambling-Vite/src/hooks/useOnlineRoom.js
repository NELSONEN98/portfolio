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
  /* Los eventos ajenos que llegaron y todavía no se mostraron. Es una cola
     y no un solo valor porque un sondeo puede traer varios de golpe, y
     `App` los anima de a uno. */
  const cola = useRef([]);
  /* Si ya llegó la primera respuesta del sondeo. Separa "todavía no miré"
     de "no hay eventos" — ver el comentario en `sondear`. */
  const sincronizado = useRef(false);
  /* Espejo de `novedad`: dice si `App` tiene una sin consumir. Va en un ref
     porque el sondeo vive en un `useCallback([])` y no ve el estado. */
  const hayNovedad = useRef(false);
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

    /* ►► TODOS los eventos nuevos, no sólo el último. ◄◄
     *
     * Acá se leía `sala.lastEvent` —uno solo— y se descartaba en silencio
     * todo lo que hubiera pasado antes en la ventana de sondeo. El emoji
     * era el que lo pagaba: es el único evento que no deja huella en ningún
     * otro campo de la sala, así que perdido el evento no hay de dónde
     * reconstruirlo. Cualquier tirada en los mismos dos segundos se lo
     * comía, y se tira un emoji justo porque acaba de pasar algo.
     *
     * Ahora llegan los últimos doce en orden y se reproduce lo que falte.
     * `lastEvent` de respaldo: si el backend todavía no tiene el despliegue
     * nuevo, esto sigue funcionando como antes en vez de romperse. */
    const llegados = Array.isArray(sala.lastEvents)
      ? sala.lastEvents
      : sala.lastEvent
        ? [sala.lastEvent]
        : [];

    /* Se marca ACA, fuera del `if`: sincronizarse es haber recibido una
       respuesta, con eventos o sin ellos. Adentro del `if` una sala recien
       creada —que sondea vacia varias veces— nunca se marcaba, y entonces
       su primer lote real seguia contando como "pasada de sincronizacion" y
       se descartaba. Es el mismo bug una capa mas adentro. */
    const primera = !sincronizado.current;
    sincronizado.current = true;

    if (llegados.length) {
      /* ►► "Primera pasada" es del SONDEO, no del primer evento. ◄◄
       *
       * Acá decía `ultimoEvento.current === null`, y eso confunde dos cosas
       * distintas: "todavía no miré la sala" con "la sala todavía no tuvo
       * eventos". Si alguien entra a una mesa recién creada, sondea varias
       * veces sin eventos, y recién ahí pasa algo, el cursor sigue en null
       * y ese primer lote se descartaba ENTERO — que es justo el caso de un
       * emoji al principio de la partida.
       *
       * Con una bandera propia, la pasada de sincronización es la primera
       * respuesta que llega, tenga eventos o no. De ahí en adelante todo lo
       * nuevo se reproduce. */
      const visto = llegados.findIndex((e) => e._id === ultimoEvento.current);

      /* ►► Si el último visto ya no está en la ventana, se toma UNO. ◄◄
       *
       * Pasa cuando la pestaña estuvo dormida o la red se cayó un rato: se
       * acumularon más de doce y no hay forma de saber cuáles se vieron.
       * Reproducir los doce de golpe dispararía una tanda de animaciones de
       * cosas que ya pasaron —el jugador vería tiradas viejas encimadas—,
       * así que se toma sólo la última y se sigue desde ahí. Perder
       * animaciones viejas es mejor que mostrarlas todas juntas y fuera de
       * tiempo. */
      const nuevos =
        /* Sin cursor y ya sincronizados: no vimos NINGUNO, así que van
           todos. Sin este caso, un lote que llega cuando el cursor está en
           null se recortaba al último y el emoji se perdía igual que
           antes — con el agravante de que ahora sí había llegado. */
        ultimoEvento.current === null
          ? llegados
          : visto >= 0
            ? llegados.slice(visto + 1)
            : llegados.slice(-1);

      ultimoEvento.current = llegados[llegados.length - 1]._id;

      /* Lo propio ya se mostró al hacerlo; lo viejo no se reproduce. */
      if (!primera) {
        const mia = getSessionId();
        const ajenos = nuevos.filter((e) => e.sessionId !== mia);
        if (ajenos.length) {
          cola.current.push(...ajenos);
          /* ►► El `shift()` va AFUERA del `setNovedad`. ◄◄
           *
           * Acá decía `setNovedad((actual) => actual ?? cola.current.shift())`
           * y se comía el emoji en silencio. El motivo: ese updater MUTA la
           * cola, y React puede llamarlo más de una vez — `main.jsx` monta en
           * StrictMode, que lo hace a propósito para destapar justamente
           * esto. La primera pasada sacaba el emoji y devolvía el emoji; la
           * segunda encontraba la cola vacía y devolvía null, y null es lo
           * que quedaba. El evento llegaba, se reconocía como ajeno, se
           * encolaba... y desaparecía en el `setState`.
           *
           * Un updater tiene que ser una función pura de su argumento. Si
           * hay algo que mutar, se muta afuera y se pasa el resultado.
           *
           * `hayNovedad` es el espejo de `novedad` en un ref, porque el
           * estado no se puede leer desde este callback —está congelado en
           * el `useCallback([])`— y hace falta saber si `App` todavía tiene
           * una sin mirar para no pisársela. */
          if (!hayNovedad.current) {
            const siguiente = cola.current.shift() ?? null;
            hayNovedad.current = siguiente !== null;
            setNovedad(siguiente);
          }
        }
      }
    }

    setTimeout(() => sondear(id), SONDEO_MS);
  }, []);

  const observar = useCallback(
    (id) => {
      vivo.current = true;
      ultimoEvento.current = null;
      cola.current = [];
      sincronizado.current = false;
      hayNovedad.current = false;
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

  /* Volver a jugar sin cambiar de sala. Va acá y no como una llamada suelta
     desde la pantalla final por lo mismo que `empezar`: si falla, el error
     tiene que quedar en el hook —que es quien lo sabe mostrar— y no perderse
     en un `catch` de un componente que no tiene dónde ponerlo. */
  const revancha = useCallback(async () => {
    const id = getRoomId();
    if (!id) return;
    try {
      await api.rematchRoom(id);
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
    sincronizado.current = false;
    hayNovedad.current = false;
    /* La cola se vacia con el cursor. Si quedaran eventos de la sala que se
       acaba de dejar, se reproducirian encima de la proxima partida. */
    cola.current = [];
    // Sin await: la navegación no espera a la red.
    api.leaveRoom(id);
  }, [detener]);

  // Recargar la página no debería cortar el sondeo de una sala en curso.
  useEffect(() => {
    if (roomId && !vivo.current) observar(roomId);
    return detener;
  }, [roomId, observar, detener]);

  /* Al consumir se entrega el SIGUIENTE de la cola en vez de dejar en
     null: si no, un sondeo que trajo tres eventos mostraria uno y perderia
     dos, que es el mismo bug con otra forma. */
  const consumirNovedad = useCallback(() => {
    /* Mismo cuidado que arriba: se saca de la cola ACÁ y se pasa el valor
       ya resuelto, nunca dentro del updater. */
    const siguiente = cola.current.shift() ?? null;
    hayNovedad.current = siguiente !== null;
    setNovedad(siguiente);
  }, []);

  return {
    roomId, room, miLado, error, novedad, cerrada,
    crear, unirse, empezar, revancha, salir, consumirNovedad, detener,
    // Acciones que van al servidor; el estado real vuelve por el sondeo.
    setCharacter: api.setCharacter,
    playCard: api.playCard,
    takeBackCard: api.takeBackCard,
    rollDice: api.rollDice,
    holdScore: api.holdScore,
    sendEmoji: api.sendEmoji,
  };
}
