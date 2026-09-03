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
 * Ahora entra la mesa entera y el orden lo hace esta pantalla: el ganador
 * arriba y grande, el resto abajo y chico, sin importar si son uno, dos o
 * tres.
 *
 * Cada retrato lleva la clase `pN` del asiento —la misma que usan las
 * fichas del tablero (`.token.p1..p4`)— para pintar el fondo detrás de la
 * tarjeta blanca con el color de ESE jugador. La tarjeta en sí sigue blanca
 * a propósito: es el papel del dibujo, y teñirla habría tapado el trazo.
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

  return (
    <section className="screen gameover-screen active">
      <div className="gameover-banner">
        <div className="big">SE ACABÓ</div>
      </div>

      {/* Un solo diseño para dos, tres o cuatro: el ganador arriba y grande,
          el resto abajo y chico. Antes el duelo (un solo perdedor) tenía su
          propio retrato gigante al lado del ganador y con tres o cuatro se
          caía a una tabla de texto sin dibujo — dos formas de contar lo
          mismo. El puesto sigue escrito y no deducido del orden visual: con
          la lista ordenada por puntaje, dos empatados quedan uno arriba del
          otro sin que nada diga que están igual. */}
      <div className="gameover-stage">
        <div className={`go-winner p${ganadorIdx + 1}`}>
          <div className="go-label">★ GANADOR ★</div>
          <div className="go-portrait">
            <div className="go-art boil" data-cat={ganador.char.id} role="img" aria-label={ganador.char.name} />
          </div>
          <div className="go-name">{ganador.char.name}</div>
          <div className="go-score">{ganador.score}</div>
          <div className="go-quote">"{ganador.char.quote}"</div>
        </div>

        <ol className="go-perdedores" aria-label="Resto de la mesa">
          {resto.map(({ p, i }, n) => (
            <li className={`go-perdedor p${i + 1}`} key={i}>
              <span className="go-puesto">{n + 2}º</span>
              <div className="go-portrait go-portrait-mini">
                <div className="go-art boil" data-cat={p.char.id} role="img" aria-label={p.char.name} />
              </div>
              <div className="go-name">{p.char.name}</div>
              <div className="go-score">{p.score}</div>
              <div className="go-quote">
                {porAbandono && resto.length === 1 ? '"me retiré."' : `"${p.char.loseQuote}"`}
              </div>
            </li>
          ))}
        </ol>
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
