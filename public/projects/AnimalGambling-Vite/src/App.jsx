import { useCallback, useEffect, useRef, useState } from "react";

import { useGame, newPlayer } from "./hooks/useGame";
import { useRouter } from "./hooks/useRouter";
import { useToasts, errorText } from "./hooks/useToasts";
import { useOnlineRoom } from "./hooks/useOnlineRoom";
import { ROSTER, charFromCatId, warmRosterFrames } from "./roster";

import Preloader from "./components/Preloader";
import Toasts from "./components/Toasts";
import RulesModal from "./components/RulesModal";
import CardGained from "./components/CardGained";
import CardCast, { COLOR_IMPACTO } from "./components/CardCast";

import TitleScreen from "./screens/TitleScreen";
import MenuScreen from "./screens/MenuScreen";
import RoomChoiceScreen from "./screens/RoomChoiceScreen";
import SelectScreen from "./screens/SelectScreen";
import VersusScreen from "./screens/VersusScreen";
import GameOverScreen from "./screens/GameOverScreen";
import { SQUARE } from "../convex/rules";
import { ms } from "./theme";

/* Cuánto queda teñido el peleador golpeado. Un pelo más que la animación
   del destello, para limpiar la clase con el movimiento ya terminado y no
   cortarlo en el último cuadro. */
const IMPACTO_MS = ms("peleador.golpeMarco") + 50;

/* El respiro entre los puntos del dado y lo que dice la casilla. */
const ESPERA_CASILLA = ms("tablero.esperaCasilla");

/* Traduce los hechos que emite el motor a los avisos que ve el jugador.
   El hook dice qué pasó; acá se decide cómo se cuenta. Esa separación es
   lo que permite que en React Native el mismo hecho dispare una vibración
   en lugar de un cartel. */
const MENSAJES = {
  penitencia: (e) => [`Penitencia — ${e.nombre} pierde ${e.puntos}`, "error"],
  /* Sin aviso cuando la carta se muestra sola: dos anuncios de lo mismo se
     pisan. El texto queda para el caso en que no hay carta que enseñar. */
  bonus: (e) => (e.carta ? null : [`Bonus — carta nueva para ${e.nombre}`]),
  bonusLleno: () => ["Bonus, pero la mano está llena"],
  dosDados: () => ["Dos dados en tu próxima tirada"],
  cartaPuesta: (e) => [
    e.cantidad > 1
      ? `${e.cantidad} cartas sobre la mesa — se revelan al plantarte`
      : "Carta sobre la mesa — se revela al plantarte",
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
    setPlayers, setActive, setBoard, setGoal, setMiLado,
    setPlaying, setFinished, setRolling, consumeEvents, hayPartida,
    sumarPuntos, resolverCasilla, endTurn,
  } = juego;

  const [modo, setModo] = useState("local");
  const [elegidos, setElegidos] = useState([null, null]);
  const [tirada, setTirada] = useState(null);
  const [revelada, setRevelada] = useState(null);
  const [reglasAbiertas, setReglasAbiertas] = useState(false);
  const [esperandoRival, setEsperandoRival] = useState(false);
  /* La carta que acabás de ganar, mientras dura su entrega. Sólo se llena
     para el jugador que la recibió: al rival no se le muestra. */
  const [cartaGanada, setCartaGanada] = useState(null);
  /* La carta que está viajando hacia el rival, y el golpe que deja al
     llegar. Van separados porque el destello arranca cuando la carta
     aterriza, no cuando sale. */
  const [lanzada, setLanzada] = useState(null);
  const [impacto, setImpacto] = useState(null);
  /* Se pidió la tirada al servidor y todavía no volvió. */
  const [pidiendoTirada, setPidiendoTirada] = useState(false);

  /* La carta que el servidor ya entregó pero que todavía no se mostró:
     espera a que la ficha frene para aparecer. */
  const cartaEnCamino = useRef(null);

  /* La casilla a la que el servidor mandó tu ficha, esperando a que el dado
     termine de girar. Viene en la respuesta de la propia tirada, no del
     sondeo: por el sondeo tardaba hasta dos segundos, y como el control se
     desbloqueaba al frenar el dado se podía tirar otra vez antes de que la
     ficha se moviera. Cuando por fin llegaba, traía las dos tiradas
     sumadas y la ficha caminaba de golpe un número que no se correspondía
     con ningún dado. */
  const posDelServidor = useRef(null);

  /* Tiñe a un peleador del color de lo que acaba de pasarle y lo deja
     volver solo. El mismo destello sirve para una carta que le llegó y para
     una casilla que lo castigó: en los dos casos perdió puntos, y mostrarlo
     distinto inventaría una diferencia que el juego no tiene. */
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
      const armar = MENSAJES[e.tipo];
      const aviso = armar?.(e);
      if (aviso) notify(...aviso);
      if (e.tipo === "cartaRevelada") {
        setRevelada({ carta: e.carta, bloqueada: e.bloqueada });
        setLanzada({
          carta: e.carta,
          bloqueada: e.bloqueada,
          destino: e.destino,
          key: Math.random(),
        });
      }
      if (e.tipo === "bonus" && e.carta) setCartaGanada(e.carta);
      /* El destello rojo de la penitencia NO se dispara acá aunque el hecho
         pase por este efecto: en online el motor local no resuelve casillas
         —lo hace el servidor— así que este evento nunca llegaría y el golpe
         sólo se vería en local. Lo avisa el tablero, que sabe dónde frenó la
         ficha en los dos modos. */
      if (e.tipo === "ganado") setFinished(true);
    });
    consumeEvents();
  }, [eventos, consumeEvents, setFinished, notify]);

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
    setMiLado(sala.miLado);

    const lados = [r.player1, r.player2];
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
          doubleNext: Boolean(lado.doubleNext),
        };
      })
    );

    setActive(r.turn === "player1" ? 0 : 1);

    if (r.status === "finished" && !juego.finished) {
      if (r.endedByAbandon) notify("Tu rival se levantó de la mesa");
      setFinished(true);
    }
    /* `juego.finished` se lee adentro pero NO va acá: sólo protege de
       declarar el final dos veces, y listarlo volvería a atar el efecto a
       un valor que él mismo escribe. La sala es lo único que debe
       dispararlo. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala.room, sala.miLado, online, setBoard, setGoal, setMiLado, setPlayers, setActive, setFinished, notify]);

  /* Lo que hizo el rival. El sondeo trae el hecho; acá se decide cómo se
     ve: la tirada se anima, la carta se da vuelta. */
  useEffect(() => {
    const ev = sala.novedad;
    if (!ev) return;
    sala.consumirNovedad();

    if (ev.action === "roll") {
      const dados = Array.isArray(ev.payload?.dice) ? ev.payload.dice : [ev.payload?.roll];
      setTirada({ dice: dados, isBust: Boolean(ev.payload?.isBust), gained: 0 });
      return;
    }
    if (ev.action === "hold" || ev.action === "hold_and_win") {
      (ev.payload?.resolved ?? []).forEach((r, i) => {
        // De a una y con pausa: juntas no se sabría cuál hizo qué.
        const carta = { type: r.type, value: r.value };
        setTimeout(() => {
          setRevelada({ carta, bloqueada: r.blocked });
          /* Esta novedad es del rival plantándose, así que la carta viene
             para vos: el golpe va en tu lado, no en el suyo. */
          setLanzada({
            carta,
            bloqueada: r.blocked,
            destino: sala.miLado,
            key: Math.random(),
          });
        }, i * 1500);
      });
    }
  }, [sala]);

  const elegir = (i) => {
    setElegidos(([p1, p2]) => {
      if (online) return [i, null];
      if (p1 === null) return [i, null];
      if (p1 === i) return [null, null];
      return [p1, i];
    });
  };

  const jugar = async () => {
    const [p1, p2] = elegidos;

    if (!online) {
      juego.start(newPlayer(ROSTER[p1]), newPlayer(ROSTER[p2 ?? (p1 + 1) % ROSTER.length]));
      go("game");
      return;
    }

    /* La mesa no se abre hasta que los dos eligieron: si no, el primero
       entraba a jugar contra un placeholder mientras el otro seguía
       eligiendo. */
    setEsperandoRival(true);
    try {
      const pick = ROSTER[p1];
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
    if (!r?.player1?.catId || !r?.player2?.catId) return;
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

  const crearSala = async () => {
    try {
      await sala.crear();
      notify("Sala creada — pasale el código a tu rival");
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  const unirseASala = async (codigo) => {
    if (!codigo) {
      notify("Pegá el código de la sala", "error");
      return;
    }
    try {
      await sala.unirse(codigo);
      go("select");
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  /* El que creó ve la pantalla de espera hasta que alguien entra. */
  useEffect(() => {
    if (!online || screen !== "room-choice") return;
    if (sala.room?.status === "playing") {
      notify("Tu rival entró — elegí tu gato");
      go("select");
    }
  }, [online, screen, sala.room, go, notify]);

  const tirar = async () => {
    if (!online) {
      const t = juego.roll();
      if (t) setTirada(t);
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
      setTirada({ dice: r.dice, isBust: r.isBust, gained: r.gained ?? 0 });
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
      if (pos == null) {
        /* Sin posición no hay recorrido que esperar, así que se devuelve el
           control en el acto: quedarse esperando un aviso que no va a
           llegar dejaría al jugador sin poder tirar. */
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
    pendiente.current = t;
    juego.settleRoll(t);
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
      const castiga = tipo === SQUARE.PENALTY;

      if (online) {
        /* El servidor ya resolvió puntos y casilla; lo único que falta es
           mostrarlo, y espera lo mismo que en local para que el turno se vea
           igual de los dos lados de la red. */
        const carta = cartaEnCamino.current;
        cartaEnCamino.current = null;
        if (castiga || carta) {
          setTimeout(() => {
            if (castiga) golpear(lado, "robo");
            if (carta) setCartaGanada(carta);
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
      sumarPuntos, resolverCasilla, endTurn, setRolling, golpear,
    ]
  );

  const plantarse = async () => {
    if (!online) {
      const { gano } = juego.hold();
      if (!gano) juego.endTurn();
      return;
    }
    try {
      const r = await sala.holdScore(sala.roomId);
      (r.resolved ?? []).forEach((x, i) => {
        const carta = { type: x.type, value: x.value };
        setTimeout(() => {
          setRevelada({ carta, bloqueada: x.blocked });
          /* Acá te plantaste vos, así que la carta va contra el rival. */
          setLanzada({
            carta,
            bloqueada: x.blocked,
            destino: sala.miLado === 0 ? 1 : 0,
            key: Math.random(),
          });
        }, i * 1500);
      });
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

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

  const volverAlMenu = () => {
    juego.setPlaying(false);
    juego.setFinished(false);
    /* Se suelta la partida: sin esto, escribir #/game en la barra volvería
       a entrar a una mesa que ya no existe. */
    juego.hayPartida.current = false;
    setElegidos([null, null]);
    setEsperandoRival(false);
    // Soltar la sala: sin esto queda viva hasta que vence.
    if (online) sala.salir();
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
    ? online
      ? lanzada.destino !== juego.miLado
      : lanzada.destino === 0
    : true;

  const alAterrizar = useCallback(() => {
    const tipo = lanzada && !lanzada.bloqueada ? COLOR_IMPACTO[lanzada.carta.type] : null;
    /* El destinatario se lee de la carta y no del turno: la carta tarda casi
       un segundo y medio en llegar, y en local para entonces el turno ya
       cambió. Calculándolo acá, el destello rojo le caía al que la tiró. */
    const destino = lanzada?.destino;
    setLanzada(null);
    if (!tipo || destino == null) return;
    /* El golpe arranca cuando la carta llega, no cuando sale. */
    golpear(destino, tipo);
  }, [lanzada, golpear]);


  const yo = online ? juego.players[juego.miLado] : juego.players[juego.active];
  /* En online el ganador lo declara el backend: deducirlo por puntaje se
     equivoca justo en el abandono, donde el que se queda suele ir
     perdiendo. */
  const ganadorIdx = online
    ? sala.room?.winner === "player2" ? 1 : 0
    : juego.players[0]?.score >= (juego.players[1]?.score ?? 0) ? 0 : 1;

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

        {screen === "title" && <TitleScreen onStart={() => go("menu")} />}

        {screen === "menu" && (
          <MenuScreen
            onPick={(item) => {
              setModo(item.modo);
              go(item.ruta);
            }}
            onBack={() => go("title")}
          />
        )}

        {screen === "room-choice" && (
          <RoomChoiceScreen
            codigo={sala.roomId}
            onCreate={crearSala}
            onJoin={unirseASala}
            onCancel={volverAlMenu}
            onBack={volverAlMenu}
          />
        )}

        {screen === "select" && (
          <SelectScreen
            online={online}
            elegidos={elegidos}
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
            impacto={impacto}
            onRoll={tirar}
            onHold={plantarse}
            onPlayCard={jugarCarta}
            onSettleRoll={alFrenar}
            onLlegada={alLlegar}
            retrasoCasilla={ESPERA_CASILLA}
          />
        )}

        {screen === "gameover" && (
          <GameOverScreen
            ganador={juego.players[ganadorIdx]}
            perdedor={juego.players[ganadorIdx === 0 ? 1 : 0]}
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

      <CardCast
        key={lanzada?.key}
        carta={lanzada?.carta}
        bloqueada={lanzada?.bloqueada}
        haciaArriba={vuelaHaciaArriba}
        onDone={alAterrizar}
      />
      <CardGained carta={cartaGanada} onDone={() => setCartaGanada(null)} />
      <RulesModal abierta={reglasAbiertas} onClose={() => setReglasAbiertas(false)} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
