import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import RivalHand from "./RivalHand";
import { HeartShieldIcon } from "./icons";
import { CONFETI_PAPELES } from "./confeti";

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
  /* En qué celda del dibujo cae este asiento. Va separado de `lado` porque
     son dos cosas distintas: `lado` es QUIÉN es —su color, su fase de
     dibujo, a quién le llega un golpe— y `celda` es DÓNDE se dibuja, que en
     online depende de quién esté mirando. Mezclarlos fue lo que obligó al
     `flip` a existir. */
  celda = 0,
  activo,
  ganador,
  perdedor,
  mostrarMano,
  impacto,
  defensas,
  /* La clave del festejo de vuelta, o 0 si no hay ninguno. Es un número que
     sube y no un booleano: dos vueltas seguidas tienen que volver a
     estallar, y sin algo que cambie React reusa los nodos y la segunda no
     se ve. Mismo recurso que usa el confeti de la casilla. */
  festejo = 0,
  /* Si a este peleador apuntan las cartas del que está jugando. */
  objetivo = false,
}) {
  const score = useAnimatedNumber(jugador?.score ?? 0);
  const current = useAnimatedNumber(jugador?.current ?? 0);

  /* ►► Volcar el acumulado NO es una noticia. ◄◄
   *
   * Al plantarte, el acumulado se suma al marcador. La cifra del cambio
   * anunciaba ese salto como cualquier otro, y era el único caso en que no
   * decía nada nuevo: el jugador venía mirando ese mismo número crecer en
   * el `+N` durante todo el turno. Anunciarlo al final es contarle algo que
   * ya sabe, y de paso le gasta el gesto — cuando de verdad le roban o le
   * pegan, la animación ya perdió el valor de sorpresa.
   *
   * ►► Se reconoce sin estado nuevo, y ésa es la gracia. ◄◄
   *
   * El acumulado también pasa por `useAnimatedNumber`, así que ya lleva su
   * propio `bajando`. Volcar es la ÚNICA jugada en que el marcador sube
   * mientras el acumulado baja: la vuelta al tablero y los robos suben el
   * marcador sin tocarlo, la penitencia lo baja, y quemarse manda el
   * acumulado a cero pero deja el marcador quieto. Las dos banderas ya
   * viven lo que dura el movimiento, así que no hace falta ni un latch ni
   * un temporizador: la respuesta se lee de lo que el marcador ya sabe. */
  const volcado = score.subiendo && current.bajando;
  const anunciaCambio = (score.subiendo || score.bajando) && !volcado;

  if (!jugador) return null;

  const maldito = (jugador.curseTurns ?? 0) > 0;

  const clases = [
    "fighter",
    `f${lado + 1}`,
    `celda-${celda + 1}`,
    objetivo ? "objetivo" : "",
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
        {/* ►► La mira. ◄◄
         *
         * Con dos jugadores esto no hacía falta: "le pego al otro" es la
         * única lectura posible y no hay nada que aclarar. Con cuatro,
         * `targetOf` pasa a ser la regla más importante de la mesa y la
         * pantalla no la decía en ningún lado — el jugador ponía un golpe
         * sin saber a quién le iba a llegar.
         *
         * La disposición ya hace la mitad del trabajo: tu objetivo se dibuja
         * pegado a vos. Esto es la otra mitad, la que lo nombra. */}
        {objetivo && (
          <span className="f-mira" aria-label="Tu objetivo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
            </svg>
          </span>
        )}
        {/* El confeti de la vuelta, encima del dibujo. Va acá adentro y no
            en la línea entera para que reviente sobre el gato —que es el
            que dio la vuelta— y no en un rincón cualquiera del renglón.
            Reusa `.confeti` de la casilla: los mismos papeles y la misma
            animación, porque es el mismo hecho contado en el otro lugar. */}
        {festejo > 0 ? (
          <span className="confeti festejo" key={festejo} aria-hidden="true">
            {CONFETI_PAPELES.map((c, n) => (
              <i className={`papel ${c}`} key={n} style={{ "--n": n }} />
            ))}
          </span>
        ) : null}
      </div>

      <div className="fighter-readout">
        <div className="score-row">
          {/* Cuánto cambió, al lado del marcador y fundiéndose con él.
              El número grande contando dice que algo pasó, pero no cuánto:
              para saberlo habría que acordarse del valor anterior.

              Ahora también cuenta lo que SUMA. Antes sólo aparecía al
              perder, así que el marcador explicaba los golpes y se quedaba
              callado con la vuelta al tablero o con lo que te ganabas
              robando — los puntos aparecían sin decir de dónde.

              El signo va escrito acá y no en el CSS: es parte del dato, no
              de cómo se ve, y un `content` en una pseudo-clase no lo lee un
              lector de pantalla. */}
          <span
            className={`f-hit${anunciaCambio ? " show" : ""}${
              score.delta < 0 ? " menos" : " mas"
            }`}
            aria-hidden="true"
          >
            {anunciaCambio && score.delta
              ? score.delta < 0
                ? `−${-score.delta}`
                : `+${score.delta}`
              : ""}
          </span>
          {/* `sube` / `baja` en vez del `bump` permanente de antes.
              `bump` estaba puesto siempre, así que sólo se reiniciaba
              cuando la lista de clases cambiaba por otra razón; y encima
              competía por el `transform` con la animación de la bajada.
              Estas dos son excluyentes, se encienden con el cambio y se
              apagan solas, que es lo que hace que se reinicien de verdad
              en cada movimiento del marcador. */}
          {/* El marcador tampoco se expande al volcar: la expansión es la
              otra mitad del mismo gesto, y sin la cifra que la provoca
              queda un número inflándose sin motivo a la vista. El conteo
              hacia arriba se conserva — eso no es el aviso, es el número
              yendo a su valor nuevo. */}
          <div
            className={`f-score${score.bajando ? " down" : ""}${
              anunciaCambio ? (score.bajando ? " baja" : " sube") : ""
            }`}
          >
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
