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
  const [p1, p2] = elegidos;
  const listo = online ? p1 !== null : p1 !== null && p2 !== null;

  return (
    <section className="screen select-screen active">
      <div className="select-header">
        <div className="prompt-title">ELIGE TU GATO APOSTADOR</div>
      </div>

      <div className={`char-grid${!online && p1 !== null ? " p2-turn" : ""}`}>
        {ROSTER.map((c, i) => {
          const comoP1 = p1 === i;
          const comoP2 = p2 === i;
          const marcado = comoP1 || comoP2;
          return (
            <div
              key={c.id}
              className={`char-card${marcado ? " selected" : ""}${comoP1 ? " p1" : ""}${comoP2 ? " p2" : ""}`}
              data-player={comoP1 ? "P1" : comoP2 ? "P2" : undefined}
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
