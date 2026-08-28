import { useEffect, useRef, useState } from "react";
import {
  GOAL,
  CARD,
  CARD_LABEL,
  HAND_LIMIT,
  DEFENSE_LIMIT,
  CURSE_TURNS,
  CURSED_MAX_ROLL,
  BEER_TURNS,
  BEER_MAX_STACKS,
  PENALTY_POINTS,
  CURSED_BONUS_POINTS,
  PUNCH_POINTS,
  STEAL_VALUES,
  SQUARE,
  STARTING_CARDS,
} from "../../convex/rules";
import { SQUARE_ICON } from "./icons";
import { CardFace } from "./Hand";

/* Las reglas salen de las constantes reales, no de un texto escrito a
   mano: si mañana cambia el objetivo o lo que roba una carta, la
   explicación cambia sola en vez de quedar mintiendo.

   Y las muestras son los mismos componentes que dibujan el tablero y la
   mano, así que lo que se lee acá es exactamente lo que se ve jugando.

   Van en secciones y no en una lista larga porque todo junto no entraba en
   pantalla: siete reglas con sus muestras miden más que cualquier viewport,
   y el que abre esto suele venir por UNA cosa —qué hace una carta, qué
   pasa con el 1— no a leerlo entero. */

const SECCIONES = [
  { id: "juego", nombre: "EL JUEGO" },
  { id: "dado", nombre: "EL DADO" },
  { id: "mesa", nombre: "LA MESA" },
  { id: "cartas", nombre: "LAS CARTAS" },
];

function Regla({ n, titulo, children, extra, tono }) {
  return (
    <div className={`rules-rule${tono ? ` ${tono}` : ""}`}>
      <div className="rule-num">{n}</div>
      <div className="rule-content">
        <div className="rule-title">{titulo}</div>
        <div className="rule-text">{children}</div>
        {extra}
      </div>
    </div>
  );
}

function Item({ muestra, nombre, children }) {
  return (
    <div className="rule-item">
      {muestra}
      <div>
        <div className="rule-item-name">{nombre}</div>
        <div className="rule-item-text">{children}</div>
      </div>
    </div>
  );
}

function Casilla({ tipo }) {
  const Icono = SQUARE_ICON[tipo];
  return (
    <span className={`square ${tipo} rule-chip`}>{Icono ? <Icono /> : null}</span>
  );
}

function Carta({ tipo, value }) {
  return (
    <span className={`card ${tipo} rule-card`}>
      <CardFace carta={{ type: tipo, value }} />
    </span>
  );
}

/* La cara del 1, dibujada y no escrita: es la que hay que reconocer de un
   vistazo mientras el dado todavía rueda. */
const CaraUno = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <rect x="7" y="7" width="86" height="86" rx="18" />
    <circle cx="50" cy="50" r="10.5" />
  </svg>
);

export default function RulesModal({ abierta, onClose }) {
  const [seccion, setSeccion] = useState(SECCIONES[0].id);
  const cuerpo = useRef(null);

  /* Cerrar vuelve al principio: reabrir en la sección donde quedó esconde
     las otras tres, y el que vuelve casi siempre viene por otra cosa que
     la vez pasada.
     Va acá y no en un efecto que mire `abierta`: un setState adentro de un
     efecto encadena un render extra en cada cierre, y no hace falta —
     cerrar es un evento, no un estado derivado de otro. */
  const cerrarModal = () => {
    setSeccion(SECCIONES[0].id);
    onClose();
  };

  /* Igual que en la entrega de cartas: el cierre se rearma en cada pintado
     del padre, y como dependencia volvería a registrar el listener en
     vano. */
  const cerrar = useRef(cerrarModal);
  cerrar.current = cerrarModal;

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e) => e.key === "Escape" && cerrar.current();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  /* Cambiar de sección sin volver arriba deja al lector en el medio de un
     texto que no eligió, y encima parece que la pestaña no hizo nada. */
  useEffect(() => {
    if (cuerpo.current) cuerpo.current.scrollTop = 0;
  }, [seccion]);

  const robos = STEAL_VALUES.map((v) => `−${v}`).join(", ");
  const mayor = STEAL_VALUES[STEAL_VALUES.length - 1];
  const menor = STEAL_VALUES[0];

  return (
    <div
      className={`rules-overlay${abierta ? " open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && cerrarModal()}
    >
      <div className="rules-modal">
        <div className="rules-header">
          <div className="rules-title">CÓMO SE JUEGA</div>
          <button className="rules-close" onClick={cerrarModal}>✕</button>
        </div>

        <div className="rules-tabs" role="tablist">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={seccion === s.id}
              className={`rules-tab${seccion === s.id ? " activa" : ""}`}
              onClick={() => setSeccion(s.id)}
            >
              {s.nombre}
            </button>
          ))}
        </div>

        <div className="rules-body" ref={cuerpo}>
          {seccion === "juego" && (
            <>
              <Regla n="01" titulo="EL DUELO">
                De dos a cuatro gatos, un dado y una mesa. Gana el primero
                que llega a <b>{GOAL} puntos</b>. El que pierde paga las
                copas.
              </Regla>

              {/* ►► Lo primero que se ve al abrir el reglamento. ◄◄
                  *
                  * Estaba en la segunda pestaña, "EL DADO", y ahí no lo
                  * encontraba nadie: el que abre esto quiere entender el
                  * juego, no consultar el dado. Y es LA regla — la tensión
                  * sobre la que se apoya todo: seguís tirando o te plantás.
                  * Sin ella, "gana el que llega a 50" no explica nada.
                  *
                  * Va después de EL DUELO y no antes porque necesita el
                  * objetivo para tener sentido: primero se dice a qué se
                  * juega, después por qué es difícil. */}
              <div className="rule-hero">
                <div className="rule-hero-tag">
                  — la regla que define el juego —
                </div>
                <div className="rule-hero-body">
                  <div className="rule-hero-cara">
                    <CaraUno />
                  </div>
                  <div className="rule-hero-texto">
                    <p className="rule-hero-linea">
                      Lo que sumas en el turno <b>no es tuyo todavía</b>.
                    </p>
                    <p>
                      Cada tirada se suma a un <i>acumulado</i> que queda en
                      el aire, y puedes seguir tirando todas las veces que
                      quieras. Hasta que salga un <b>1</b>: ahí{" "}
                      <b>pierdes todo lo acumulado</b> del turno y pasa el
                      siguiente.
                    </p>
                    <p>
                      Plantarte es lo único que lo guarda. Lo que ya está en
                      tu marcador no se toca nunca — ni con un 1, ni con
                      nada.
                    </p>
                  </div>
                </div>
              </div>


              <Regla n="02" titulo="GANAR" tono="win">
                En cuanto tu puntaje más lo acumulado del turno alcanza{" "}
                {GOAL}, la partida termina ahí mismo: no hace falta que te
                plantes. El sobrante de la última tirada no cuenta, el
                marcador queda clavado en {GOAL}.
              </Regla>
            </>
          )}

          {seccion === "dado" && (
            <>
              <Regla
                n="01"
                titulo={<>TIRAR <span className="rule-key">[ESPACIO]</span></>}
              >
                El resultado se suma a lo que llevas acumulado{" "}
                <i>en este turno</i>. Una tirada más siempre parece barata:
                ésa es la trampa.
              </Regla>

              <Regla
                n="02"
                titulo={<>QUEMARSE <span className="rule-badge">× sacar un 1 ×</span></>}
                tono="bust"
              >
                Pierdes todo lo acumulado del turno y pasa el siguiente. Lo
                que ya tenías guardado no se toca, y las cartas que hayas
                puesto vuelven a tu mano <b>sin revelarse</b>.
              </Regla>

              <Regla
                n="03"
                titulo={<>PLANTARSE <span className="rule-key">[ENTER]</span></>}
              >
                Guardas lo del turno en tu puntaje y pasas. Es también el
                momento en que se dan vuelta tus cartas, así que plantarse
                no es sólo asegurar puntos: es cuando atacas.
              </Regla>
            </>
          )}

          {seccion === "mesa" && (
            <Regla
              n="01"
              titulo="EL CAMINO"
              extra={
                <div className="rule-items">
                  <Item
                    muestra={<Casilla tipo={SQUARE.PENALTY} />}
                    nombre={`PENITENCIA −${PENALTY_POINTS}`}
                  >
                    Te descuenta {PENALTY_POINTS} puntos del marcador. Nunca
                    baja de cero.
                  </Item>
                  <Item muestra={<Casilla tipo={SQUARE.BONUS} />} nombre="BONUS">
                    Te da una carta. Aguantas {HAND_LIMIT} jugables y{" "}
                    {DEFENSE_LIMIT} defensas, y cada tope va por su cuenta:
                    tener la mano llena no te impide recibir un escudo.
                  </Item>
                </div>
              }
            >
              Tu ficha avanza por el borde de la mesa tantas casillas como
              saques. El camino da la vuelta: no hay meta, y por eso seguir
              tirando también te mueve más lejos.
            </Regla>
          )}

          {seccion === "cartas" && (
            <>
            <Regla
              n="01"
              titulo="LAS CARTAS"
              extra={
                <div className="rule-items">
                  <Item
                    muestra={<Carta tipo={CARD.STEAL} value={mayor} />}
                    nombre={CARD_LABEL.steal}
                  >
                    Le saca puntos <b>al jugador de tu derecha</b> y te los
                    suma. Vienen de {robos}, y no puede robar más de lo que
                    el otro tiene. La de −{menor} es munición: sirve para{" "}
                    <b>gastarle la defensa</b> barato y dejar sin tapa la de
                    −{mayor} que venga atrás.
                  </Item>
                  <Item
                    muestra={<Carta tipo={CARD.PUNCH} />}
                    nombre={CARD_LABEL.punch}
                  >
                    <b>La defensa no lo tapa.</b> Si el rival tiene escudo,
                    se lo <b>rompe</b>; si no tiene, le saca {PUNCH_POINTS}.
                    Es la carta para abrir la guardia — pega flojo a
                    propósito.
                  </Item>
                  <Item
                    muestra={<Carta tipo={CARD.DEFENSE} />}
                    nombre={CARD_LABEL.defense}
                  >
                    No se juega: se gasta sola cuando te atacan y anula{" "}
                    <i>una</i> carta entera, sea de −{menor} o de −{mayor}.
                    No sirve contra el golpe: ése la rompe en vez de chocar
                    con ella.
                  </Item>
                  <Item
                    muestra={<Carta tipo={CARD.BEER} />}
                    nombre={CARD_LABEL.beer}
                  >
                    <b>Te lo tomas tú.</b> No va a la mesa ni le llega a
                    nadie: se aplica al instante y durante {BEER_TURNS} turnos
                    ves <i>tu</i> mesa borrosa. Y <b>se apilan</b>: dos
                    copas nublan el doble, hasta {BEER_MAX_STACKS}.
                  </Item>
                  <Item
                    muestra={<Carta tipo={CARD.CURSE} />}
                    nombre={CARD_LABEL.curse}
                  >
                    Durante {CURSE_TURNS} turnos el dado del rival no pasa
                    de {CURSED_MAX_ROLL}. Le saca el mejor resultado, pero el
                    1 le sigue pudiendo salir. Y además le da vuelta el
                    camino: mientras dure, sus casillas de bonus dejan de
                    dar carta y le <b>cobran {CURSED_BONUS_POINTS}</b>. Son{" "}
                    <b>siete</b> casillas que se le vuelven en contra, por eso
                    cobran menos que una penitencia de verdad.
                  </Item>
                  <Item
                    muestra={<Carta tipo={CARD.DOUBLE} />}
                    nombre={CARD_LABEL.double}
                  >
                    Se aplica al instante: tiras con dos dados y se suman los
                    dos. Si uno sale 1, ese no cuenta y el otro sí; si salen
                    los dos en 1, te quemas igual.
                  </Item>
                  {/* Las dos de flujo van juntas y al final, que es como se
                      leen: no tocan puntos, cambian de quién es el turno.
                      Comparten el azul del mazo por lo mismo. */}
                  <Item
                    muestra={<Carta tipo={CARD.SKIP} />}
                    nombre={CARD_LABEL.skip}
                  >
                    El siguiente se queda <b>sin turno</b>. <b>La defensa no
                    la tapa</b>: no te saca puntos, te saca el turno.{" "}
                    <b>Se acumulan</b>, y ahí está lo bueno — en una mesa de
                    cuatro, tres saltos dan la vuelta entera y{" "}
                    <b>vuelves a jugar tú</b>. En un duelo alcanza con una.
                  </Item>
                  <Item
                    muestra={<Carta tipo={CARD.REVERSE} />}
                    nombre={CARD_LABEL.reverse}
                  >
                    Da vuelta la mesa: lo que iba hacia tu derecha pasa a ir
                    hacia tu izquierda. <b>Tu víctima pasa a ser tu
                    atacante</b>, y al revés. Dos en el mismo turno se
                    cancelan. No sale en los duelos: con dos jugadores no
                    hay nada que dar vuelta.
                  </Item>
                </div>
              }
            >
              Empiezas con <b>{STARTING_CARDS} cartas al azar</b>, del mismo
              mazo que reparten los bonus, y <b>nunca dos iguales</b>. Todos
              arrancan con <b>la misma mano</b>: cambia en cada partida, pero
              nadie empieza con ventaja — y en el primer turno sabes
              exactamente qué tiene el rival. Sólo puedes jugarlas en tu
              turno, y puedes poner <b>varias en el mismo turno</b>: quedan{" "}
              <b>boca abajo</b> sobre la mesa y se revelan recién cuando te
              plantas. Cada defensa del rival tapa una sola, así que
              acumular sirve. Mientras sigan boca abajo puedes{" "}
              <b>levantarlas de vuelta</b>: hasta que te plantes no pasó
              nada. Los <i>dos dados</i> y el <i>martini</i> son la
              excepción: se aplican sobre ti en el momento y no esperan.
            </Regla>

            {/* ►► A quién le pegan. ◄◄
                No estaba escrita en ninguna parte, y con dos jugadores no
                hacía falta: "el otro" es el único destino posible. En una
                mesa de tres o cuatro pasa a ser la regla que decide cada
                jugada —cuándo guardar un golpe, a quién conviene dejar
                crecer— y sin decirla el jugador pone cartas a ciegas. */}
            <Regla
              n="02"
              titulo={<>A QUIÉN LE PEGAS <span className="rule-badge">× mesa de 3 y 4 ×</span></>}
            >
              Siempre <b>al de tu derecha</b>, y no se elige. En la pantalla
              ése es el que está <b>justo encima de ti</b>: estás sentado abajo
              a la derecha, así que tu derecha sube por el borde. Tú tienes{" "}
              <b>una sola víctima</b> y <b>un solo atacante</b> — el de tu
              izquierda, el que juega justo antes. La <i>mira roja</i> sobre un
              gato, durante tu turno, marca a quién le va a llegar lo que
              pongas — y la sigue marcando bien si alguien juega una{" "}
              <i>{CARD_LABEL.reverse}</i> y se invierte todo.
              <br />
              <br />
              Que no se pueda elegir es lo que mantiene viva la partida. Con
              objetivo libre, pegarle al que va ganando es la jugada correcta
              para todos los demás a la vez: el puntero nunca se despega y
              gana el que estaba segundo cuando alguien por fin rompe. Y tu
              escudo valdría un tercio, porque tapa una carta y te apuntarían
              tres.
            </Regla>
            </>
          )}
        </div>

        <div className="rules-footer">
          <div className="rules-footer-text">— suerte. la vas a necesitar. —</div>
        </div>
      </div>
    </div>
  );
}
