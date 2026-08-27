import { useCallback, useEffect, useRef, useState } from "react";

import EmojiAnillo from "./EmojiAnillo";
import { emojiPorId } from "../emojis";
import { ms } from "../theme";
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
  /* Sólo el personaje del propio jugador abre el abanico. Los de los rivales
     se dibujan igual pero no responden al gesto: tirar un emoji desde la
     cara de otro sería hablar por él. */
  puedeEmotear = false,
  /* El emoji que este peleador está mostrando ahora, o null. Viene de
     ARRIBA y no se guarda acá: el día que los emojis viajen por la red, lo
     que cambia es de dónde sale este dato, y este componente no se entera. */
  emote = null,
  onEmote,
}) {
  const score = useAnimatedNumber(jugador?.score ?? 0);
  const current = useAnimatedNumber(jugador?.current ?? 0);

  /* ►► SOSTENER PARA ABRIR. ◄◄
   *
   * Un temporizador que arranca al apoyar y se cancela con cualquier cosa
   * que interrumpa el gesto: soltar, salirse del personaje, o que el sistema
   * se lleve el puntero (un gesto del navegador, una llamada entrante).
   *
   * Se cancela en el `pointerup` TAMBIÉN cuando ya se abrió, y ahí está el
   * detalle: si el jugador suelta sin haber elegido, el anillo se cierra.
   * Un abanico que queda abierto tapando media mesa hasta que alguien lo
   * toque de nuevo es peor que no tenerlo. */
  const [anillo, setAnillo] = useState(false);
  const espera = useRef(null);
  /* El elemento del marco y el puntero que lo está apretando. Los dos hacen
     falta para tomar la captura cuando el abanico se abre. */
  const marco = useRef(null);
  const puntero = useRef(null);

  const cancelarEspera = useCallback(() => {
    clearTimeout(espera.current);
    espera.current = null;
  }, []);

  useEffect(() => cancelarEspera, [cancelarEspera]);

  /* ►► Abierto se DERIVA, no se sincroniza. ◄◄
   *
   * Acá había un efecto que cerraba el anillo cuando el peleador dejaba de
   * ser tuyo —cambia el turno en la mesa local— y eso es escribir estado
   * desde un efecto: encadena pintados y React lo marca como error.
   *
   * No hace falta ninguno: un anillo sobre un personaje que ya no es tuyo
   * simplemente no se dibuja. La pregunta "¿está abierto?" es "lo abrí Y
   * sigue siendo mío", y eso es una cuenta, no un estado que mantener al
   * día. Es lo mismo que pasó con la barra del reloj: el estado sobraba. */
  const anilloAbierto = anillo && puedeEmotear;

  const alApoyar = (ev) => {
    if (!puedeEmotear || anilloAbierto) return;
    /* Sólo el botón principal: un clic derecho abre el menú del navegador y
       el anillo quedaría abierto debajo. */
    if (ev.button != null && ev.button !== 0) return;
    cancelarEspera();
    puntero.current = ev.pointerId;
    espera.current = setTimeout(() => {
      /* ►► Tomar la captura es lo que hace posible arrastrar. ◄◄
       *
       * Sin esto, mover el dedo o el mouse fuera del personaje dispara
       * `pointerleave` — y como ese evento también cierra el abanico, el
       * jugador no llegaba nunca hasta un emoji: el anillo se cerraba en
       * cuanto salía del gato para ir a buscarlo.
       *
       * Con la captura, todos los eventos de este puntero siguen llegando
       * acá hasta que se suelte, salga por donde salga. Es lo mismo que hace
       * cualquier control que se arrastra, y es lo que unifica el teléfono
       * —donde el navegador la toma solo— con el escritorio, donde no. */
      try {
        marco.current?.setPointerCapture?.(puntero.current);
      } catch {
        /* Un puntero que ya se soltó no se puede capturar. Si falla, el
           abanico igual se abre y se elige con un segundo toque. */
      }
      setAnillo(true);
    }, ms("emoji.sostener"));
  };

  /* ►► Soltar sobre un emoji lo elige. ◄◄
   *
   * Este es el gesto natural y era el que no funcionaba: sostener, arrastrar
   * hasta el emoji, soltar. Y no funcionaba por una razón que no se ve
   * leyendo el código del anillo — al apoyar el dedo sobre el personaje, el
   * navegador le da a ESE elemento la captura del puntero, así que todo lo
   * que pase después le llega a él y nunca a los botones de abajo. El
   * `pointerdown` de cada emoji jamás se disparaba mientras el dedo siguiera
   * apoyado.
   *
   * `elementFromPoint` pregunta qué hay en esas coordenadas, que es
   * exactamente el dato que la captura esconde. Es la misma pregunta que se
   * haría el navegador si el puntero no estuviera capturado.
   *
   * Si al soltar no hay ningún emoji debajo —el dedo se fue al vacío o
   * volvió sobre el gato— el anillo simplemente se cierra, que es la forma
   * de arrepentirse sin elegir nada. */
  /* Sólo cancela: no elige. Se usa para el puntero que se va o que el
     sistema se lleva, y para el dedo que sale del personaje ANTES de que el
     abanico se abriera —ahí todavía no hay captura y `pointerleave` sí
     llega—. Un gesto interrumpido no debería elegir nada. */
  const alCancelar = () => {
    cancelarEspera();
    setAnillo(false);
  };

  const alSoltar = (ev) => {
    cancelarEspera();
    if (anilloAbierto && ev?.clientX != null) {
      const bajoElDedo = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest?.(".emoji-opcion");
      const id = bajoElDedo?.dataset?.emoji;
      if (id) {
        setAnillo(false);
        onEmote?.(id);
        return;
      }
    }
    setAnillo(false);
  };

  const elegir = (id) => {
    cancelarEspera();
    setAnillo(false);
    onEmote?.(id);
  };


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

  const dibujoEmote = emote ? emojiPorId(emote.id) : null;

  return (
    <div className={clases}>
      {/* ►► Una caja alrededor del marco, sin recorte. ◄◄
       *
       * `.fighter-frame` lleva `overflow: hidden` —lo necesita: es lo que
       * redondea las esquinas del retrato— así que todo lo que viva adentro
       * queda recortado a la silueta del gato. El anillo aparecía y se
       * cortaba contra ese borde.
       *
       * Esta caja tiene la misma medida que el marco pero no recorta, así
       * que el anillo y el emoji pueden salirse. Y NO lleva `z-index`
       * propia a propósito: sin ella no crea contexto de apilamiento, y
       * entonces la `z-index` del anillo compite al nivel de la LÍNEA del
       * peleador, que es donde están las cartas contra las que tiene que
       * ganar. Puesta acá, el anillo quedaría encerrado en esta caja y
       * volveríamos al mismo problema una capa más arriba. */}
      <div className="fighter-marco">
        <EmojiAnillo abierto={anilloAbierto} onElegir={elegir} />

        {/* El emoji tirado, encima del personaje. Va acá y no dentro del
            marco por lo mismo: rebota hasta 1,12 al entrar y el marco le
            comía el rebote.
            La clave lo reinicia — dos veces el mismo emoji seguido tienen
            que volver a animarse, y sin algo que cambie React reusa el nodo
            y la segunda no se ve. Mismo recurso del confeti y del golpe. */}
        {dibujoEmote && (
          <span
            key={emote.key}
            className="fighter-emote"
            style={{ backgroundImage: `url("${dibujoEmote.img}")` }}
            aria-label={dibujoEmote.label}
            role="img"
          />
        )}

      <div
        ref={marco}
        className={`fighter-frame${puedeEmotear ? " emoteable" : ""}${anilloAbierto ? " con-anillo" : ""}`}
        onPointerDown={alApoyar}
        onPointerUp={alSoltar}
        /* Salir del personaje sólo cancela mientras NO haya captura, o sea
           antes de que el abanico se abra. Después la captura impide que
           este evento llegue, que es justo lo que permite ir a buscar un
           emoji sin que el anillo se cierre en el camino. */
        onPointerLeave={alCancelar}
        onPointerCancel={alCancelar}
        /* El menú contextual del navegador aparece con el MISMO gesto en
           teléfono —mantener apretado— y taparía el anillo justo cuando se
           abre. */
        onContextMenu={(ev) => puedeEmotear && ev.preventDefault()}
      >
        <div className="fighter-art boil" data-cat={jugador.char.id}>
          {/* ►► La cara de dolor, encima del boil. ◄◄
           *
           * Va DENTRO de `.fighter-art` y no en su lugar porque el boil es
           * un `background-image` que cicla por CSS: reemplazarlo obligaría
           * a apagar la animación y volver a encenderla, y el gato saltaría
           * a un cuadro cualquiera al terminar el golpe. Encima, tapándolo,
           * el ciclo sigue corriendo abajo sin enterarse y al apagarse la
           * capa el dibujo continúa donde estaba.
           *
           * Se monta SIEMPRE, no sólo durante el golpe. Montarla al recibir
           * el impacto significaría empezar a descargar la imagen recién en
           * ese momento —los 900ms del golpe no alcanzan para 80KB— y el
           * primer golpe de cada partida no mostraría nada. Existe desde el
           * principio, invisible, y lo único que hace la clase es
           * encenderla.
           *
           * La ruta sale de la ficha del gato y no de un patrón: los cuatro
           * archivos no se llaman igual. El porqué está en roster.js. */}
          {jugador.char.damage && (
            <span
              className="fighter-damage"
              style={{ backgroundImage: `url("${jugador.char.damage}")` }}
              aria-hidden="true"
            />
          )}
        </div>
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
