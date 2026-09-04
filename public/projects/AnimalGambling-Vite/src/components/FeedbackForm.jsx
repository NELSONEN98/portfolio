import { useState } from "react";
import { enviarFeedback } from "../convex";

/* ►► La opinión del final, y está armada para que la conteste GENTE. ◄◄
 *
 * Esto es un demo: el objetivo no es un formulario completo, es enterarse
 * de algo. Y un formulario de siete campos en la pantalla donde alguien
 * acaba de perder no se contesta — se cierra.
 *
 * Por eso arranca con UNA cosa: las estrellas. Un clic y ya mandó lo único
 * que se necesita de verdad. Recién ahí se abre el resto, todo opcional:
 * quien tenga algo para contar tiene dónde, y quien no, ya contestó sin
 * darse cuenta de que había un formulario.
 *
 * El resto del contexto —si ganó, cuánto duró, de cuántos era la mesa, qué
 * versión— lo manda el cliente solo. Preguntárselo al jugador sería sumarle
 * trabajo para completar datos que la aplicación ya tiene.
 */

const ESTRELLAS = [1, 2, 3, 4, 5];

/* Qué dice cada nota. No es decoración: una estrella sola es ambigua —hay
   quien puntúa 3 pensando "está bien"— y el rótulo fija la escala para
   todos, que es lo que hace comparables las respuestas. */
const QUE_SIGNIFICA = {
  1: "No me gustó",
  2: "Le falta",
  3: "Está bien",
  4: "Me gustó",
  5: "Muy bueno",
};

export default function FeedbackForm({ gano, mesa, inicioPartida, version }) {
  /* ►► La duración se congela acá, al montarse, y no se vuelve a mirar. ◄◄
   *
   * Llega el INSTANTE en que arrancó la partida, no los segundos ya
   * contados: restándole `Date.now()` en cada pintado, el rato que alguien
   * pase escribiendo esto se sumaría a lo que duró jugar, y a la base
   * llegarían partidas de veinte minutos que duraron tres.
   *
   * El inicializador perezoso de `useState` corre UNA vez, en el primer
   * pintado. Es la forma más corta de decir "esto se mide al llegar". */
  const [duracionSeg] = useState(() =>
    inicioPartida ? Math.round((Date.now() - inicioPartida) / 1000) : undefined
  );
  const [rating, setRating] = useState(0);
  /* La estrella sobre la que está el puntero, para que la fila se encienda
     antes de elegir. Se pinta con `max(rating, encima)`: sin eso, pasar por
     encima de una nota más baja apagaría las que ya están elegidas. */
  const [encima, setEncima] = useState(0);
  const [volveria, setVolveria] = useState(null);
  const [campos, setCampos] = useState({
    name: "",
    gusto: "",
    mejoraria: "",
    bug: "",
    comentario: "",
    email: "",
  });
  const [estado, setEstado] = useState("editando"); // editando | enviando | listo | error

  const cambiar = (k) => (e) => setCampos((c) => ({ ...c, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!rating || estado === "enviando") return;
    setEstado("enviando");
    try {
      await enviarFeedback({
        rating,
        ...campos,
        volveria,
        gano,
        mesa,
        duracionSeg,
        version,
      });
      setEstado("listo");
    } catch {
      /* Se dice, no se traga: alguien que escribió tres párrafos y ve un
         "gracias" que no fue tiene que poder reintentar. El texto sigue en
         los campos, así que reintentar es apretar de nuevo. */
      setEstado("error");
    }
  };

  if (estado === "listo") {
    return (
      <div className="fb fb-listo" role="status">
        <div className="fb-gracias">¡Gracias!</div>
        <p className="fb-nota">Lo tuyo ya nos llegó.</p>
      </div>
    );
  }

  const pintadas = Math.max(rating, encima);

  return (
    <form className="fb" onSubmit={enviar}>
      <div className="fb-titulo">¿Qué te pareció?</div>

      {/* Botones y no un `input[type=radio]` disfrazado: cinco botones ya
          son accesibles con teclado y con lector, y no arrastran el estilo
          nativo del radio, que en este diseño hay que tapar entero. */}
      <div
        className="fb-estrellas"
        role="group"
        aria-label="Calificación de 1 a 5 estrellas"
        onMouseLeave={() => setEncima(0)}
      >
        {ESTRELLAS.map((n) => (
          <button
            key={n}
            type="button"
            className={`fb-estrella${n <= pintadas ? " encendida" : ""}`}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${QUE_SIGNIFICA[n]}`}
            aria-pressed={rating === n}
            onMouseEnter={() => setEncima(n)}
            onFocus={() => setEncima(n)}
            onBlur={() => setEncima(0)}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>

      {/* El rótulo ocupa su renglón siempre, aunque esté vacío: apareciendo
          y desapareciendo empujaría todo el formulario hacia abajo justo
          cuando el dedo va hacia el botón. */}
      <div className="fb-significa">{QUE_SIGNIFICA[pintadas] ?? " "}</div>

      {/* Todo lo de abajo aparece recién con la nota puesta. Antes de eso
          sería pedirle seis respuestas a alguien que todavía no dio una. */}
      {rating > 0 && (
        <div className="fb-resto">
          <div className="fb-fila">
            <span className="fb-etiqueta">¿Volverías a jugar?</span>
            <div className="fb-si-no">
              <button
                type="button"
                className={`fb-chip${volveria === true ? " activo" : ""}`}
                aria-pressed={volveria === true}
                onClick={() => setVolveria(volveria === true ? null : true)}
              >
                Sí
              </button>
              <button
                type="button"
                className={`fb-chip${volveria === false ? " activo" : ""}`}
                aria-pressed={volveria === false}
                onClick={() => setVolveria(volveria === false ? null : false)}
              >
                No
              </button>
            </div>
          </div>

          <label className="fb-campo">
            <span className="fb-etiqueta">¿Qué te gustó?</span>
            <textarea rows={2} value={campos.gusto} onChange={cambiar("gusto")} />
          </label>

          <label className="fb-campo">
            <span className="fb-etiqueta">¿Qué le agregarías o cambiarías?</span>
            <textarea rows={2} value={campos.mejoraria} onChange={cambiar("mejoraria")} />
          </label>

          <label className="fb-campo">
            <span className="fb-etiqueta">
              ¿Se rompió algo?
              <span className="fb-ayuda">contá qué hacías cuando pasó</span>
            </span>
            <textarea rows={2} value={campos.bug} onChange={cambiar("bug")} />
          </label>

          <label className="fb-campo">
            <span className="fb-etiqueta">Algo más</span>
            <textarea rows={2} value={campos.comentario} onChange={cambiar("comentario")} />
          </label>

          <div className="fb-dos">
            <label className="fb-campo">
              <span className="fb-etiqueta">Tu nombre <em>opcional</em></span>
              <input type="text" value={campos.name} onChange={cambiar("name")} maxLength={60} />
            </label>
            <label className="fb-campo">
              <span className="fb-etiqueta">Email <em>si querés respuesta</em></span>
              <input
                type="email"
                value={campos.email}
                onChange={cambiar("email")}
                maxLength={120}
              />
            </label>
          </div>
        </div>
      )}

      {estado === "error" && (
        <p className="fb-error" role="alert">
          No se pudo enviar. Lo que escribiste sigue acá: probá de nuevo.
        </p>
      )}

      <button className="btn-nav fb-enviar" type="submit" disabled={!rating || estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}
