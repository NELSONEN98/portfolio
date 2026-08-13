import { useEffect, useRef } from "react";
import {
  GOAL,
  CARD,
  CARD_LABEL,
  HAND_LIMIT,
  DEFENSE_LIMIT,
  CURSE_TURNS,
  CURSED_MAX_ROLL,
  PENALTY_POINTS,
  STEAL_VALUES,
  SQUARE,
  startingHand,
} from "../../convex/rules";
import { SQUARE_ICON } from "./icons";
import { CardFace } from "./Hand";

/* Las reglas salen de las constantes reales, no de un texto escrito a
   mano: si mañana cambia el objetivo o lo que roba una carta, la
   explicación cambia sola en vez de quedar mintiendo.

   Y las muestras son los mismos componentes que dibujan el tablero y la
   mano, así que lo que se lee acá es exactamente lo que se ve jugando. */

function Regla({ n, titulo, children, extra }) {
  return (
    <div className="rules-rule">
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

export default function RulesModal({ abierta, onClose }) {
  /* Igual que en la entrega de cartas: onClose llega como función nueva en
     cada pintado del padre. Acá sólo costaba re-registrar el listener en
     vano, pero es el mismo patrón y conviene que no se repita. */
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e) => e.key === "Escape" && cerrar.current();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  const robos = STEAL_VALUES.map((v) => `−${v}`).join(", ");
  const mayor = STEAL_VALUES[STEAL_VALUES.length - 1];
  const menor = STEAL_VALUES[0];

  /* La mano de arranque se lee de la regla en vez de describirse a mano. */
  const conteo = startingHand().reduce((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});
  const manoInicial = Object.entries(conteo)
    .map(([tipo, n]) => `${n} de ${CARD_LABEL[tipo].toLowerCase()}`)
    .join(", ");

  return (
    <div
      className={`rules-overlay${abierta ? " open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="rules-modal">
        <div className="rules-header">
          <div className="rules-tag">— las únicas reglas que importan —</div>
          <div className="rules-title">CÓMO SE JUEGA</div>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>

        <div className="rules-body">
          <Regla n="01" titulo="EL JUEGO">
            Dos gatos, un dado y una mesa. Gana el primero que llega a{" "}
            <b>{GOAL} puntos</b>. El que pierde paga las copas.
          </Regla>

          <Regla n="02" titulo={<>TIRAR <span className="rule-key">[ESPACIO]</span></>}>
            El resultado se suma a lo que llevas acumulado <i>en este turno</i>.
            Puedes seguir tirando todas las veces que quieras.
          </Regla>

          <Regla n="03" titulo={<>QUEMARSE <span className="rule-badge">× sacar un 1 ×</span></>}>
            Pierdes todo lo acumulado del turno y pasa el otro. Lo que ya tenías
            guardado no se toca, y las cartas que hayas puesto vuelven a tu mano
            sin revelarse.
          </Regla>

          <Regla n="04" titulo={<>PLANTARSE <span className="rule-key">[ENTER]</span></>}>
            Guardas lo del turno en tu puntaje y pasas. Es también el momento en
            que se dan vuelta tus cartas. Si tu acumulado ya llega a {GOAL}, la
            partida se cierra sola: no hace falta que lo pulses.
          </Regla>

          <Regla
            n="05"
            titulo="EL CAMINO"
            extra={
              <div className="rule-items">
                <Item muestra={<Casilla tipo={SQUARE.PENALTY} />} nombre={`PENITENCIA −${PENALTY_POINTS}`}>
                  Te descuenta {PENALTY_POINTS} puntos del marcador. Nunca baja de cero.
                </Item>
                <Item muestra={<Casilla tipo={SQUARE.BONUS} />} nombre="BONUS">
                  Te da una carta. Aguantas {HAND_LIMIT} jugables y{" "}
                  {DEFENSE_LIMIT} defensas, y cada tope va por su cuenta: tener
                  la mano llena no te impide recibir un escudo.
                </Item>
              </div>
            }
          >
            Tu ficha —dorada o blanca— avanza por el borde de la mesa tantas
            casillas como saques. El camino da la vuelta: no hay meta.
          </Regla>

          <Regla
            n="06"
            titulo="LAS CARTAS"
            extra={
              <div className="rule-items">
                <Item muestra={<Carta tipo={CARD.STEAL} value={mayor} />} nombre={CARD_LABEL.steal}>
                  Le saca puntos <b>al jugador de tu derecha</b> y te los suma.
                  Vienen de {robos}, y no puede robar más de lo que el otro
                  tiene. La de −{menor} es munición: sirve para{" "}
                  <b>gastarle la defensa</b> barato y dejar sin tapa la de −
                  {mayor} que venga atrás.
                </Item>
                <Item muestra={<Carta tipo={CARD.DEFENSE} />} nombre={CARD_LABEL.defense}>
                  No se juega: se gasta sola cuando te atacan y anula <i>una</i>{" "}
                  carta entera, sea de −{menor} o de −{mayor}. Tenerla en la mano
                  ya te protege.
                </Item>
                <Item muestra={<Carta tipo={CARD.CURSE} />} nombre={CARD_LABEL.curse}>
                  Durante {CURSE_TURNS} turnos el dado del rival no pasa de{" "}
                  {CURSED_MAX_ROLL}. Le saca el mejor resultado, pero el 1 le
                  sigue pudiendo salir.
                </Item>
                <Item muestra={<Carta tipo={CARD.DOUBLE} />} nombre={CARD_LABEL.double}>
                  Se aplica al instante: tiras con dos dados y se suman los dos.
                  Si uno sale 1, ese no cuenta y el otro sí; si salen los dos en
                  1, te quemas igual.
                </Item>
              </div>
            }
          >
            Empiezas con {manoInicial}. Sólo puedes jugarlas en tu turno, y
            puedes poner <b>varias en el mismo turno</b>: quedan <b>boca abajo</b>{" "}
            sobre la mesa y se revelan recién cuando te plantas. Cada defensa del
            rival tapa una sola, así que acumular sirve.
          </Regla>

          <Regla n="07" titulo="GANAR">
            Gana el primero que llega a {GOAL}. En cuanto tu puntaje más lo
            acumulado del turno alcanza esa cifra, la partida termina ahí mismo.
            El sobrante de la última tirada no cuenta: el marcador queda clavado
            en {GOAL}.
          </Regla>
        </div>

        <div className="rules-footer">
          <div className="rules-chips-deco">
            <div className="chip gold" />
            <div className="chip red" />
            <div className="chip blue" />
            <div className="chip red" />
            <div className="chip gold" />
          </div>
          <div className="rules-footer-text">— suerte. la vas a necesitar. —</div>
        </div>
      </div>
    </div>
  );
}
