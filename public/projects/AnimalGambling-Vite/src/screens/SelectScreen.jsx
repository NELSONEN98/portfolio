import { ROSTER } from "../roster";

/* Elegir gato.
 *
 * En local eligen todos, uno después del otro, sobre la misma pantalla. En
 * online elegís sólo el tuyo, y podés cambiarlo mientras no hayas
 * confirmado: por eso al tocar otro se suelta el anterior en vez de ignorar
 * el toque.
 *
 * ►► Los gatos de los demás también se ven tomados. ◄◄
 *
 * En online `elegidos` traía sólo tu pick y un hueco. Con dos eso era feo
 * pero legible: si el otro repetía gato quedaban dos Bonifacios en la mesa.
 * Con cuatro es imposible de seguir —dos peleadores idénticos con
 * marcadores distintos— así que los asientos ajenos llegan llenos desde el
 * sondeo y sus gatos se dibujan tomados. El servidor igual lo rechaza: dos
 * dedos pueden caer sobre la misma carta en el mismo instante y el que
 * pierde la carrera tiene que enterarse.
 */
export default function SelectScreen({
  online,
  elegidos,      // un casillero por asiento — null donde falta
  miLado = 0,    // cuál de esos casilleros es el tuyo
  esperando,     // true mientras se espera que los demás elijan
  onPick,
  onPlay,
  onBack,
}) {
  /* La mesa se lee del propio array de elegidos: su largo ES la cantidad de
     sillas. La pantalla no sabe si el modo es de dos o de cuatro, y no le
     hace falta. */
  const faltan = elegidos.filter((x) => x === null).length;
  /* En online alcanza con el tuyo; los demás tienen su propia pantalla.
     `!= null` y no `!== null`: el array puede llegar más corto que tu
     asiento en el instante entre entrar a la sala y el primer sondeo, y
     `undefined !== null` es cierto — el botón de jugar se habilitaba sin
     que hubieras elegido nada. */
  const listo = online ? elegidos[miLado] != null : faltan === 0;
  const turno = elegidos.indexOf(null) + 1;

  return (
    <section className="screen select-screen active">
      <div className="select-header">
        <div className="prompt-title">
          {online || elegidos.length < 3
            ? "ELIGE TU GATO"
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
          /* Tomado por OTRO. En local no existe —los turnos son
             consecutivos y tocar un gato ya elegido lo suelta, que es como
             se corrige un toque errado— pero en online el asiento ajeno no
             es tuyo para soltarlo. */
          const ajeno = online && marcado && puesto !== miLado;
          return (
            <div
              key={c.id}
              className={`char-card${marcado ? " selected" : ""}${marcado ? ` p${puesto + 1}` : ""}${ajeno ? " ajeno" : ""}`}
              aria-disabled={ajeno || undefined}
              onClick={() => !ajeno && onPick(i)}
            >
              {/* ►► La insignia va FUERA de lo que se pone gris. ◄◄
               *
               * El gris del gato ajeno es un `filter: grayscale`, y un
               * filtro alcanza a TODO lo que está dentro del elemento,
               * pseudo-elementos incluidos. Colgada del dibujo, la insignia
               * salía gris también — justo el dato que hay que poder leer
               * sobre una carta apagada: el gris dice "no la podés tomar" y
               * el número dice "porque es de ése".
               *
               * Por eso esta caja. El dibujo se filtra adentro; la insignia
               * es hermana suya y queda a todo color. Y la caja se lleva
               * además el `transform` que levanta la carta al elegirla, para
               * que las dos suban juntas: anclada al dibujo, la insignia se
               * quedaba abajo. */}
              <div className="char-art-caja">
                <div
                  className="char-art boil"
                  data-cat={c.id}
                  role="img"
                  aria-label={
                    marcado ? `${c.name} — jugador ${puesto + 1}` : c.name
                  }
                />
                {/* `aria-hidden` porque el dibujo de al lado ya dice el
                    nombre Y el jugador en una sola frase; leerlo dos veces
                    sería contarlo dos veces. */}
                {marcado && (
                  <span className="char-jugador" aria-hidden="true">
                    P{puesto + 1}
                  </span>
                )}
              </div>
              <div className="char-name">{c.name}</div>
              <div className="char-desc">{c.cond}</div>
            </div>
          );
        })}
      </div>

      <div className="select-footer">
        <button className="btn-nav" onClick={onBack}>‹ Volver al menú</button>
        <button className="btn-nav" disabled={!listo || esperando} onClick={onPlay}>
          {esperando ? "Esperando a la mesa…" : "Jugar"}
        </button>
      </div>
    </section>
  );
}
