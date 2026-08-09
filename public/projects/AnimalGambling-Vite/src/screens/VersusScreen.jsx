import Board from "../components/Board";
import BonusDeck from "../components/BonusDeck";
import Dice from "../components/Dice";
import Fighter from "../components/Fighter";
import Hand from "../components/Hand";
import PlayedCard from "../components/PlayedCard";

/* La mesa.
 *
 * `miLado` es de quién es esta pantalla: en online cada uno ve la suya y
 * tiene que verse siempre abajo. Como f1 es el de arriba, al que le tocó
 * ser player1 se le dan vuelta las posiciones — no los elementos: cada
 * peleador conserva su identidad, sólo cambia dónde se dibuja.
 * En local no aplica, los dos miran la misma pantalla.
 */
export default function VersusScreen({
  board,
  players,
  active,
  playing,
  rolling,
  goal,
  tirada,
  esperandoTirada,
  entregandoBonus,
  dobles,
  revelada,
  online,
  miLado = 0,
  impacto,
  onRoll,
  onHold,
  onPlayCard,
  onSettleRoll,
  onLlegada,
  retrasoCasilla,
}) {
  const flip = online && miLado === 0;

  /* En local juega el que está activo; en online, siempre vos. */
  const yo = players[online ? miLado : active];
  const miTurno = !online || active === miLado;
  const puedeActuar = playing && !rolling && miTurno;

  const pendientes = players.flatMap((p) => p?.pendingCards ?? []);

  /* La meta se anuncia sólo antes del primer dado: es la regla que hay que
     saber para empezar, y una vez que la partida arrancó los marcadores ya
     dicen a cuánto está cada uno.
     Se deduce del estado en vez de guardar una bandera aparte, porque una
     bandera habría que reiniciarla en cada partida, sincronizarla en online
     y acordarse de apagarla al reconectar; esto ya es cierto o falso solo,
     y vale igual en los dos modos. Cualquier tirada mueve la ficha, así que
     `pos` sola alcanzaría; los puntos van además por si alguien entra a una
     partida ya empezada. */
  const arrancando = players.every(
    (p) => !p || ((p.pos ?? 0) === 0 && (p.score ?? 0) === 0 && (p.current ?? 0) === 0)
  );

  return (
    <section className={`screen versus-screen active${flip ? " flip" : ""}`}>
      {players.map((p, i) => (
        <Fighter
          key={i}
          jugador={p}
          lado={i}
          activo={playing && i === active}
          /* Sólo la del rival: la propia ya está en el abanico de abajo. */
          mostrarMano={online && i !== miLado}
          impacto={impacto?.lado === i ? impacto.tipo : null}
        />
      ))}

      <div className="pool-table">
        <div className="pool-felt">
          <Board
            board={board}
            players={players}
            onLlegada={onLlegada}
            retrasoCasilla={retrasoCasilla}
          />

          <div className="dice-arena">
            <div className={`pool-goal${arrancando ? "" : " oculto"}`}>
              primero a <span className="num">{goal}</span>
            </div>
            <Dice
              tirada={tirada}
              esperando={esperandoTirada}
              dobles={dobles}
              onSettle={onSettleRoll}
              onRoll={onRoll}
              puedeTirar={puedeActuar}
            />
            <div className="snake-eyes-warning">× TE QUEMASTE ×</div>
          </div>

          <PlayedCard pendientes={pendientes} revelada={revelada} />

          {/* Abajo a la izquierda del fieltro, en espejo de las cartas
              jugadas: es de donde sale la carta al caer en bonus, y verlo
              ahí explica la animación sin necesidad de un cartel. */}
          <BonusDeck entregando={entregandoBonus} />
        </div>
      </div>

      <Hand
        cartas={yo?.hand}
        habilitada={puedeActuar}
        onPlay={onPlayCard}
      />

      <div className="versus-controls">
        {/* Tirar y plantarse hacen cosas opuestas y no hay deshacer: por eso
            van separados y grandes. */}
        <button className="btn-nav" disabled={!puedeActuar} onClick={onRoll}>
          Tirar dado
        </button>
        <button
          className="btn-nav secondary"
          disabled={!puedeActuar}
          onClick={onHold}
        >
          Plantarse
        </button>
      </div>
    </section>
  );
}
