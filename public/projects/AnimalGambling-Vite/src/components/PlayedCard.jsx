import { CARD_LABEL } from "../../convex/rules";
import { CardFace } from "./Hand";

/* Las cartas puestas sobre el fieltro. Boca abajo mientras esperan; se dan
 * vuelta al plantarse.
 *
 * Van una al lado de la otra y no apiladas: apiladas había que confiar en
 * un número chico sobre el reverso para saber cuántas eran, y cuántas hay
 * puestas es justo lo que decide si conviene plantarse o seguir. En fila se
 * cuenta de un vistazo.
 *
 * Las dos caras de cada carta existen desde el principio y se rota el
 * conjunto: reemplazar el contenido se vería como un parpadeo, no como dar
 * vuelta una carta.
 */
export default function PlayedCard({
  pendientes = [],
  revelada,
  puedeRetirar = false,
  onRetirar,
}) {
  /* Al plantarse las cartas se revelan de a una, así que en ese momento la
     fila deja paso a la que se está mostrando. */
  const cartas = revelada ? [revelada.carta] : pendientes;
  if (!cartas.length) return null;

  /* Se pueden levantar de vuelta mientras sigan boca abajo. Cada carta es un
     botón de verdad y no un div con onClick: se llega con el tabulador y se
     activa con Enter, igual que las del abanico. */
  const retirable = puedeRetirar && !revelada && typeof onRetirar === "function";

  return (
    <div className="played-cards" data-n={Math.min(cartas.length, 5)}>
      {cartas.map((carta, i) => (
        <div
          key={carta.uid ?? `${carta.type}-${i}`}
          className={`played-card${revelada ? " revealed" : ""}${
            revelada?.bloqueada ? " blocked" : ""
          }${retirable ? " retirable" : ""}`}
          role={retirable ? "button" : undefined}
          tabIndex={retirable ? 0 : undefined}
          aria-label={retirable ? "Retirar la carta de la mesa" : undefined}
          onClick={retirable ? () => onRetirar(carta.uid) : undefined}
          onKeyDown={
            retirable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRetirar(carta.uid);
                  }
                }
              : undefined
          }
          /* El orden de entrada: cada una cae un poco después que la
             anterior, así se ve que son varias y no un bloque. */
          style={{ "--i": i }}
          title={
            revelada
              ? `${CARD_LABEL[carta.type]}${revelada.bloqueada ? " — bloqueada" : ""}`
              : retirable
                ? "Carta jugada — clic para retirarla"
                : "Carta jugada — se revela al plantarte"
          }
        >
          <div className="pc-inner">
            <div className="pc-back">?</div>
            <div className={`pc-front ${carta.type}`}>
              <CardFace carta={carta} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
