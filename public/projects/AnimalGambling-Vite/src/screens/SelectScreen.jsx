import { ROSTER } from "../roster";

/* Elegir gato.
 *
 * En local eligen los dos, uno después del otro. En online elegís sólo el
 * tuyo, y podés cambiarlo mientras no hayas confirmado: por eso al tocar
 * otro se suelta el anterior en vez de ignorar el toque.
 */
export default function SelectScreen({
  online,
  elegidos,      // [idxP1, idxP2] — null donde falta
  esperando,     // true mientras se espera que el rival elija
  onPick,
  onPlay,
  onBack,
}) {
  /* La mesa se lee del propio array de elegidos: su largo ES la cantidad de
     sillas. La pantalla no sabe si el modo es de dos o de cuatro, y no le
     hace falta. */
  const faltan = elegidos.filter((x) => x === null).length;
  const listo = online ? elegidos[0] !== null : faltan === 0;
  const turno = elegidos.indexOf(null) + 1;

  return (
    <section className="screen select-screen active">
      <div className="select-header">
        <div className="prompt-title">
          {online || elegidos.length < 3
            ? "ELIGE TU GATO APOSTADOR"
            : faltan > 0
              ? `JUGADOR ${turno} — ELIGE TU GATO`
              : "MESA COMPLETA"}
        </div>
      </div>

      <div className={`char-grid${!online && faltan < elegidos.length ? " p2-turn" : ""}`}>
        {ROSTER.map((c, i) => {
          /* En qué asiento quedó este gato, o −1 si nadie lo tomó. Reemplaza
             a las dos comparaciones contra p1 y p2. */
          const puesto = elegidos.indexOf(i);
          const marcado = puesto !== -1;
          return (
            <div
              key={c.id}
              className={`char-card${marcado ? " selected" : ""}${marcado ? ` p${puesto + 1}` : ""}`}
              data-player={marcado ? `P${puesto + 1}` : undefined}
              onClick={() => onPick(i)}
            >
              <div className="char-art boil" data-cat={c.id} role="img" aria-label={c.name} />
              <div className="char-name">{c.name}</div>
              <div className="char-desc">{c.cond}</div>
            </div>
          );
        })}
      </div>

      <div className="select-footer">
        <button className="btn-nav" onClick={onBack}>‹ Volver al menú</button>
        <button className="btn-nav" disabled={!listo || esperando} onClick={onPlay}>
          {esperando ? "Esperando al rival…" : "Jugar"}
        </button>
      </div>
    </section>
  );
}
