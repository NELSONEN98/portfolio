import { useCallback, useEffect, useState } from "react";

import { useGame, newPlayer } from "./hooks/useGame";
import { useRouter } from "./hooks/useRouter";
import { useToasts } from "./hooks/useToasts";
import { ROSTER, warmRosterFrames } from "./roster";

import Preloader from "./components/Preloader";
import Toasts from "./components/Toasts";
import RulesModal from "./components/RulesModal";

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
  bonus: (e) => [`Bonus — carta nueva para ${e.nombre}`],
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
  const { toasts, notify, dismiss } = useToasts();

  const [modo, setModo] = useState("local");
  const [elegidos, setElegidos] = useState([null, null]);
  const [tirada, setTirada] = useState(null);
  const [revelada, setRevelada] = useState(null);
  const [reglasAbiertas, setReglasAbiertas] = useState(false);

  const online = modo === "online";

  /* Sin jugadores no hay mesa ni final: entrar a #/game escribiendo la URL
     tiene que devolver al principio en vez de romper. */
  const puedeEntrar = useCallback(
    (destino) => {
      if ((destino === "game" || destino === "gameover") && !juego.players[0]) return "title";
      return destino;
    },
    [juego.players]
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
      if (armar) notify(...armar(e));
      if (e.tipo === "cartaRevelada") setRevelada({ carta: e.carta, bloqueada: e.bloqueada });
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

  const elegir = (i) => {
    setElegidos(([p1, p2]) => {
      if (online) return [i, null];
      if (p1 === null) return [i, null];
      if (p1 === i) return [null, null];
      return [p1, i];
    });
  };

  const jugar = () => {
    const [p1, p2] = elegidos;
    juego.start(newPlayer(ROSTER[p1]), newPlayer(ROSTER[p2 ?? (p1 + 1) % ROSTER.length]));
    go("game");
  };

  const tirar = () => {
    const t = juego.roll();
    if (t) setTirada(t);
  };

  /* El estado cambia recién cuando el dado frenó: si se aplicara al pedir
     la tirada, el marcador se movería antes de que se vea la cara. */
  const alFrenar = (t) => {
    juego.settleRoll(t);
    setTirada(null);
    if (t.isBust) setTimeout(juego.endTurn, 900);
    else juego.setRolling(false);
  };

  const plantarse = () => {
    const { gano } = juego.hold();
    if (!gano) juego.endTurn();
  };

  const volverAlMenu = () => {
    juego.setPlaying(false);
    juego.setFinished(false);
    setElegidos([null, null]);
    go("menu");
  };

  const yo = online ? juego.players[juego.miLado] : juego.players[juego.active];
  const ganadorIdx = juego.players[0]?.score >= (juego.players[1]?.score ?? 0) ? 0 : 1;

  return (
    <>
      <Preloader />

      <div className="table">
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
            codigo={null}
            onCreate={() => notify("El online se conecta en el paso siguiente")}
            onJoin={() => notify("El online se conecta en el paso siguiente")}
            onCancel={() => go("menu")}
            onBack={() => go("menu")}
          />
        )}

        {screen === "select" && (
          <SelectScreen
            online={online}
            elegidos={elegidos}
            esperando={false}
            onPick={elegir}
            onPlay={jugar}
            onBack={() => go("menu")}
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
            onPlayCard={juego.playCard}
            onSettleRoll={alFrenar}
          />
        )}

        {screen === "gameover" && (
          <GameOverScreen
            ganador={juego.players[ganadorIdx]}
            perdedor={juego.players[ganadorIdx === 0 ? 1 : 0]}
            porAbandono={false}
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

      <RulesModal abierta={reglasAbiertas} onClose={() => setReglasAbiertas(false)} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
