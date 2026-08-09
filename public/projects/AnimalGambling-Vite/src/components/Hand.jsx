import { CARD, CARD_LABEL } from "../../convex/rules";
import { CARD_ICON } from "./icons";

/* La cara de una carta: el robo muestra su valor en negativo —es lo que le
   pasa al rival, y el signo lo dice sin leer el rótulo— y el resto su
   ícono. */
export function CardFace({ carta }) {
  if (carta.type === CARD.STEAL) {
    return (
      <>
        <span className="card-kind">{CARD_LABEL.steal}</span>
        <span className="card-value">−{carta.value}</span>
      </>
    );
  }
  const Icono = CARD_ICON[carta.type];
  return (
    <>
      <span className="card-icon">{Icono ? <Icono /> : null}</span>
      <span className="card-kind">{CARD_LABEL[carta.type]}</span>
    </>
  );
}

export default function Hand({ cartas = [], habilitada, onPlay }) {
  return (
    <div className="hand-row" aria-label="Tus cartas">
      {cartas.map((c) => {
        /* La defensa se muestra pero no se puede soltar: se gasta sola
           cuando te atacan, y jugarla sería tirarla. */
        const jugable = c.type !== CARD.DEFENSE && habilitada;
        return (
          <button
            key={c.uid}
            className={`card ${c.type}`}
            disabled={!jugable}
            title={`${CARD_LABEL[c.type]}${c.value ? ` −${c.value}` : ""}`}
            onClick={() => onPlay(c.uid)}
          >
            <CardFace carta={c} />
          </button>
        );
      })}
    </div>
  );
}
