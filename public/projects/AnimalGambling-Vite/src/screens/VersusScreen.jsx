import Board from "../components/Board";
import BonusDeck from "../components/BonusDeck";
import Dice from "../components/Dice";
import Fighter from "../components/Fighter";
import Hand from "../components/Hand";
import PlayedCard from "../components/PlayedCard";
import { DadoIcon, HaltIcon } from "../components/icons";
import Reparto from "../components/Reparto";
import { useApertura } from "../hooks/useApertura";
import { CARD, STARTING_CARDS } from "../../convex/rules";

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
  onTakeBackCard,
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
  /* La cerveza nubla la mesa del que la tiene encima. `yo` ya es el jugador
     correcto en los dos modos —en online siempre vos, en local el que está
     jugando el turno— así que en la pantalla compartida la borrosidad va y
     viene con el turno, que es lo que corresponde: el castigo es de uno. */
  const borroso = (yo?.beerTurns ?? 0) > 0;

  /* La maldición tiñe la mesa entera de morado. Se mira al MISMO jugador
     con cuyos ojos se dibuja el camino —en online vos, en local el que está
     jugando el turno— porque es el que sufre la condena y el único que
     tiene que verla. En la pantalla compartida el morado va y viene con el
     turno, igual que los bonus convertidos. */
  const maldito = (players[ladoMano]?.curseTurns ?? 0) > 0;
  /* Cuántas cervezas encima. Se apilan, así que dos cartas nublan el doble.
     Va al CSS como número y no como una clase por nivel: el filtro lo
     multiplica solo y agregar un escalón no obliga a tocar nada acá. */
  const borrachera = borroso ? Math.max(1, yo?.beerStacks ?? 1) : 0;

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

  /* ►► La apertura. ◄◄
   * Corre una sola vez, al montarse la pantalla — que es exactamente una vez
   * por partida, porque App monta esto sólo mientras `screen === "game"`.
   * `arrancando` la desactiva al reconectar a una partida ya empezada:
   * repartir de nuevo unas cartas que el jugador ya tiene sería mentir sobre
   * el estado de la mesa. */
  /* La constante y no `startingHand().length`: ahora la mano se sortea, así
     que contarla llamando a la función significaba repartir una mano de
     verdad —con su azar— sólo para medirla. */
  const porJugador = STARTING_CARDS;
  const apertura = useApertura(porJugador * players.length, arrancando);

  return (
    /* `mesa-N` le dice al CSS cuántas sillas hay que acomodar. Sin esto, con
       cuatro jugadores las líneas f3 y f4 no encuentran su `grid-area` y el
       navegador las tira en celdas automáticas, encima de la mesa. */
    <section
      className={`screen versus-screen active mesa-${players.length}${flip ? " flip" : ""}${borroso ? " borroso" : ""}${maldito ? " maldito" : ""}`}
      style={borroso ? { "--borrachera": borrachera } : undefined}
    >
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
          {/* El abanico se monta SIEMPRE, vacío durante la apertura. No es
              un rodeo: vacío reserva su lugar y el reparto puede medir a
              dónde tiene que tirar las cartas. Sin él en el DOM, el destino
              caía al centro de la línea, o sea encima del personaje y del
              puntaje. Y no se ve nada hasta que hay cartas que ver. */}
          {ladoMano === i && (
            <Hand
              cartas={apertura.muestraMano ? jugables : []}
              habilitada={puedeActuar}
              onPlay={onPlayCard}
              lado={i}
            />
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
            /* Con qué ojos se dibuja el camino. Es la misma cuenta que
               decide de quién son las cartas del abanico: en online siempre
               vos, en local el que está jugando el turno. */
            mirandoLado={ladoMano}
            onLlegada={onLlegada}
            retrasoCasilla={retrasoCasilla}
          />

          <div className="dice-arena">
            {/* Se va cuando aparece el dado, no cuando alguien tira: la
                apertura es la que decide, y el dado entrando es la señal de
                que ya se puede jugar. */}
            <div className={`pool-goal${apertura.muestraReglas ? "" : " oculto"}`}>
              primero a <span className="num">{goal}</span>
            </div>
          </div>

          {/* Fuera de la arena del dado y directo sobre el fieltro: los
              cubos ruedan por toda la mesa, así que el lienzo tiene que
              cubrirla entera. Va después del tablero para quedar por encima
              de las casillas. */}
          {/* No se monta hasta que terminó el reparto, y eso es lo que le da
              la bocanada gratis: la escena crea su primer cubo al montarse, y
              `setCantidad` suelta humo por cada dado que aparece. No hay nada
              especial que disparar acá. */}
          {apertura.muestraDado && (
            <Dice
              tirada={tirada}
              esperando={esperandoTirada}
              dobles={dobles}
              onSettle={onSettleRoll}
              onRoll={onRoll}
              puedeTirar={puedeActuar}
            />
          )}

          {/* Retirar sólo lo tuyo y sólo mientras siga boca abajo: durante
              la revelación las cartas ya están contando lo que hacen y
              levantarlas ahí sería deshacer algo que el rival ya vio. */}
          <PlayedCard
            pendientes={pendientes}
            revelada={revelada}
            puedeRetirar={puedeActuar && !revelada}
            onRetirar={onTakeBackCard}
          />

          {/* Abajo a la izquierda del fieltro, en espejo de las cartas
              jugadas: es de donde sale la carta al caer en bonus, y verlo
              ahí explica la animación sin necesidad de un cartel. */}
          <BonusDeck entregando={entregandoBonus} />

          {apertura.reparte && (
            <Reparto
              jugadores={players.length}
              porJugador={porJugador}
              ladoMano={ladoMano}
            />
          )}
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
