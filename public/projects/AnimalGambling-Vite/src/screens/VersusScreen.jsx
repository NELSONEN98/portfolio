import Board from "../components/Board";
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
  dobles,
  revelada,
  online,
  miLado = 0,
  onRoll,
  onHold,
  onPlayCard,
  onSettleRoll,
  onOpenRules,
}) {
  const flip = online && miLado === 0;

  /* En local juega el que está activo; en online, siempre vos. */
  const yo = players[online ? miLado : active];
  const miTurno = !online || active === miLado;
  const puedeActuar = playing && !rolling && miTurno;

  const pendientes = players.flatMap((p) => p?.pendingCards ?? []);

  return (
    <section className={`screen versus-screen active${flip ? " flip" : ""}`}>
      {players.map((p, i) => (
        <Fighter
          key={i}
          jugador={p}
          lado={i}
          activo={playing && i === active}
        />
      ))}

      <div className="pool-table">
        <div className="pool-felt">
          <Board board={board} players={players} />

          <div className="dice-arena">
            <div className="pool-goal">
              primero a <span className="num">{goal}</span>
            </div>
            <Dice tirada={tirada} dobles={dobles} onSettle={onSettleRoll} />
            <div className="snake-eyes-warning">× TE QUEMASTE ×</div>
          </div>

          <PlayedCard pendientes={pendientes} revelada={revelada} />
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
