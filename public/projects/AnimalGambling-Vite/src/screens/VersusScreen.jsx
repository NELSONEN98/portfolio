import Board from "../components/Board";
import BonusDeck from "../components/BonusDeck";
import Dice from "../components/Dice";
import Fighter from "../components/Fighter";
import Hand from "../components/Hand";
import PlayedCard from "../components/PlayedCard";
import { DadoIcon, HaltIcon } from "../components/icons";
import { CARD } from "../../convex/rules";

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

  /* De quién son las cartas que se muestran: en online siempre tuyas, en
     local las del que está jugando el turno. Es el índice del JUGADOR, no
     el lado en que se dibuja — de eso se encarga el grid, que con el flip
     manda cada peleador a la celda del otro. */
  const ladoMano = online ? miLado : active;

  /* Las defensas salen del abanico. No se juegan —se gastan solas cuando te
     atacan— así que en la mano ocupaban lugar sin ser nunca una opción, y
     encima había que dibujarlas apagadas para que se notara. Van al lado del
     marcador, que es donde vive el resto de lo que tenés sin poder usar.

     Sólo las tuyas: cuántas defensas tiene el rival es justamente lo que el
     juego esconde hasta que una frena un ataque. */
  const enMano = yo?.hand ?? [];
  const jugables = enMano.filter((c) => c.type !== CARD.DEFENSE);
  const defensas = enMano.filter((c) => c.type === CARD.DEFENSE);

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
      {/* Cada peleador con sus cartas en la misma línea: CARTAS · PUNTAJE ·
          PERSONAJE, con el abanico hacia afuera y el dibujo hacia la mesa.
          Antes el abanico flotaba en un costado fijo y reservaba una franja
          entera de alto; en la línea del dueño no le saca nada a la mesa y
          se ve de quién son las cartas sin tener que deducirlo. */}
      {players.map((p, i) => (
        <div
          className={`fighter-linea f${i + 1}${ladoMano === i ? " con-cartas" : ""}`}
          key={i}
        >
          {ladoMano === i && (
            <Hand cartas={jugables} habilitada={puedeActuar} onPlay={onPlayCard} lado={i} />
          )}
          <Fighter
            jugador={p}
            lado={i}
            activo={playing && i === active}
            /* Sólo la del rival: la propia ya está en su abanico. */
            mostrarMano={online && i !== miLado}
            impacto={impacto?.lado === i ? impacto.tipo : null}
            defensas={ladoMano === i ? defensas : null}
          />
        </div>
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
          </div>

          {/* Fuera de la arena del dado y directo sobre el fieltro: los
              cubos ruedan por toda la mesa, así que el lienzo tiene que
              cubrirla entera. Va después del tablero para quedar por encima
              de las casillas. */}
          <Dice
            tirada={tirada}
            esperando={esperandoTirada}
            dobles={dobles}
            onSettle={onSettleRoll}
            onRoll={onRoll}
            puedeTirar={puedeActuar}
          />

          <PlayedCard pendientes={pendientes} revelada={revelada} />

          {/* Abajo a la izquierda del fieltro, en espejo de las cartas
              jugadas: es de donde sale la carta al caer en bonus, y verlo
              ahí explica la animación sin necesidad de un cartel. */}
          <BonusDeck entregando={entregandoBonus} />
        </div>
      </div>


      {/* Tirar y plantarse hacen cosas opuestas y no hay deshacer, así que se
          distinguen por forma y por tamaño y no sólo por color: el cuadrado
          grande tira, el círculo chico se planta. Un pulgar apurado puede
          confundir dos rectángulos iguales; dos siluetas distintas, no.
          El rótulo sale sobrando —son los dos únicos botones de la partida y
          se aprietan decenas de veces— pero sigue en `aria-label` y en el
          `title`, que es de donde lo toma quien no ve el dibujo. */}
      <div className="versus-controls">
        <button
          className="btn-accion tirar"
          disabled={!puedeActuar}
          onClick={onRoll}
          title="Tirar dado"
          aria-label="Tirar dado"
        >
          <DadoIcon />
        </button>
        <button
          className="btn-accion plantarse"
          disabled={!puedeActuar}
          onClick={onHold}
          title="Plantarse"
          aria-label="Plantarse"
        >
          <HaltIcon />
        </button>
      </div>
    </section>
  );
}
