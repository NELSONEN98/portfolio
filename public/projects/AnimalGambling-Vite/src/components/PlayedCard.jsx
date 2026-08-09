import { CARD_LABEL } from "../../convex/rules";
import { CardFace } from "./Hand";

/* La carta puesta sobre el fieltro. Boca abajo mientras espera; se da
   vuelta al plantarse.
 *
 * Las dos caras existen desde el principio y se rota el conjunto:
 * reemplazar el contenido se vería como un parpadeo, no como dar vuelta
 * una carta.
 */
export default function PlayedCard({ pendientes = [], revelada }) {
  const arriba = revelada?.carta ?? pendientes[pendientes.length - 1] ?? null;
  if (!arriba) return null;

  /* Cuántas quedan debajo: se dibujan como bordes asomando, no como cartas
     enteras. Lo único que importa es que son varias. */
  const debajo = revelada ? 0 : Math.max(0, pendientes.length - 1);

  return (
    <div
      className={`played-card${revelada ? " revealed" : ""}${
        revelada?.bloqueada ? " blocked" : ""
      }`}
      title={
        revelada
          ? `${CARD_LABEL[arriba.type]}${revelada.bloqueada ? " — bloqueada" : ""}`
          : "Carta jugada — se revela al plantarse"
      }
    >
      {Array.from({ length: Math.min(debajo, 3) }, (_, i) => (
        <span className="pc-stacked" key={i} style={{ "--i": i + 1 }} />
      ))}

      <div className="pc-inner">
        <div className="pc-back">
          ?{debajo ? <b>{debajo + 1}</b> : null}
        </div>
        <div className={`pc-front ${arriba.type}`}>
          <CardFace carta={arriba} />
        </div>
      </div>
    </div>
  );
}
