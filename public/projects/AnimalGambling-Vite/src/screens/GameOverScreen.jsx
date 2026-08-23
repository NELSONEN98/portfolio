/* Final de partida.
 *
 * La revancha sólo aparece en local: en online reusaría los picks de este
 * lado y el backend rechaza toda jugada contra una sala terminada. Una
 * revancha online de verdad necesita que los dos acepten y que la sala se
 * reinicie, que es otra funcionalidad.
 *
 * ►► Antes esto recibía `ganador` y `perdedor`. ◄◄
 *
 * Dos props con nombre eran una mesa de dos escrita en la firma: con cuatro
 * jugadores hay un ganador y TRES que perdieron, y el que se llamaba "el
 * perdedor" salía de `players[ganador === 0 ? 1 : 0]` — o sea, el otro de
 * los dos primeros asientos, elegido por descarte y no por puntaje.
 *
 * Ahora entra la mesa entera y el orden lo hace esta pantalla. Con dos se ve
 * exactamente igual que antes —el ganador grande y el perdedor al lado con
 * su frase— y con tres o cuatro los que siguen se apilan en una tabla, que
 * es la única forma de contar un tercer puesto.
 */
export default function GameOverScreen({
  jugadores = [],
  ganadorIdx = 0,
  porAbandono,
  online,
  onRematch,
  onExit,
}) {
  const ganador = jugadores[ganadorIdx];
  if (!ganador?.char) return null;

  /* Los demás, de mayor a menor. El índice viaja con cada uno porque el
     orden de la tabla ya no es el de los asientos y sin él no habría forma
     de volver a identificarlos. */
  const resto = jugadores
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p?.char && i !== ganadorIdx)
    .sort((a, b) => (b.p.score ?? 0) - (a.p.score ?? 0));

  /* Con dos, el segundo se dibuja grande y con su frase: es el duelo de
     siempre y no hay motivo para degradarlo a un renglón de tabla. Con más,
     ninguno se lleva ese lugar — señalar a uno solo entre tres sería
     inventar un subcampeón que el juego no premia. */
  const duelo = resto.length === 1;

  return (
    <section className="screen gameover-screen active">
      <div className="gameover-banner">
        <div className="big">SE ACABÓ</div>
      </div>

      <div className={`gameover-stage${duelo ? "" : " mesa-grande"}`}>
        <div className="go-winner">
          <div className="go-portrait">
            <div className="go-art boil" data-cat={ganador.char.id} role="img" aria-label={ganador.char.name} />
          </div>
          <div className="go-name">{ganador.char.name}</div>
          <div className="go-score">{ganador.score}</div>
          <div className="go-quote">"{ganador.char.quote}"</div>
        </div>

        {duelo ? (
          <div className="go-loser">
            <div className="go-label">† PERDEDOR †</div>
            <div className="go-portrait">
              <div
                className="go-art boil"
                data-cat={resto[0].p.char.id}
                role="img"
                aria-label={resto[0].p.char.name}
              />
            </div>
            <div className="go-name">{resto[0].p.char.name}</div>
            <div className="go-score">{resto[0].p.score}</div>
            <div className="go-quote">
              {porAbandono ? '"me retiré."' : `"${resto[0].p.char.loseQuote}"`}
            </div>
          </div>
        ) : (
          /* La tabla de los que no ganaron. El puesto va escrito y no
             deducido del orden visual: con la lista ordenada por puntaje,
             dos empatados quedan uno arriba del otro sin que nada diga que
             están igual. */
          <ol className="go-tabla" aria-label="Resto de la mesa">
            {resto.map(({ p, i }, n) => (
              <li className="go-fila" key={i}>
                <span className="go-puesto">{n + 2}º</span>
                <span className="go-mini boil" data-cat={p.char.id} role="img" aria-label={p.char.name} />
                <span className="go-fila-nombre">{p.char.name}</span>
                <span className="go-fila-score">{p.score}</span>
              </li>
            ))}
          </ol>
        )}
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
