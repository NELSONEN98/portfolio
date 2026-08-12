import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import RivalHand from "./RivalHand";
import { HeartShieldIcon } from "./icons";

/* Un peleador: el dibujo, el nombre y sus dos números.
 *
 * El color no dice qué posición ocupa sino en qué estado está, y por eso
 * sale todo de una sola variable CSS (--side): dorado el que tira, blanco
 * el que espera, morado el maldito. Con el color atado a la posición, en
 * online te cambiaba según hubieras creado la sala o entrado.
 */
export default function Fighter({
  jugador,
  lado,
  activo,
  ganador,
  perdedor,
  mostrarMano,
  impacto,
  defensas,
}) {
  const score = useAnimatedNumber(jugador?.score ?? 0);
  const current = useAnimatedNumber(jugador?.current ?? 0);

  if (!jugador) return null;

  const maldito = (jugador.curseTurns ?? 0) > 0;

  const clases = [
    "fighter",
    `f${lado + 1}`,
    activo ? "active" : "",
    maldito ? "cursed" : "",
    ganador ? "winner" : "",
    perdedor ? "loser" : "",
    /* Lo que le acaba de llegar: tiñe el marco y el puntaje del color de
       la carta que lo golpeó, mientras dura el destello. */
    impacto ? `impacto-${impacto}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={clases}>
      <div className="fighter-frame">
        <div className="fighter-art boil" data-cat={jugador.char.id} />
        <div className="f-name">{jugador.char.name}</div>
      </div>

      <div className="fighter-readout">
        <div className="score-row">
          {/* Cuánto se perdió. El número grande contando hacia abajo dice
              que algo pasó, pero no cuánto: para saberlo habría que
              acordarse del valor anterior. */}
          <span className={`f-hit${score.bajando ? " show" : ""}`} aria-hidden="true">
            {score.perdido ? `−${score.perdido}` : ""}
          </span>
          <div className={`f-score${score.bajando ? " down bump" : " bump"}`}>
            {score.shown}
          </div>

          {/* Las cartas del rival, a la derecha de su puntaje y en el mismo
              renglón — el mismo lugar que ocupan las tuyas respecto del
              tuyo. Antes colgaban absolutas de una esquina del peleador:
              quedaban a distinta altura en cada lado y sin relación visible
              con el marcador, que es justamente el dato que completan.
              Va DENTRO del renglón del puntaje y fuera de .fighter-frame:
              ese recorta lo que se sale (overflow hidden) y ahí la mano
              quedaba cortada por completo. */}
          {mostrarMano && (
            <RivalHand cantidad={jugador.hand?.length ?? 0} lado={lado} />
          )}
        </div>
        <div className="f-current">
          +<span className={current.bajando ? "down" : ""}>{current.shown}</span>
        </div>

        {/* Las defensas que tenés guardadas. Van acá y no en el abanico
            porque no se juegan: se gastan solas cuando te atacan, así que
            son un estado —como el puntaje— y no una opción. Chiquitas y en
            fila: lo único que hay que saber es cuántas quedan. */}
        {defensas?.length ? (
          <div className="f-defensas" aria-label={`Defensas: ${defensas.length}`}>
            {defensas.map((c) => (
              <span className="f-defensa" key={c.uid} title="Defensa — se gasta sola al recibir un ataque">
                <HeartShieldIcon />
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
