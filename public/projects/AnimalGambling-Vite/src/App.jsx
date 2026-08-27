import { useCallback, useEffect, useRef, useState } from "react";

import { useGame, newPlayer, newPlayers } from "./hooks/useGame";
import { useRouter } from "./hooks/useRouter";
import { useToasts, errorText } from "./hooks/useToasts";
import { useAlerta } from "./hooks/useAlerta";
import { useOnlineRoom } from "./hooks/useOnlineRoom";
import { ROSTER, charFromCatId, warmRosterFrames } from "./roster";
import { getRoomId } from "./storage";

/* ►► El código de sala que vino en el enlace, si vino alguno. ◄◄
 *
 * Va en la query y no en el hash porque el hash ya es del router: `useRouter`
 * lo compara contra su lista de rutas y cualquier cosa pegada ahí —
 * `#/room-choice?sala=X`— deja de coincidir y cae al título.
 *
 * Se lee una sola vez, al cargar el módulo. Después la URL se limpia, así
 * que preguntar más tarde daría null y la respuesta hay que guardarla. */
const INVITACION = (() => {
  try {
    const c = new URLSearchParams(location.search).get("sala");
    return c ? c.toUpperCase().trim() : null;
  } catch {
    return null;
  }
})();

import Preloader from "./components/Preloader";
import Toasts from "./components/Toasts";
import RulesModal from "./components/RulesModal";
import SalirPartida from "./components/SalirPartida";
import Alerta from "./components/Alerta";
import CardGained from "./components/CardGained";
import CardCast, { COLOR_IMPACTO } from "./components/CardCast";

import TitleScreen from "./screens/TitleScreen";
import MenuScreen from "./screens/MenuScreen";
import RoomChoiceScreen from "./screens/RoomChoiceScreen";
import SelectScreen from "./screens/SelectScreen";
import VersusScreen from "./screens/VersusScreen";
import GameOverScreen from "./screens/GameOverScreen";
import { CARD, SQUARE, targetOf, A_LA_DERECHA, vuelveAJugar, pasosDe, sentidoDe } from "../convex/rules";
import { sonarHecho, sonarCarta } from "./audio/hechos";
import { celdaDe, celdaArriba } from "./mesa";
import { ms } from "./theme";

/* Cuánto queda teñido el peleador golpeado. Un pelo más que la animación
   MÁS LARGA del golpe, para limpiar la clase con todo ya terminado y no
   cortar nada en el último cuadro.
 *
 * ►► El `max` no es prolijidad, es lo que hace que se puedan tocar. ◄◄
 *
 * Del golpe cuelgan cuatro animaciones y esta constante decide cuándo se
 * apaga la clase que las enciende a las cuatro. Leyendo una sola —era
 * `golpeMarco`— cualquier otra que se alargara por encima de ella quedaba
 * cortada de cuajo, y desde afuera eso se ve como que el cambio de duración
 * "no funcionó". Ya pasó al subir la cara de dolor a 1080: el marco sigue en
 * 900, así que sin esto la mueca se cortaba en el último 12%.
 * Con el máximo, subirle el tiempo a cualquiera de las cuatro alcanza. */
const IMPACTO_MS =
  Math.max(ms("peleador.golpeMarco"), ms("peleador.golpeCara")) + 50;

/* El respiro entre los puntos del dado y lo que dice la casilla. */
const ESPERA_CASILLA = ms("tablero.esperaCasilla");

/* Traduce los hechos que emite el motor a los avisos que ve el jugador.
   El hook dice qué pasó; acá se decide cómo se cuenta. Esa separación es
   lo que permite que en React Native el mismo hecho dispare una vibración
   en lugar de un cartel. */
/* Qué bolsillo se llenó. Son dos topes distintos —cinco jugables y tres
   escudos— y decir "mazo lleno" cuando lo que sobra son escudos manda al
   jugador a hacer lugar donde ya lo había.
   Vive suelto y no adentro de la tabla porque lo necesitan los dos modos: en
   local el hecho viene del motor, y en online se arma con lo que informa el
   servidor. Un texto escrito dos veces es un texto que se desincroniza. */
const TEXTO_LLENO = (tipo) =>
  tipo === CARD.DEFENSE ? "ESCUDOS LLENOS" : "MAZO LLENO";

/* El grito del golpe.
 *
 * El golpe era el único ataque sin voz: el robo se anuncia solo porque el
 * marcador del rival se mueve dos veces —le baja a él y te sube a vos— y la
 * maldición deja el dado marcado varios turnos. El golpe saca dos puntos y
 * se termina ahí, así que sin un aviso propio el momento pasaba en silencio.
 *
 * Sale de una lista y no de un texto fijo porque es el aviso que más se
 * repite en una partida: la misma palabra cinco veces deja de leerse.
 * `ultimo` evita que salga dos veces seguida la misma, que es cuando la
 * repetición más se nota. */
const GRITOS_GOLPE = ["¡AUCH!", "¡KAPOW!", "¡PUM!", "¡ZAS!", "¡CRACK!"];

function gritoDeGolpe(ultimo) {
  const otros = GRITOS_GOLPE.filter((g) => g !== ultimo);
  return otros[Math.floor(Math.random() * otros.length)];
}

const MENSAJES = {
  penitencia: (e) => [`Penitencia — ${e.nombre} pierde ${e.puntos}`, "error"],
  /* Va al cartel del medio y no al aviso del costado, y es la única
     penitencia que lo hace. La razón es que es la buena noticia: el jugador
     ve su ficha frenar en una casilla roja y se prepara para perder puntos.
     Si lo que lo salvó se cuenta en una esquina, el susto queda y el alivio
     no llega — y encima creería que perdió puntos que no perdió.
     Sin el nombre: el cartel del medio sólo sale en TU pantalla cuando es
     TU turno, así que decir quién fue sobra. */
  penitenciaBloqueada: () => ["¡ESCUDO ROTO!", "cartel"],
  /* Sin aviso cuando la carta se muestra sola: dos anuncios de lo mismo se
     pisan. El texto queda para el caso en que no hay carta que enseñar. */
  bonus: (e) => (e.carta ? null : [`Bonus — carta nueva para ${e.nombre}`]),
  /* Perder una carta que la casilla ya te había entregado es de las cosas
     más caras que te pueden pasar en un turno, así que sale en el cartel
     grande del medio y no en un aviso al costado —que es donde iba antes y
     donde nadie lo miraba con el dado todavía rodando—.
     Dos bolsillos, dos textos: los escudos y las cartas jugables se llenan
     por separado, y decir "mazo lleno" cuando lo que sobra son escudos
     mandaría a hacer lugar donde ya lo había. */
  bonusLleno: (e) => [TEXTO_LLENO(e.tipo), "cartel"],
  vuelta: (e) => [`Vuelta completa — ${e.nombre} se lleva ${e.puntos}`],
  dosDados: () => ["Dos dados en tu próxima tirada"],
  cartaPuesta: (e) => [
    e.cantidad > 1
      ? `${e.cantidad} cartas sobre la mesa — se revelan al plantarte`
      : "Carta sobre la mesa — se revela al plantarte",
  ],
  /* Las dos de flujo. No hay número que informar —no mueven el marcador—
     así que lo único que hay que contar es lo que cambió de la RONDA: hacia
     dónde va ahora y cuántos se quedaron sin turno. */
  mediaVuelta: (e) => [
    e.sentido === A_LA_DERECHA
      ? "Media vuelta — el juego vuelve a ir hacia la derecha"
      : "Media vuelta — ahora el juego va hacia la izquierda",
    "cartel",
  ],
  salto: (e) => [
    /* Cuando la ronda se cierra sobre el que los jugó, lo que hay que decir
       es el RESULTADO —jugás de nuevo— y no el mecanismo.
     *
     * ►► La condición sale de las reglas y no se escribe acá. ◄◄
     *
     * Acá decía `e.saltos % e.mesa === 0`, que es la cuenta equivocada: el
     * turno avanza uno ADEMÁS de los saltos, así que la vuelta se cierra
     * cuando `1 + saltos` llega al tamaño de la mesa, no cuando lo hacen los
     * saltos solos. Ese olvido hacía que el cartel mintiera en SIETE de nueve
     * casos — en una mesa de dos con un salto decía "el siguiente se queda
     * sin turno" cuando el siguiente eras vos.
     *
     * Es el mismo error de siempre: la misma regla escrita en dos lugares.
     * Ahora `vuelveAJugar` la dice una vez, al lado de `seatAfter`, que es
     * quien mueve el turno de verdad. */
    vuelveAJugar(e.mesa, e.saltos)
      ? "¡Otra vez tú! La vuelta entera saltada"
      : e.saltos > 1
        ? `${e.saltos} se quedan sin turno`
        : "El siguiente se queda sin turno",
    "cartel",
  ],
  cartasDevueltas: (e) => [
    e.cantidad > 1
      ? `Te quemaste — tus ${e.cantidad} cartas vuelven a la mano`
      : "Te quemaste — tu carta vuelve a la mano",
  ],
};

export default function App() {
  const juego = useGame();
  const sala = useOnlineRoom();
  const { toasts, notify, dismiss } = useToasts();
  const { alerta, anunciar } = useAlerta();

  /* Los setters de useState y los refs son estables por contrato de React;
     el objeto que los envuelve no lo es, porque useGame lo arma de nuevo en
     cada pintado. Sacándolos una vez se los puede listar en las
     dependencias de los efectos sin arrastrar el objeto entero.

     Con `juego` completo en las dependencias, todo efecto que lo listara se
     volvía a disparar en CADA pintado, y el que sincroniza la sala escribe
     jugadores: pintado → efecto → setPlayers → pintado → objeto nuevo →
     efecto. React lo cortaba con "Maximum update depth exceeded". Nada de
     eso se veía mientras la ficha se movía con una transición de CSS, pero
     encadenar temporizadores en ese bucle es imposible: cada vuelta los
     cancelaba antes de que llegara a correr el primero. */
  const {
    setPlayers, setActive, setBoard, setGoal, setMiLado, setSentido,
    setPlaying, setFinished, setRolling, consumeEvents, hayPartida,
    sumarPuntos, resolverCasilla, endTurn,
  } = juego;

  /* ►► El modo se DERIVA de la sala, no se recuerda. ◄◄
   *
   * Esto era `useState("local")`, y ahí estaba el error: de las tres piezas
   * que describen una partida online, dos sobreviven a recargar la página y
   * una no.
   *
   *   · `screen`  vive en el hash de la URL      → sobrevive
   *   · `roomId`  vive en sessionStorage         → sobrevive
   *   · `modo`    vivía sólo en memoria          → NO sobrevivía
   *
   * Y `modo` únicamente se escribía al pasar por el menú. Así que recargar
   * la pestaña —o duplicarla, que es como se prueba una mesa de cuatro—
   * devolvía al vestíbulo con el código de sala intacto pero con `online`
   * en falso.
   *
   * Lo peor no era que fallara: es que se veía perfecto. El vestíbulo se
   * dibuja con datos de la sala, así que seguía contando las sillas y
   * mostrando el botón de empezar. Hasta la mutación salía y el servidor
   * arrancaba la partida de verdad. Lo único muerto era TODO efecto que
   * empieza con `if (!online) return`, o sea el que mueve a elegir gato —
   * y desde afuera eso se ve como un botón que no hace nada.
   *
   * Derivarlo de `getRoomId()` iguala las tres vidas: hay sala guardada,
   * hay partida online. No hace falta acordarse de nada porque la respuesta
   * ya estaba escrita al lado. */
  const [modo, setModo] = useState(() =>
    getRoomId() || INVITACION ? "online" : "local"
  );
  const [elegidos, setElegidos] = useState([null, null]);
  const [tirada, setTirada] = useState(null);
  const [revelada, setRevelada] = useState(null);
  const [reglasAbiertas, setReglasAbiertas] = useState(false);
  const [esperandoRival, setEsperandoRival] = useState(false);
  /* La carta que acabás de ganar, mientras dura su entrega. Sólo se llena
     para el jugador que la recibió: al rival no se le muestra. */
  const [cartaGanada, setCartaGanada] = useState(null);
  /* Cuál fue el último grito de golpe. En una referencia y no en estado: no
     se dibuja, así que guardarlo con `useState` sería un pintado de más por
     cada golpe y encima llegaría tarde al efecto que lo lee. */
  const ultimoGrito = useRef(null);

  /* La carta que está viajando hacia el rival, y el golpe que deja al
     llegar. Van separados porque el destello arranca cuando la carta
     aterriza, no cuando sale. */
  const [lanzada, setLanzada] = useState(null);
  const [impacto, setImpacto] = useState(null);

  /* Mostrar una carta que se revela: el cartel, el sello del medio y el
     vuelo hacia el que la recibe.
     Vive en un solo lugar porque se dispara desde TRES: el motor local lo
     cuenta con un hecho, y el online lo arma a mano dos veces —cuando te
     plantás vos y cuando se planta el rival—, porque ahí la autoridad es el
     servidor y no hay hechos que consumir. El grito del golpe nació
     escrito sólo en el primero y por eso no sonaba en online: repartido en
     tres copias, el próximo detalle se va a olvidar en dos. */
  const mostrarRevelacion = useCallback(
    (carta, bloqueada, destino) => {
      /* El grito sólo si el golpe ENTRÓ. Uno que la defensa tapó ya tiene su
         propio relato —la carta partiéndose y el sello de BLOQUEADO— y un
         "¡KAPOW!" encima contaría que pegó cuando no pegó. */
      if (carta?.type === CARD.PUNCH && !bloqueada) {
        const grito = gritoDeGolpe(ultimoGrito.current);
        ultimoGrito.current = grito;
        anunciar(grito);
      }
      setRevelada({ carta, bloqueada });
      setLanzada({ carta, bloqueada, destino, key: Math.random() });
    },
    [anunciar]
  );
  /* Se pidió la tirada al servidor y todavía no volvió. */
  const [pidiendoTirada, setPidiendoTirada] = useState(false);

  /* La carta que el servidor ya entregó pero que todavía no se mostró:
     espera a que la ficha frene para aparecer. */
  const cartaEnCamino = useRef(null);
  /* La penitencia de la tirada en curso rebotó en un escudo. Sólo lo usa el
     online: en local el motor lo cuenta como hecho y esa corriente ya llega
     sola a la pantalla. */
  const penitenciaBloqueada = useRef(false);

  /* La casilla a la que el servidor mandó tu ficha, esperando a que el dado
     termine de girar. Viene en la respuesta de la propia tirada, no del
     sondeo: por el sondeo tardaba hasta dos segundos, y como el control se
     desbloqueaba al frenar el dado se podía tirar otra vez antes de que la
     ficha se moviera. Cuando por fin llegaba, traía las dos tiradas
     sumadas y la ficha caminaba de golpe un número que no se correspondía
     con ningún dado. */
  const posDelServidor = useRef(null);

  /* Lo que el bonus entregó.
   *
   * ►► Todas las cartas se muestran. También la cerveza. ◄◄
   *
   * Antes la cerveza se saltaba la entrega y salía sólo un cartel de texto.
   * El razonamiento era bueno a medias: esa carta NUNCA llega a la mano —se
   * toma al recibirla— así que verla aterrizar en el abanico sería el juego
   * mintiendo sobre su propia regla. Pero de ahí se sacó la conclusión
   * equivocada: no mostrarla.
   *
   * Y no mostrarla tiene un costo peor. La cerveza es lo único del juego que
   * te nubla la mesa, o sea el efecto más agresivo que existe sobre lo que
   * ves — y llegaba sin cara. La pantalla se ponía borrosa y el jugador
   * tenía que leer un cartel al costado para enterarse de por qué.
   *
   * Lo que no puede pasar es que VIAJE al abanico. Eso lo resuelve
   * `CardGained`, que le da su propio final: se queda en el centro y se
   * toma. La regla se sigue respetando; lo que cambia es que ahora se ve.
   *
   * Vive acá y no en los dos sitios que entregan cartas —el motor local y
   * la respuesta del servidor— porque son dos caminos para el mismo hecho, y
   * repartir la excepción entre los dos es cómo se desincronizan. */
  const entregarCarta = useCallback((carta) => {
    if (!carta) return;
    setCartaGanada(carta);
  }, []);

  /* Tiñe a un peleador del color de lo que acaba de pasarle y lo deja
     volver solo. El mismo destello sirve para una carta que le llegó y para
     una casilla que lo castigó: en los dos casos perdió puntos, y mostrarlo
     distinto inventaría una diferencia que el juego no tiene. */
  /* El plantarse forzado de la maldición.
   *
   * Se dispara el MISMO `plantarse` del botón, y esa es toda la gracia:
   * guardar el acumulado, revelar las cartas puestas, cobrar los robos y
   * medir contra el objetivo son cuatro cosas que ya ocurren juntas ahí.
   * Escrito aparte, sería una segunda versión de esa secuencia que se
   * desincroniza con la primera el día que se toque una de las dos.
   *
   * Espera a `rolling` en bajo por lo mismo que el cierre por objetivo: el
   * acumulado de la tirada se suma cuando la ficha llega, no cuando frena el
   * dado, y plantarse antes de eso guardaría el puntaje sin la última
   * tirada. */
  const plantarForzado = useRef(null);
  const [plantarKey, setPlantarKey] = useState(null);

  /* El aviso sale de acá y no del efecto que ejecuta el plante: un `notify`
     adentro de un efecto es setState en cascada —el efecto corre, escribe
     estado, eso vuelve a pintar y el efecto se evalúa de nuevo—. Acá estamos
     en el manejador del hecho, que es donde va a parar cualquier cosa que se
     le quiera CONTAR al jugador. El efecto queda sólo con la ejecución. */
  /* `canal` decide DÓNDE se cuenta, con los mismos dos valores que usa la
     tabla `MENSAJES`: "cartel" va al anuncio grande del medio, cualquier
     otra cosa al aviso del costado. Se repite la convención en vez de
     inventar una segunda para lo mismo. */
  const forzarPlante = useCallback(
    (motivo = "Casilla maldita — se te acabó el turno", canal = "aviso") => {
      plantarForzado.current = true;
      setPlantarKey(Math.random());
      if (canal === "cartel") anunciar(motivo);
      else notify(motivo, "error");
    },
    [notify, anunciar]
  );

  /* ►► Se acabaron los diez segundos. ◄◄
   *
   * Perder el turno acá es EXACTAMENTE lo que ya hace la casilla de turno
   * perdido: un plantarse forzado. No es una comodidad — es que en este
   * juego "perdés el turno" ya significa esto, y darle un segundo
   * significado al mismo castigo obligaría al jugador a aprender dos reglas
   * donde había una.
   *
   * Y hace lo correcto en los dos casos que importan. Si te quedaste
   * pensando con quince puntos acumulados, se guardan: el reloj te apura,
   * no te roba. Y si se acabó sin que tiraras una sola vez, plantarse con
   * cero acumulado ES perder el turno, sin ningún caso especial que
   * escribir.
   *
   * Además reusa el camino que ya existe y ya está probado: el mismo que
   * revela las cartas puestas y las cobra. Un final de turno escrito aparte
   * sería una segunda copia de esa resolución, esperando a desincronizarse
   * con la primera.
   *
   * Va por `forzarPlante` y no por `plantarse` directo por lo mismo que la
   * casilla: el efecto que ejecuta el plante espera a que la ficha esté
   * quieta. Llamado en crudo, plantaría sin la última tirada. */
  /* ►► Va al cartel del medio, como el resto de las malas noticias. ◄◄
   *
   * Estaba como aviso al costado, y ahí estaba mal: el jugador que se queda
   * sin tiempo es, por definición, el que NO estaba mirando la pantalla. Un
   * aviso en una esquina se lo pierde y vuelve sin entender por qué le pasó
   * el turno. El cartel del medio es imposible de no ver.
   *
   * Y es el mismo lugar donde ya sale "PIERDES TURNO" al quemarse: las dos
   * son la misma noticia —tu turno se terminó sin que vos lo decidieras— y
   * contarlas en dos lugares distintos las haría parecer cosas distintas.
   *
   * El texto va corto a propósito: el cartel no parte renglones
   * (`white-space: nowrap`) y crece con el ancho de la ventana, así que una
   * frase larga se sale por los costados en un teléfono. */
  const alAgotarseElTiempo = useCallback(() => {
    forzarPlante("TIEMPO AGOTADO", "cartel");
  }, [forzarPlante]);

  const golpear = useCallback((lado, tipo) => {
    setImpacto({ lado, tipo, key: Math.random() });
    setTimeout(() => setImpacto(null), IMPACTO_MS);
  }, []);

  const online = modo === "online";

  /* Sin jugadores no hay mesa ni final: entrar a #/game escribiendo la URL
     tiene que devolver al principio en vez de romper. */
  const puedeEntrar = useCallback(
    (destino) => {
      /* Se consulta la referencia y no el estado: start() y go() corren en
         la misma vuelta, y para entonces setPlayers todavía no se aplicó.
         Leyendo el estado, el guardia rebotaba a quien acababa de apretar
         Jugar. */
      if ((destino === "game" || destino === "gameover") && !juego.hayPartida.current) {
        return "title";
      }
      return destino;
    },
    [juego.hayPartida]
  );

  const { screen, go } = useRouter({ puedeEntrar });

  /* ►► Entrar por invitación. ◄◄
   *
   * El enlace de WhatsApp trae el código, así que quien lo abre no tiene que
   * pasar por el menú ni pegar nada: se sienta solo.
   *
   * ►► Pero NO salta la pantalla de título, y no es por descuido. ◄◄
   *
   * Ahí vive el desbloqueo del audio, y los navegadores no lo dan sin un
   * gesto del jugador. Un enlace que entrara derecho al vestíbulo dejaría
   * mudo TODO el resto de la partida para quien llegó invitado — sin dado,
   * sin golpes, sin nada — y no habría forma de recuperarlo después.
   *
   * Así que se sienta a la mesa ya mismo —el anfitrión lo ve llegar en el
   * acto, que es lo que importa del otro lado— y el botón de siempre lo
   * lleva al vestíbulo en vez de al menú. Un toque en lugar de cuatro pasos.
   */
  const invitado = useRef(Boolean(INVITACION));

  useEffect(() => {
    if (!INVITACION) return;
    let vivo = true;
    /* La URL se limpia enseguida para que recargar no reintente una entrada
       que ya ocurrió, y para que el código no quede a la vista en la barra
       de direcciones el resto de la partida. `replaceState` no navega ni
       agrega una entrada al historial: el botón atrás sigue haciendo lo que
       hacía. */
    try {
      history.replaceState(null, "", location.pathname + location.hash);
    } catch {
      /* Sin history API la URL queda con el código. Es feo y no rompe nada. */
    }
    sala
      .unirse(INVITACION)
      .then(() => {
        if (vivo) notify("Ya tienes tu silla — pulsa para entrar");
      })
      .catch((e) => {
        if (!vivo) return;
        /* La sala se llenó, terminó o no existe. Se avisa y el botón vuelve
           a llevar al menú, que es de donde se puede entrar a mano. */
        invitado.current = false;
        notify(errorText(e), "error");
      });
    return () => {
      vivo = false;
    };
    /* Sólo al montar: `INVITACION` es una constante del módulo y `sala` se
       arma de nuevo en cada pintado, así que listarlo repetiría la entrada
       cada dos segundos, con el sondeo. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (document.readyState === "complete") warmRosterFrames();
    else window.addEventListener("load", warmRosterFrames, { once: true });
  }, []);

  /* Los hechos del motor se vacían apenas se muestran, o se repetirían en
     cada pintado. */
  const eventos = juego.events;
  useEffect(() => {
    if (!eventos.length) return;
    eventos.forEach((e) => {
      /* El mismo hecho, dos traducciones: una a lo que se LEE y otra a lo
         que se OYE. Van juntas y no en dos efectos porque los hechos se
         vacían al consumirlos: con dos lectores, el segundo encontraría la
         lista ya limpia. */
      sonarHecho(e);
      const armar = MENSAJES[e.tipo];
      const mensaje = armar?.(e);
      /* El segundo elemento decide DÓNDE se cuenta, no sólo de qué color:
         `cartel` va al anuncio grande del medio, cualquier otra cosa al
         aviso al costado. Esa decisión vive en la tabla de mensajes, que ya
         es el lugar donde se traduce un hecho del motor a algo que el
         jugador ve — el motor sigue sin saber que existen los carteles. */
      if (mensaje) {
        const [texto, canal] = mensaje;
        if (canal === "cartel") anunciar(texto);
        else notify(texto, canal);
      }
      if (e.tipo === "cartaRevelada") {
        mostrarRevelacion(e.carta, e.bloqueada, e.destino);
      }
      if (e.tipo === "bonus" && e.carta) entregarCarta(e.carta);
      /* El destello rojo de la penitencia NO se dispara acá aunque el hecho
         pase por este efecto: en online el motor local no resuelve casillas
         —lo hace el servidor— así que este evento nunca llegaría y el golpe
         sólo se vería en local. Lo avisa el tablero, que sabe dónde frenó la
         ficha en los dos modos. */
      if (e.tipo === "ganado") setFinished(true);
    });
    consumeEvents();
  }, [
    eventos, consumeEvents, setFinished, notify, anunciar, entregarCarta,
    mostrarRevelacion,
  ]);

  /* El cartel de turno perdido se va solo. Se desmonta en vez de quedarse
     invisible: mientras existe es un nodo fijo tapando la pantalla entera,
     y aunque no reciba toques es una capa de más en cada pintado. */

  // La carta revelada se muestra un rato y se va sola.
  useEffect(() => {
    if (!revelada) return;
    const t = setTimeout(() => setRevelada(null), 2600);
    return () => clearTimeout(t);
  }, [revelada]);

  useEffect(() => {
    if (juego.finished) go("gameover");
  }, [juego.finished, go]);

  /* En online el servidor es la autoridad: el estado local se sobreescribe
     con lo que trae la sala. Predecirlo de este lado sería adivinar el
     azar, y las dos pantallas terminarían mostrando cosas distintas. */
  useEffect(() => {
    const r = sala.room;
    if (!online || !r) return;

    if (Array.isArray(r.board) && r.board.length) setBoard(r.board);
    if (typeof r.goal === "number") setGoal(r.goal);
    /* El sentido lo manda el servidor como todo lo demás: es estado de la
       partida y la carta que lo da vuelta la resuelve él. Predecirlo de
       este lado sería tener dos mesas girando por su cuenta. */
    if (typeof r.sentido === "number") setSentido(r.sentido);
    setMiLado(sala.miLado);

    /* La mesa viene como array desde el servidor, que la normaliza aunque el
       documento todavía guarde la forma vieja de dos campos. Acá ya no hay
       que saber cuántos son. */
    const lados = r.players ?? [];
    setPlayers((prev) =>
      lados.map((lado, i) => {
        if (!lado) return prev[i];
        const base = prev[i] ?? newPlayer(charFromCatId(lado.catId) ?? ROSTER[i]);
        const personaje = charFromCatId(lado.catId);
        return {
          ...base,
          char: personaje ?? base.char,
          score: lado.score,
          current: lado.current,
          pos: lado.pos ?? 0,
          hand: lado.hand ?? [],
          /* Se acepta el campo viejo de una sola carta por las salas que
             quedaron abiertas de la versión anterior. */
          pendingCards: lado.pendingCards ?? (lado.pendingCard ? [lado.pendingCard] : []),
          curseTurns: lado.curseTurns ?? 0,
          beerTurns: lado.beerTurns ?? 0,
          beerStacks: lado.beerStacks ?? 0,
          doubleNext: Boolean(lado.doubleNext),
        };
      })
    );

    setActive(r.seat ?? 0);

    if (r.status === "finished" && !juego.finished) {
      if (r.endedByAbandon) notify("Se levantaron de la mesa — ganas por abandono");
      setFinished(true);
    }
    /* `juego.finished` se lee adentro pero NO va acá: sólo protege de
       declarar el final dos veces, y listarlo volvería a atar el efecto a
       un valor que él mismo escribe. La sala es lo único que debe
       dispararlo. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala.room, sala.miLado, online, setBoard, setGoal, setMiLado, setSentido, setPlayers, setActive, setFinished, notify]);

  /* Lo que hizo el rival. El sondeo trae el hecho; acá se decide cómo se
     ve: la tirada se anima, la carta se da vuelta. */
  useEffect(() => {
    const ev = sala.novedad;
    if (!ev) return;
    sala.consumirNovedad();

    if (ev.action === "roll") {
      const dados = Array.isArray(ev.payload?.dice) ? ev.payload.dice : [ev.payload?.roll];
      /* `mia: false` es lo que impide que el cartel de turno perdido salga
         en la pantalla equivocada: esta tirada es del RIVAL, y el aviso es
         sólo para quien se quemó.
         No alcanza con mirar de quién es el turno cuando el dado frena: si
         el rival saca un 1, el servidor pasa el turno en el acto y para
         cuando los cubos terminan de rodar el turno ya figura como tuyo.
         El dueño viaja con la tirada porque es un dato de la tirada, no del
         momento en que se la mira. */
      setTirada({ dice: dados, isBust: Boolean(ev.payload?.isBust), gained: 0, mia: false });
      return;
    }
    /* Alguien se levantó y la partida SIGUE. Con dos esto no existía: irse
       terminaba el juego y lo contaba el cartel de abandono. Con cuatro la
       mesa se cierra sobre el hueco —los objetivos se recalculan solos— y
       eso hay que decirlo, porque a alguien le acaba de cambiar la víctima
       sin que tocara nada. */
    if (ev.action === "leave") {
      const quien = ev.payload?.name;
      notify(
        quien
          ? `${quien} se levantó de la mesa — quedan ${ev.payload?.quedan ?? "menos"}`
          : "Un jugador se levantó de la mesa"
      );
      return;
    }
    if (ev.action === "hold" || ev.action === "hold_and_win") {
      /* Lo que el flujo le hizo a la RONDA. Se cuenta acá y no se deduce
         del sondeo porque desde afuera es invisible: la mesa dada vuelta y
         los turnos comidos se verían sólo como que el turno cayó donde
         nadie lo esperaba. El que las jugó ya lo vio en su pantalla; esto
         es para los demás. */
      if (ev.payload?.vueltas) {
        anunciar(
          ev.payload.sentido === A_LA_DERECHA
            ? "MEDIA VUELTA — VUELVE A LA DERECHA"
            : "MEDIA VUELTA — AHORA A LA IZQUIERDA"
        );
      }
      if (ev.payload?.saltos) {
        notify(
          ev.payload.saltos > 1
            ? `${ev.payload.saltos} turnos saltados`
            : "Un turno saltado"
        );
      }
      (ev.payload?.resolved ?? []).forEach((r, i) => {
        // De a una y con pausa: juntas no se sabría cuál hizo qué.
        const carta = { type: r.type, value: r.value };
        /* Esta novedad es del rival plantándose, así que la carta viene
           para vos: el golpe va en tu lado, no en el suyo. */
        setTimeout(() => mostrarRevelacion(carta, r.blocked, sala.miLado), i * 1500);
      });
    }
  }, [sala, mostrarRevelacion, notify, anunciar]);

  /* Elegir gato, para una mesa de cualquier tamaño.
   *
   * Antes desarmaba el array en `[p1, p2]` y decidía con cuatro `if`: eso
   * era la mesa de dos escrita en la forma de la función. Ahora es una regla
   * sola —el toque llena el primer asiento libre, y si el gato ya estaba
   * elegido lo suelta— que vale igual para dos que para cuatro. */
  const elegir = (i) => {
    setElegidos((prev) => {
      /* En online elegís sólo el TUYO — pero en tu casillero, no en el
         primero. Antes esto devolvía `[i, null]`: te sentaba siempre en el
         asiento 0 aunque fueras el tercero en entrar, y el sondeo después
         pisaba ese array con los picks reales de la mesa. Con dos daba lo
         mismo porque el hueco era uno solo; con cuatro te dibujaba el gato
         de otro como si fuera tuyo. */
      if (online) {
        /* El gato de otro no se toca. La pantalla ya lo dibuja tomado, pero
           el toque puede llegar entre dos sondeos. */
        const dueno = prev.indexOf(i);
        if (dueno !== -1 && dueno !== sala.miLado) return prev;
        /* Se rellena hasta tu asiento antes de escribirlo: entre entrar a
           la sala y el primer sondeo el array todavía tiene el largo que le
           puso el menú, y `s[3] = i` sobre uno de dos deja dos huecos
           `undefined` que ni `indexOf(null)` ni el contador de faltantes
           saben leer. */
        /* `sala.miLado` y no `juego.miLado`: el primero se calcula del
           documento de la sala en cada pintado, el segundo lo copia un
           efecto y por lo tanto llega un pintado tarde. En la mesa esa
           diferencia no se nota; acá se elige gato apenas se entra, que es
           justo el instante en que el copiado todavía vale 0 — y con un 0
           prestado el tercero en entrar escribía en el casillero del
           anfitrión. */
        const s = [...prev];
        while (s.length <= sala.miLado) s.push(null);
        s[sala.miLado] = i;
        return s;
      }

      const ya = prev.indexOf(i);
      if (ya !== -1) {
        const s = [...prev];
        s[ya] = null;
        return s;
      }
      const libre = prev.indexOf(null);
      if (libre === -1) return prev;
      const s = [...prev];
      s[libre] = i;
      return s;
    });
  };

  const jugar = async () => {
    if (!online) {
      const primero = elegidos[0] ?? 0;
      /* Un jugador por asiento elegido. El respaldo por si algún casillero
         quedó vacío reparte gatos consecutivos: es la misma red que había
         antes para el segundo jugador, ahora para todos. */
      juego.start(
        newPlayers(elegidos.map((idx, i) => ROSTER[idx ?? (primero + i) % ROSTER.length]))
      );
      go("game");
      return;
    }

    /* Tu pick sale de TU casillero. Era `elegidos[0]`, que con cuatro
       mandaba al servidor el gato del anfitrión desde cualquier asiento. */
    const mio = elegidos[sala.miLado];
    if (mio == null) return;

    /* La mesa no se abre hasta que eligieron TODOS: si no, el primero
       entraba a jugar contra placeholders mientras los demás seguían
       eligiendo. */
    setEsperandoRival(true);
    try {
      const pick = ROSTER[mio];
      await sala.setCharacter(sala.roomId, pick.name, pick.id);
    } catch (e) {
      setEsperandoRival(false);
      notify(errorText(e), "error");
    }
  };

  /* Los dos ya eligieron: recién ahí arranca la partida. Se mira la sala en
     vez de esperar un aviso porque el sondeo ya la trae. */
  useEffect(() => {
    if (!online || !esperandoRival) return;
    const r = sala.room;
    /* Arranca cuando TODOS los sentados eligieron gato, sean dos o cuatro.
       Antes preguntaba por dos campos con nombre; con la mesa como array la
       misma condición se dice sin saber cuántos hay. */
    const mesa = r?.players ?? [];
    /* `status` además de los gatos, y no es redundante: la sala de cuatro
       sigue en `waiting` mientras falte gente, y los dos que ya entraron
       pueden haber elegido los dos. Sin esta condición la partida arrancaba
       de a dos en una mesa abierta para cuatro. */
    if (r?.status !== "playing") return;
    if (mesa.length < 2 || mesa.some((p) => !p?.catId)) return;
    setEsperandoRival(false);
    /* En online los jugadores no los arma start() sino el sondeo, así que
       la bandera que el guardia del router consulta hay que marcarla acá.
       Sin esto el guardia la veía en false y devolvía al título justo al
       entrar a la mesa. */
    hayPartida.current = true;
    setPlaying(true);
    setFinished(false);
    go("game");
  }, [online, esperandoRival, sala.room, hayPartida, setPlaying, setFinished, go]);

  /* ►► Los casilleros que VE la pantalla de selección. ◄◄
   *
   * En online los gatos ajenos hay que verlos tomados, o dos jugadores
   * eligen el mismo y la mesa queda con dos peleadores idénticos con
   * marcadores distintos. El servidor lo rechaza, pero enterarse por un
   * error después de haber elegido es la peor forma de enterarse.
   *
   * Se DERIVA en el pintado y no se copia a estado con un efecto. Escrito
   * como efecto funcionaba, pero era un setState por cada sondeo —uno cada
   * dos segundos, para siempre, aunque nadie estuviera mirando la pantalla
   * de selección— y encima obliga a acordarse de no pisar tu propia
   * selección mientras no la confirmaste. Derivado no hay nada que
   * sincronizar: la mesa es la fuente de los ajenos y `elegidos` la del
   * tuyo, y cada uno se lee de donde vive.
   *
   * El respaldo con `elegidos` es para el hueco entre entrar a la sala y el
   * primer sondeo, cuando `room` todavía no llegó. */
  const idxDeCat = (catId) => {
    if (!catId) return null;
    const i = ROSTER.findIndex((c) => c.id === catId);
    return i === -1 ? null : i;
  };
  const mesaOnline = online ? sala.room?.players : null;
  const elegidosVista = mesaOnline?.length
    ? mesaOnline.map((p, i) =>
        i === sala.miLado ? (elegidos[i] ?? idxDeCat(p?.catId)) : idxDeCat(p?.catId)
      )
    : elegidos;

  /* La sala se cerró debajo tuyo: el anfitrión canceló o venció el TTL.
     Se vuelve al menú en vez de dejar el vestíbulo contando jugadores de
     una mesa que ya no existe. */
  useEffect(() => {
    if (!online || !sala.cerrada) return;
    if (screen !== "room-choice" && screen !== "select") return;
    notify("La sala se cerró", "error");
    go("menu");
  }, [online, sala.cerrada, screen, go, notify]);

  const crearSala = async () => {
    try {
      await sala.crear();
      notify("Mesa abierta — pasa el código a quien quieras");
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  /* Arrancar la partida. Es la ÚNICA forma de que empiece una mesa que no
     se llenó sola, o sea casi siempre. El servidor sólo lo acepta del
     anfitrión y con al menos dos sentados; el botón ya aplica la misma
     regla, así que llegar acá y que rebote sería un error de la pantalla. */
  const empezarSala = async () => {
    try {
      await sala.empezar();
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  const unirseASala = async (codigo) => {
    if (!codigo) {
      notify("Pega el código de la sala", "error");
      return;
    }
    try {
      await sala.unirse(codigo);
      /* Al VESTÍBULO, no directo a elegir gato.
         Antes iba derecho a la selección, y con una sala de dos eso era
         correcto: entrar era el último requisito, la partida ya estaba
         armada. Con mesas de hasta cuatro entrar es sentarse a esperar —
         puede faltar gente— y mandarlo a elegir gato le contaría que la
         mesa está lista cuando no lo está. El vestíbulo es de todos: los
         mueve a la selección el mismo efecto, cuando la sala arranca. */
      go("room-choice");
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  /* La sala arrancó: todos los que están en el vestíbulo pasan a elegir.
     Vale igual para el anfitrión y para los que entraron, que es lo que
     permite que el vestíbulo sea uno solo. */
  useEffect(() => {
    if (!online || screen !== "room-choice") return;
    if (sala.room?.status === "playing") {
      const cuantos = sala.room.players?.length ?? 2;
      /* Se dice CUÁNTOS son, siempre. Antes con dos decía "tu rival entró",
         que era la noticia porque el segundo jugador era el único evento
         posible. Ahora la mesa arranca con los que el anfitrión haya
         decidido, así que el dato es el tamaño — y el que entró tercero
         necesita saber que se juega de tres y no de cuatro. */
      notify(`Mesa de ${cuantos} — elige tu gato`);
      go("select");
    }
  }, [online, screen, sala.room, go, notify]);

  const tirar = async () => {
    if (!online) {
      const t = juego.roll();
      /* En local los dos miran la misma pantalla, así que toda tirada que
         sale de este botón es la del que está jugando el turno. */
      if (t) setTirada({ ...t, mia: true });
      return;
    }
    /* Distinto de `rolling`: eso queda encendido toda la resolución del
       turno, y el dado sólo tiene que girar en falso mientras se espera la
       respuesta del servidor. */
    setPidiendoTirada(true);
    juego.setRolling(true);
    try {
      const r = await sala.rollDice(sala.roomId);
      setPidiendoTirada(false);
      setTirada({ dice: r.dice, isBust: r.isBust, gained: r.gained ?? 0, mia: true });
      /* El servidor ya resolvió a qué casilla va la ficha y lo manda acá.
         Se guarda y se aplica cuando el dado frena, para que la ficha
         arranque justo cuando se ve la cara. */
      if (typeof r.pos === "number") posDelServidor.current = r.pos;
      /* Llega por la respuesta de la propia tirada y no por el sondeo: así
         la entrega la ve sólo quien la ganó. Por el sondeo pasa también por
         la pantalla del rival.

         Queda esperando a que la ficha frene en vez de salir a los 700ms.
         Ese número era una apuesta a cuánto iba a tardar el recorrido, y
         ahora el recorrido dura lo que diga el dado: con una tirada larga
         la carta aparecía con la ficha todavía a mitad de camino. */
      if (r.gainedCard) cartaEnCamino.current = r.gainedCard;
      /* El escudo tapó la casilla roja. El cliente no lo puede deducir del
         tablero —ése sabe el color de la casilla, no lo que llevaba encima
         la ficha— así que viene dicho por el servidor. Se guarda y se usa
         cuando la ficha frena, como todo lo demás del turno. */
      if (r.penitenciaBloqueada) {
        penitenciaBloqueada.current = true;
        anunciar("¡ESCUDO ROTO!");
        sonarCarta(CARD.DEFENSE, true);
      }
      /* Caíste en bonus y no vino carta: la única razón es que la mano ya
         está en el tope. En local ese aviso lo emite el motor como hecho,
         pero en online las casillas las resuelve el servidor y ese hecho
         nunca llega hasta acá — así que se deduce de la respuesta, que trae
         dónde caíste y qué entregó. Sin esto, el jugador en línea perdía
         una carta sin que nada se lo dijera. */
      else if (r.landed === SQUARE.BONUS) anunciar(TEXTO_LLENO(r.lostCard));
      /* En online el servidor no cierra el turno solo: avisa que caíste en
         una casilla maldita y el plantarse lo manda el cliente con la misma
         mutación del botón, para que las cartas puestas se revelen igual
         que siempre. Queda esperando a que la ficha llegue, como todo lo
         demás del turno. */
      if (r.landed === SQUARE.TURN_LOSS) forzarPlante();
    } catch (e) {
      /* Si la tirada falló, el dado tiene que dejar de girar: si no, queda
         dando vueltas para siempre sobre un turno que nunca ocurrió. */
      setPidiendoTirada(false);
      juego.setRolling(false);
      notify(errorText(e), "error");
    }
  };

  /* El turno se cuenta como una secuencia y no como un montón de cosas a la
     vez: primero frena el dado, después la ficha recorre las casillas, y
     recién cuando llega se cargan los puntos y aparece lo que dio o costó
     la casilla. Cada paso espera al anterior porque cada uno EXPLICA al
     siguiente; encimados, no se entiende qué causó qué.

     El dado frenó: acá sólo se mueve la ficha. Lo demás queda esperando en
     `pendiente` hasta que el tablero avise que llegó. */
  const pendiente = useRef(null);

  const alFrenar = (t) => {
    setTirada(null);

    /* El cartel de turno perdido sale acá y no al pedir la tirada: cuando
       se pide, el jugador todavía no vio ningún número, y anunciarle que
       perdió mientras los cubos giran le cuenta el final antes que el
       dado. Acá el 1 ya está a la vista y el cartel lo explica.
       Sólo a quien se quemó: `mia` viene con la tirada y en online la del
       rival llega con esa marca en falso. */
    if (t?.isBust && t.mia !== false) anunciar("PIERDES TURNO");
    /* En online el estado lo aplicó el servidor. Lo único que se adelanta
       acá es la posición, que vino en la respuesta de la tirada: mueve la
       ficha ya, sin esperar el sondeo. El resto —puntos, mano, casilla—
       sigue llegando por el sondeo, que es la autoridad.

       Y NO se desbloquea el control acá: eso ahora ocurre cuando la ficha
       frena, igual que en local. Desbloqueando al frenar el dado se podía
       tirar de nuevo con la ficha todavía sin moverse, y las dos tiradas
       terminaban caminando juntas. */
    if (online) {
      const pos = posDelServidor.current;
      posDelServidor.current = null;
      /* Sin posición no hay recorrido que esperar, así que se devuelve el
         control en el acto: quedarse esperando un aviso que no va a
         llegar dejaría al jugador sin poder tirar.

         Y con la tirada quemada tampoco hay recorrido: el 1 ya no mueve, la
         ficha se queda donde estaba y el tablero SÓLO avisa cuando camina
         —`if (fin === desde) return`—. Sin esta salida el turno esperaba
         para siempre por un aviso que nadie iba a mandar, y como el 1 sale
         una de cada seis veces, el juego se trababa solo. */
      if (pos == null || (t && pasosDe(t) === 0)) {
        juego.setRolling(false);
        return;
      }
      setPlayers((prev) => {
        const p = prev[juego.miLado];
        if (!p || p.pos === pos) return prev;
        const siguiente = [...prev];
        siguiente[juego.miLado] = { ...p, pos };
        return siguiente;
      });
      return;
    }
    juego.settleRoll(t);

    /* ►► La tirada quemada se cierra ACÁ, no cuando la ficha llegue. ◄◄
     *
     * Porque no va a llegar: el 1 ya no mueve, y el tablero sólo avisa
     * cuando hubo recorrido. Todo lo que normalmente cuelga de ese aviso
     * —los puntos, el cambio de turno, devolver el control— se quedaba
     * esperando, y el juego se trababa una de cada seis tiradas.
     *
     * Es la misma secuencia que `alLlegar`, sin las dos partes que
     * necesitan un aterrizaje: la casilla no se resuelve —la ficha no pisó
     * ninguna nueva, y volver a cobrar la de abajo era regalar una carta
     * por cada 1— y no hay golpe rojo que mostrar.
     *
     * Los 900ms son los mismos de allá: el cartel de PIERDES TURNO ya está
     * en pantalla y el turno no puede pasar antes de que se lea. */
    if (pasosDe(t) === 0) {
      sumarPuntos(t);
      setTimeout(endTurn, 900);
      return;
    }

    pendiente.current = t;
  };

  /* La ficha frenó: recién ahora se cobra o se cobra el precio de la
     casilla. En online el servidor ya resolvió todo, así que lo único que
     espera acá es la entrega de la carta ganada. */
  const alLlegar = useCallback(
    (lado, tipo) => {
      /* El golpe rojo sale de acá y no del hecho que emite el motor: el
         tablero ve dónde frenó la ficha en los dos modos, y en online las
         casillas las resuelve el servidor, así que aquel hecho nunca
         llegaría a esta pantalla. */
      /* ►► Rojo sólo si de verdad cobró. ◄◄
       *
       * `tipo` sale del TABLERO, que lee el camino y nada más: sabe que la
       * casilla es roja, no si esta ficha llevaba escudo. Sin la segunda
       * mitad, a alguien que no perdió un punto se le teñía el peleador de
       * rojo — el destello diría lo contrario del cartel.
       *
       * En online la respuesta la trae el servidor y espera acá adentro de
       * un ref, igual que la carta ganada: quien resuelve las casillas es
       * él, así que la respuesta viaja con la tirada y se usa recién cuando
       * la ficha frena. */
      const bloqueada = penitenciaBloqueada.current;
      penitenciaBloqueada.current = false;
      const castiga = tipo === SQUARE.PENALTY && !bloqueada;
      /* La casilla convertida por la maldición. En local la reconoce el
         tablero, que ya lee cada casilla con los ojos del que la pisa. */
      if (!online && tipo === SQUARE.TURN_LOSS && lado === juego.active) {
        forzarPlante();
      }

      if (online) {
        /* El servidor ya resolvió puntos y casilla; lo único que falta es
           mostrarlo, y espera lo mismo que en local para que el turno se vea
           igual de los dos lados de la red. */
        const carta = cartaEnCamino.current;
        cartaEnCamino.current = null;
        if (castiga || carta) {
          setTimeout(() => {
            if (castiga) golpear(lado, "robo");
            if (carta) entregarCarta(carta);
          }, ESPERA_CASILLA);
        }
        /* El control vuelve cuando la ficha llegó, no cuando frenó el dado:
           es lo que impide tirar otra vez con la ficha todavía en camino.
           Sólo por tu propia ficha —la del rival también avisa que llegó, y
           su recorrido no tiene por qué devolverte el turno. */
        if (lado === juego.miLado) setRolling(false);
        return;
      }

      const t = pendiente.current;
      if (!t || lado !== juego.active) return;
      pendiente.current = null;

      // 2. Los puntos que valió la tirada, ya con la ficha quieta.
      sumarPuntos(t);

      const cerrar = () => {
        resolverCasilla();
        /* Junto con el descuento, no antes: el destello es la explicación
           de por qué el número baja, y adelantado explicaría algo que
           todavía no pasó. */
        if (castiga) golpear(lado, "robo");
        if (t.isBust) setTimeout(endTurn, 900);
        else setRolling(false);
      };

      /* 3. Lo que la casilla dio o cobró.
         El respiro sólo se paga cuando hay algo que mostrar. Cuatro de cada
         cinco casillas están vacías, y ahí esa pausa era medio segundo
         mirando una pantalla quieta antes de poder volver a tirar —el
         "delay" no era una animación lenta sino una espera sin contenido. */
      if (tipo && tipo !== SQUARE.PLAIN) setTimeout(cerrar, ESPERA_CASILLA);
      else cerrar();
    },
    [
      online, juego.active, juego.miLado,
      sumarPuntos, resolverCasilla, endTurn, setRolling, golpear, forzarPlante,
      entregarCarta,
    ]
  );

  const plantarse = async () => {
    if (!online) {
      /* El sentido y los saltos vuelven POR EL RETORNO y no se leen del
         estado: `hold` acaba de llamar a `setSentido`, y eso se aplica
         diferido — leyéndolo acá el turno se iría para el lado de antes,
         justo en el turno en que se jugó la media vuelta. */
      const { gano, saltos, sentido } = juego.hold();
      if (!gano) juego.endTurn(saltos, sentido);
      return;
    }
    try {
      const r = await sala.holdScore(sala.roomId);
      /* A quién le llegaron: al de tu derecha, que es la MISMA regla con la
         que el servidor las acaba de resolver. Era `miLado === 0 ? 1 : 0` —
         "el otro"— y en una mesa de cuatro eso mandaba el golpe al asiento 1
         sin importar dónde estuvieras sentado: el destello rojo le caía a
         cualquiera menos a la víctima. */
      const victima = targetOf(sala.miLado, juego.players.length, juego.sentido);
      (r.resolved ?? []).forEach((x, i) => {
        const carta = { type: x.type, value: x.value };
        setTimeout(() => mostrarRevelacion(carta, x.blocked, victima), i * 1500);
      });

      /* ►► Y el salto y la media vuelta, para EL QUE LAS JUGÓ. ◄◄
       *
       * Acá no había nada, y era un agujero de verdad: en online el que
       * jugaba una carta de flujo no se enteraba de nada. Las tres puertas
       * por las que podía llegarle estaban cerradas a la vez —
       *
       *   · el motor local no corre en online, así que sus hechos —los que
       *     arman el cartel en la mesa local— nunca se emiten;
       *   · el sondeo DESCARTA tus propios eventos a propósito
       *     (`ev.sessionId !== getSessionId()` en useOnlineRoom), porque
       *     todo lo demás ya te lo contó tu propia pantalla;
       *   · y acá sólo se leía `resolved`, que trae los ATAQUES. El flujo
       *     viene aparte, en `saltos` / `vueltas` / `sentido`.
       *
       * O sea que los datos venían en la respuesta desde siempre y nadie los
       * miraba. Lo peor: el comentario del sondeo decía "el que las jugó ya
       * lo vio en su pantalla" — y era falso. Sonaba a que estaba resuelto.
       *
       * Los textos salen de `MENSAJES`, la misma tabla que usa la mesa
       * local. Escribirlos de nuevo acá serían dos redacciones de lo mismo
       * que se despegan en cuanto alguien retoque una.
       *
       * Van DESPUÉS de los ataques, con la misma pausa: es el orden en que
       * el servidor los resolvió y el mismo que usa la mesa local. Encimados
       * con las cartas volando, el cartel explicaría algo mientras en
       * pantalla todavía está pasando otra cosa. */
      const espera = (r.resolved?.length ?? 0) * 1500;
      const contar = (armar, hecho) => {
        const [texto] = armar(hecho);
        setTimeout(() => anunciar(texto), espera);
      };
      if (r.vueltas) {
        contar(MENSAJES.mediaVuelta, { sentido: sentidoDe(r.sentido) });
      }
      if (r.saltos) {
        contar(MENSAJES.salto, { saltos: r.saltos, mesa: juego.players.length });
      }
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  /* Llegar al objetivo termina la partida sola.
   *
   * Plantarse es una DECISIÓN: se elige entre guardar lo del turno o seguir
   * arriesgando. Con el acumulado ya en 100 esa decisión no existe —seguir
   * tirando no puede mejorar nada y sí puede quemar el turno—, así que
   * pedir el botón era pedir un trámite. Con 95 y un 6 en el dado ya
   * ganaste; el botón sólo servía para enterarte.
   *
   * Se dispara el MISMO plantarse que el botón en vez de declarar el final
   * por afuera: plantarse revela las cartas puestas, cobra los robos y
   * recién ahí mide contra el objetivo. Un final aparte se saltearía todo
   * eso y dejaría cartas boca abajo sobre la mesa de una partida terminada.
   *
   * El disparo espera a `rolling` en bajo, que es la señal de que el turno
   * terminó de resolverse. Antes de eso el acumulado todavía puede subir por
   * el dado y bajar por la casilla: en una penitencia, el marcador toca 100
   * un instante y vuelve a 94, y mirando ese instante se declararía un
   * ganador que no ganó. */
  const cerrandoPorMeta = useRef(false);
  /* El espejo se escribe en un efecto y no durante el pintado: `plantarse`
     se arma de nuevo en cada vuelta, así que listarlo en las dependencias
     del efecto de abajo lo dispararía en todas. Y el efecto que lo copia va
     declarado ANTES que el que lo lee, porque React los corre en ese
     orden. */
  const plantarseRef = useRef(plantarse);
  useEffect(() => {
    plantarseRef.current = plantarse;
  });

  /* Cae después del cierre por objetivo a propósito: si la última tirada
     además llegó a la meta, gana — y ganar le gana a perder el turno. */
  useEffect(() => {
    if (plantarKey === null || !plantarForzado.current) return;
    if (!juego.playing || juego.finished || juego.rolling) return;
    plantarForzado.current = false;
    plantarseRef.current();
  }, [plantarKey, juego.playing, juego.finished, juego.rolling]);

  useEffect(() => {
    if (juego.finished) {
      cerrandoPorMeta.current = false;
      return;
    }
    if (!juego.playing || juego.rolling) return;
    /* En online sólo se cierra el turno propio: el servidor rechaza un hold
       fuera de turno, y el del rival lo dispara su propia pantalla. */
    if (online && juego.active !== juego.miLado) return;

    const p = juego.players[juego.active];
    if (!p) return;
    if ((p.score ?? 0) + (p.current ?? 0) < juego.goal) return;

    /* Una sola vez por partida: en online el sondeo vuelve a escribir los
       jugadores cada dos segundos, y sin esto cada repetición mandaría otro
       hold contra una sala ya terminada. */
    if (cerrandoPorMeta.current) return;
    cerrandoPorMeta.current = true;
    plantarseRef.current();
  }, [
    juego.players, juego.active, juego.playing, juego.rolling,
    juego.finished, juego.goal, juego.miLado, online,
  ]);

  const jugarCarta = async (uid) => {
    if (!online) {
      juego.playCard(uid);
      return;
    }
    try {
      await sala.playCard(sala.roomId, uid);
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  /* Retirar una carta de la mesa. Mismo camino que jugarla, al revés. */
  const retirarCarta = async (uid) => {
    if (!online) {
      juego.takeBackCard(uid);
      return;
    }
    try {
      await sala.takeBackCard(sala.roomId, uid);
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  const volverAlMenu = () => {
    juego.setPlaying(false);
    juego.setFinished(false);
    /* Se suelta la partida: sin esto, escribir #/game en la barra volvería
       a entrar a una mesa que ya no existe. */
    juego.hayPartida.current = false;
    /* Se vacían los casilleros pero se conserva CUÁNTOS son: el largo lo
       fijó el menú al elegir la mesa, y devolverlo a dos convertía la
       revancha de una partida de cuatro en un duelo. */
    setElegidos((prev) => prev.map(() => null));
    setEsperandoRival(false);
    /* Soltar la sala: sin esto queda viva hasta que vence.
       Sin el `if (online)` que tenía delante, y no es de más: era la otra
       mitad del mismo enredo. Con `online` mal calculado la sala no se
       soltaba, el `roomId` quedaba en el storage, y entonces el modo
       derivado de arriba leería "online" en la próxima partida local. Sin
       la guarda, salir siempre limpia — y limpiar cuando no hay nada que
       limpiar no cuesta nada: `leaveRoom(null)` ya devuelve sin llamar a la
       red. */
    sala.salir();
    go("menu");
  };

  /* Acá vivía `ladoRival`, que respondía "quién es el otro AHORA". Esa
     pregunta no sirve para una carta que tarda casi un segundo y medio en
     llegar: lo que hay que saber es a quién iba dirigida cuando salió, y
     eso ahora viaja dentro de la propia carta (`lanzada.destino`). */

  /* Hacia dónde vuela la carta: siempre hacia quien la recibe.
     En online vos te ves siempre abajo y el rival arriba, así que sube
     salvo que la carta venga para vos. En local no hay vuelta de
     posiciones y cada uno está donde manda su lado: el primero arriba, el
     segundo abajo.
     Sale del destinatario de la carta y no del turno por lo mismo que el
     destello: cuando la carta aterriza, el turno ya puede haber cambiado. */
  const vuelaHaciaArriba = lanzada
    ? celdaArriba(
        celdaDe(lanzada.destino, online ? juego.miLado : 0, juego.players.length),
        juego.players.length
      )
    : true;

  /* Antes esto eran dos ramas escritas a mano —"si es online, sube salvo
     que venga para vos; si es local, sube cuando va al asiento 0"— y las
     dos decían lo mismo por caminos distintos: que el asiento 0 se dibuja
     arriba y el 1 abajo. Con tres o cuatro celdas esa equivalencia se
     rompe. Ahora se le pregunta a la misma función que ubica a los
     peleadores, así que la carta no puede volar hacia un lado distinto de
     donde está dibujado el que la recibe. */

  const alAterrizar = useCallback(() => {
    const tipo = lanzada && !lanzada.bloqueada ? COLOR_IMPACTO[lanzada.carta.type] : null;
    /* El destinatario se lee de la carta y no del turno: la carta tarda casi
       un segundo y medio en llegar, y en local para entonces el turno ya
       cambió. Calculándolo acá, el destello rojo le caía al que la tiró. */
    const destino = lanzada?.destino;

    /* ►► El sonido va ANTES del corte de abajo, y ahí está la gracia. ◄◄
     *
     * Ese `return` existe para el caso bloqueado —no hay a quién teñir— así
     * que un sonido puesto después de él dejaría mudo exactamente el caso que
     * más falta hace oír. El escudo es la única jugada del juego cuyo
     * resultado depende de una carta que el atacante NO PODÍA VER: sin un
     * aviso propio, la carta simplemente no pasa nada y el que la tiró tiene
     * que deducir por qué.
     *
     * ►► Y va acá y no en `mostrarRevelacion`. ◄◄
     *
     * Aquélla es el momento en que la carta SALE; ésta, cuando LLEGA. El
     * golpe rojo ya se dispara desde acá por la misma razón —"el golpe
     * arranca cuando la carta llega, no cuando sale"— y el sonido tiene que
     * caer con él o se oiría el impacto segundo y medio antes de verlo.
     *
     * Este punto además es el único: `mostrarRevelacion` alimenta `lanzada`
     * desde los TRES caminos que revelan cartas —el hecho del motor local, tu
     * propio plantarse en línea y el del rival— así que acá suenan los tres
     * sin repetir la decisión en ninguno. */
    if (lanzada?.carta) sonarCarta(lanzada.carta.type, lanzada.bloqueada);

    setLanzada(null);
    if (!tipo || destino == null) return;
    /* El golpe arranca cuando la carta llega, no cuando sale. */
    golpear(destino, tipo);
  }, [lanzada, golpear]);


  const yo = online ? juego.players[juego.miLado] : juego.players[juego.active];
  /* En online el ganador lo declara el backend: deducirlo por puntaje se
     equivoca justo en el abandono, donde el que se queda suele ir
     perdiendo. */
  /* En online el ganador ya viene como asiento —el servidor lo normaliza—.
     En local se busca el puntaje más alto de la mesa en vez de comparar dos:
     `players[0] >= players[1]` era otra mesa de dos escrita a mano, y con
     cuatro habría coronado siempre a uno de los dos primeros. */
  const ganadorIdx = online
    ? sala.room?.winner ?? 0
    : juego.players.reduce(
        (mejor, p, i) => ((p?.score ?? -1) > (juego.players[mejor]?.score ?? -1) ? i : mejor),
        0
      );

  return (
    <>
      <Preloader />

      {/* El fieltro verde y el marco de madera son de la mesa, y la mesa
          sólo existe en el versus. En el resto —incluidos los instantes de
          transición, que es donde asomaba el verde— el fondo es negro. */}
      <div className={`table ${screen === "game" ? "on-versus" : "on-title"}`}>
        <div className="smoke">
          <div className="smoke-wisp" />
          <div className="smoke-wisp" />
          <div className="smoke-wisp" />
        </div>

        {screen === "title" && (
          <TitleScreen
            /* Al vestíbulo si vino por un enlace, al menú si no. La misma
               pantalla y el mismo botón; lo único que cambia es a dónde
               abre. */
            onStart={() => go(invitado.current ? "room-choice" : "menu")}
          />
        )}

        {screen === "menu" && (
          <MenuScreen
            onPick={(item) => {
              setModo(item.modo);
              /* Cuántas sillas tiene esta mesa. Se arman los casilleros de
                 selección acá y no en la pantalla de gatos para que ésta no
                 tenga que saber de modos: recibe un array y lo llena. */
              setElegidos(Array(item.jugadores ?? 2).fill(null));
              go(item.ruta);
            }}
            onBack={() => go("title")}
          />
        )}

        {screen === "room-choice" && (
          <RoomChoiceScreen
            codigo={sala.roomId}
            sala={sala.room}
            miLado={sala.miLado}
            onCreate={crearSala}
            onJoin={unirseASala}
            onStart={empezarSala}
            onCancel={volverAlMenu}
            onBack={volverAlMenu}
          />
        )}

        {screen === "select" && (
          <SelectScreen
            online={online}
            elegidos={elegidosVista}
            miLado={sala.miLado}
            esperando={esperandoRival}
            onPick={elegir}
            onPlay={jugar}
            onBack={volverAlMenu}
          />
        )}

        {screen === "game" && (
          <VersusScreen
            board={juego.board}
            players={juego.players}
            active={juego.active}
            playing={juego.playing}
            rolling={juego.rolling}
            goal={juego.goal}
            tirada={tirada}
            esperandoTirada={pidiendoTirada}
            entregandoBonus={Boolean(cartaGanada)}
            dobles={Boolean(yo?.doubleNext)}
            revelada={revelada}
            online={online}
            miLado={juego.miLado}
            sentido={juego.sentido}
            /* ►► La borrosidad espera a que se vea la copa. ◄◄
               El estado ya dice que estás borracho —lo aplicó el motor o el
               servidor— pero mostrarlo en el mismo cuadro en que aparece la
               carta arruina las dos cosas: la copa se lee sobre una mesa que
               ya se nubló, y la nube llega sin que se entienda de dónde.
               Se retrasa la PRESENTACIÓN, no el estado: los puntos, los
               turnos y todo lo demás ya ocurrieron. */
            sirviendo={cartaGanada?.type === CARD.BEER}
            impacto={impacto}
            onRoll={tirar}
            onHold={plantarse}
            onPlayCard={jugarCarta}
            onTakeBackCard={retirarCarta}
            onSettleRoll={alFrenar}
            onLlegada={alLlegar}
            onTiempoAgotado={alAgotarseElTiempo}
            retrasoCasilla={ESPERA_CASILLA}
          />
        )}

        {screen === "gameover" && (
          <GameOverScreen
            jugadores={juego.players}
            ganadorIdx={ganadorIdx}
            porAbandono={Boolean(sala.room?.endedByAbandon)}
            online={online}
            onRematch={jugar}
            onExit={volverAlMenu}
          />
        )}

        <div className="particle-layer" />
      </div>

      {/* Fuera de las pantallas: cada una se apaga con display:none y estos
          tienen que sobrevivir a los cambios. */}
      {(screen === "menu" || screen === "game") && (
        <button
          className="rules-open"
          aria-label="Ver las reglas"
          onClick={() => setReglasAbiertas(true)}
        >
          ?
        </button>
      )}

      {/* ►► La salida de la partida. ◄◄
       *
       * Acá afuera y no adentro de VersusScreen, por el mismo motivo que el
       * botón de reglas: las pantallas se apagan con `display:none` y estos
       * dos tienen que sobrevivir a los cambios.
       *
       * Reusa `volverAlMenu`, que ya suelta el asiento con `sala.salir()` —
       * el mismo camino del abandono, ya probado: la mesa se cierra sobre el
       * hueco, los objetivos se recalculan y a los demás les llega el aviso.
       * Un "salir" escrito aparte sería una segunda copia de esa salida
       * esperando a desincronizarse con la primera.
       *
       * Sin condición de turno ni de estado: está siempre. La razón de que
       * exista es justamente el rato en que NADA responde, y un botón que se
       * apaga cuando el juego se traba no serviría para nada. */}
      {screen === "game" && <SalirPartida onSalir={volverAlMenu} />}

      <CardCast
        key={lanzada?.key}
        carta={lanzada?.carta}
        bloqueada={lanzada?.bloqueada}
        haciaArriba={vuelaHaciaArriba}
        onDone={alAterrizar}
      />
      {/* Turno perdido, en el medio de la PANTALLA y no de la mesa.
          Vivía adentro de la arena del dado, que está centrada en el
          fieltro: el cartel quedaba atado a dónde cae la mesa en cada
          tamaño de ventana en vez de al centro de lo que mira el jugador.
          Y estaba muerto —el CSS pedía una clase `.show` que nadie ponía—,
          así que en la práctica el juego nunca avisó de una quemada.
          Acá afuera, junto al resto de los anuncios a pantalla completa,
          además sobrevive a que la pantalla cambie debajo. */}
      <Alerta alerta={alerta} />

      <CardGained carta={cartaGanada} onDone={() => setCartaGanada(null)} />
      <RulesModal abierta={reglasAbiertas} onClose={() => setReglasAbiertas(false)} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
