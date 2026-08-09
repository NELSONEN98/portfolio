/* Final de partida.
 *
 * La revancha sólo aparece en local: en online reusaría los picks de este
 * lado y el backend rechaza toda jugada contra una sala terminada. Una
 * revancha online de verdad necesita que los dos acepten y que la sala se
 * reinicie, que es otra funcionalidad.
 */
export default function GameOverScreen({ ganador, perdedor, porAbandono, online, onRematch, onExit }) {
  if (!ganador || !perdedor) return null;

  return (
    <section className="screen gameover-screen active">
      <div className="gameover-banner">
        <div className="big">SE ACABÓ</div>
      </div>

      <div className="gameover-stage">
        <div className="go-winner">
          <div className="go-portrait">
            <div className="go-art boil" data-cat={ganador.char.id} role="img" aria-label={ganador.char.name} />
          </div>
          <div className="go-name">{ganador.char.name}</div>
          <div className="go-score">{ganador.score}</div>
          <div className="go-quote">"{ganador.char.quote}"</div>
        </div>

        <div className="go-loser">
          <div className="go-label">† PERDEDOR †</div>
          <div className="go-portrait">
            <div className="go-art boil" data-cat={perdedor.char.id} role="img" aria-label={perdedor.char.name} />
          </div>
          <div className="go-name">{perdedor.char.name}</div>
          <div className="go-score">{perdedor.score}</div>
          <div className="go-quote">
            {porAbandono ? '"me borré."' : `"${perdedor.char.loseQuote}"`}
          </div>
        </div>
      </div>

      <div className="gameover-actions">
        {!online && (
          <button className="btn-nav" onClick={onRematch}>⟲ Revancha</button>
        )}
        <button className="btn-nav secondary" onClick={onExit}>
          {online ? "× Volver al menú" : "× Otros jugadores"}
        </button>
      </div>
    </section>
  );
}
