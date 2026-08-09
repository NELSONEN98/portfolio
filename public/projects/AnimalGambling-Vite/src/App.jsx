import { useCallback, useEffect, useState } from "react";

import { useGame, newPlayer } from "./hooks/useGame";
import { useRouter } from "./hooks/useRouter";
import { useToasts, errorText } from "./hooks/useToasts";
import { useOnlineRoom } from "./hooks/useOnlineRoom";
import { ROSTER, charFromCatId, warmRosterFrames } from "./roster";

import Preloader from "./components/Preloader";
import Toasts from "./components/Toasts";
import RulesModal from "./components/RulesModal";
import CardGained from "./components/CardGained";

import TitleScreen from "./screens/TitleScreen";
import MenuScreen from "./screens/MenuScreen";
import RoomChoiceScreen from "./screens/RoomChoiceScreen";
import SelectScreen from "./screens/SelectScreen";
import VersusScreen from "./screens/VersusScreen";
import GameOverScreen from "./screens/GameOverScreen";

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

  const [modo, setModo] = useState("local");
  const [elegidos, setElegidos] = useState([null, null]);
  const [tirada, setTirada] = useState(null);
  const [revelada, setRevelada] = useState(null);
  const [reglasAbiertas, setReglasAbiertas] = useState(false);
  const [esperandoRival, setEsperandoRival] = useState(false);
  /* La carta que acabás de ganar, mientras dura su entrega. Sólo se llena
     para el jugador que la recibió: al rival no se le muestra. */
  const [cartaGanada, setCartaGanada] = useState(null);

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
  useEffect(() => {
    if (!juego.events.length) return;
    juego.events.forEach((e) => {
      const armar = MENSAJES[e.tipo];
      const aviso = armar?.(e);
      if (aviso) notify(...aviso);
      if (e.tipo === "cartaRevelada") setRevelada({ carta: e.carta, bloqueada: e.bloqueada });
      if (e.tipo === "bonus" && e.carta) setCartaGanada(e.carta);
      if (e.tipo === "ganado") juego.setFinished(true);
    });
    juego.consumeEvents();
  }, [juego, notify]);

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

    if (Array.isArray(r.board) && r.board.length) juego.setBoard(r.board);
    if (typeof r.goal === "number") juego.setGoal(r.goal);
    juego.setMiLado(sala.miLado);

    const lados = [r.player1, r.player2];
    juego.setPlayers((prev) =>
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

    juego.setActive(r.turn === "player1" ? 0 : 1);

    if (r.status === "finished" && !juego.finished) {
      if (r.endedByAbandon) notify("Tu rival se levantó de la mesa");
      juego.setFinished(true);
    }
  }, [sala.room, sala.miLado, online, juego, notify]);

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
        setTimeout(
          () => setRevelada({ carta: { type: r.type, value: r.value }, bloqueada: r.blocked }),
          i * 900
        );
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
    juego.hayPartida.current = true;
    juego.setPlaying(true);
    juego.setFinished(false);
    go("game");
  }, [online, esperandoRival, sala.room, juego, go]);

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
    juego.setRolling(true);
    try {
      const r = await sala.rollDice(sala.roomId);
      setTirada({ dice: r.dice, isBust: r.isBust, gained: r.gained ?? 0 });
      /* Llega por la respuesta de la propia tirada y no por el sondeo: así
         la entrega la ve sólo quien la ganó. Por el sondeo pasa también por
         la pantalla del rival. */
      if (r.gainedCard) {
        setTimeout(() => setCartaGanada(r.gainedCard), 700);
      }
    } catch (e) {
      juego.setRolling(false);
      notify(errorText(e), "error");
    }
  };

  /* El estado cambia recién cuando el dado frenó: si se aplicara al pedir
     la tirada, el marcador se movería antes de que se vea la cara. */
  const alFrenar = (t) => {
    setTirada(null);
    /* En online el estado ya lo aplicó el servidor y llega por el sondeo:
       tocarlo acá además sería contar la jugada dos veces. */
    if (online) {
      juego.setRolling(false);
      return;
    }
    juego.settleRoll(t);
    if (t.isBust) setTimeout(juego.endTurn, 900);
    else juego.setRolling(false);
  };

  const plantarse = async () => {
    if (!online) {
      const { gano } = juego.hold();
      if (!gano) juego.endTurn();
      return;
    }
    try {
      const r = await sala.holdScore(sala.roomId);
      (r.resolved ?? []).forEach((x, i) => {
        setTimeout(
          () => setRevelada({ carta: { type: x.type, value: x.value }, bloqueada: x.blocked }),
          i * 900
        );
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
            dobles={Boolean(yo?.doubleNext)}
            revelada={revelada}
            online={online}
            miLado={juego.miLado}
            onRoll={tirar}
            onHold={plantarse}
            onPlayCard={jugarCarta}
            onSettleRoll={alFrenar}
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

      <CardGained carta={cartaGanada} onDone={() => setCartaGanada(null)} />
      <RulesModal abierta={reglasAbiertas} onClose={() => setReglasAbiertas(false)} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
