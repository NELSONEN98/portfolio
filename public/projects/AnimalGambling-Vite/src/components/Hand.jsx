import { useCallback, useEffect, useRef, useState } from "react";
import { CARD, CARD_LABEL, PUNCH_POINTS, cardHint } from "../../convex/rules";
import { CardArt } from "./icons";
import { GESTO, ms } from "../theme";

/* La cara de una carta: el robo muestra su valor en negativo —es lo que le
   pasa al rival, y el signo lo dice sin leer el rótulo— y el resto su
   ícono. */
export function CardFace({ carta }) {
  /* La de robo lleva el dibujo grande y, debajo, qué hace y por cuánto en
     una sola línea. El número va junto al rótulo y no aparte: cuánto roba
     es lo que decide si conviene jugarla ahora o guardarla, así que tiene
     que leerse en el mismo golpe de vista que la palabra. */
  if (carta.type === CARD.STEAL) {
    return (
      <>
        <span className="card-icon"><CardArt tipo={CARD.STEAL} /></span>
        {/* La cifra grande en el cuerpo: con dos denominaciones —3 y 6— lo
            que hay que leer de un vistazo es CUÁNTO, no cómo se llama. */}
        <span className="card-value">−{carta.value}</span>
        {/* ►► Y vuelve la palabra "ROBAR". ◄◄
         *
         * La había perdido, y por un buen motivo: compartía el cuerpo de la
         * carta con la cifra y le robaba lugar al único dato que cambia
         * entre una y otra. Ese motivo desapareció cuando el nombre se mudó
         * a su propia franja abajo — ahora no compite con nada.
         *
         * Y hacía falta que volviera por dos razones. Sin ella, el robo era
         * la única carta del mazo sin franja blanca y se veía como un error
         * de la pantalla. Y para quien recién aprende, un dibujo con un
         * número no dice qué hace: los otros siete se nombran solos. */}
        <span className="card-kind">{CARD_LABEL[CARD.STEAL]}</span>
      </>
    );
  }

  /* El golpe dice cuánto saca, igual que el robo — pero sin soltar el
     rótulo.
     Es el otro ataque del mazo, y hasta ahora era el único que no ponía su
     número: en la mano se leía "GOLPE" al lado de "−3" y "−6", y para saber
     cuál pegaba más fuerte había que acordarse. Con la cifra puesta, los
     tres ataques se comparan de un vistazo.
     Conserva la palabra porque su número NO cambia entre cartas: el robo la
     soltó porque con dos denominaciones el dato que importa es la cifra, y
     acá el golpe es siempre el mismo. Va en línea y no debajo para no
     apilar un tercer renglón en una carta que ya lleva dibujo y rótulo. */
  if (carta.type === CARD.PUNCH) {
    return (
      <>
        <span className="card-icon"><CardArt tipo={carta.type} /></span>
        <span className="card-kind">
          {CARD_LABEL[CARD.PUNCH]}
          <span className="card-kind-num">−{PUNCH_POINTS}</span>
        </span>
      </>
    );
  }

  return (
    <>
      <span className="card-icon"><CardArt tipo={carta.type} /></span>
      <span className="card-kind">{CARD_LABEL[carta.type]}</span>
    </>
  );
}

/* Abanico: cada carta va corrida unos grados respecto de la del medio.
 *
 *   3 cartas →       −1  0  1
 *   5 cartas →   −2 −1  0  1  2
 *
 * Acá sólo se calcula la POSICIÓN de cada carta respecto del centro; los
 * grados que vale cada paso los pone el CSS en `--paso-giro`, porque el
 * abanico se cierra en pantallas chicas y escrito en línea desde acá
 * ganaba siempre. Sale de una fórmula y no de una tabla porque la mano
 * crece y se achica durante la partida: con valores fijos, cuatro cartas
 * quedarían descentradas. */
function posicionEnAbanico(i, total) {
  return i - (total - 1) / 2;
}

/* Cuánto se mete cada carta sobre la anterior vive en el CSS, en
   `--solape`: cambia con el tamaño de pantalla —en el teléfono el abanico
   se agrupa para dejar sitio al resto de la línea— y escrito acá como
   estilo en línea ganaba siempre, sin dejar que ningún breakpoint lo
   ajustara. */

/* Mantener apretado muestra la carta grande; un toque la juega. El umbral
   es lo que separa las dos intenciones — sin él, cualquier toque
   levantaría la vista previa y jugar se volvería incómodo. */
const MANTENER_MS = ms("cartaMano.mantenerHueco");
/* Cuánto tarda la carta en irse antes de que la jugada llegue al motor. */
const LANZADA_MS = ms("cartaMano.lanzada");

/* Cuánto puede quedarse una carta marcada como "saliendo" antes de que se la
   dé por no jugada. Sale de dos vueltas de sondeo: una jugada que salió bien
   se refleja en la mano dentro de la primera, así que llegar a dos significa
   que no va a llegar. */
const SALIDA_TOPE_MS = ms("red.sondeo") * 2;
const { arrastreMinimo: ARRASTRE_MINIMO, lanzar: LANZAR } = GESTO;

/* Los tres tiempos de recibir una carta: entra desde abajo, el abanico se
   abre para hacerle lugar, y vuelve a cerrarse. Separados porque cada uno
   dura distinto y el del medio tiene que alcanzar a verse. */
const ENTRADA_MS = ms("cartaMano.llega");
const ABIERTO_MS = ms("cartaMano.abrir");

export default function Hand({ cartas = [], habilitada, onPlay, lado = 1 }) {
  const [preview, setPreview] = useState(null);
  /* La carta que está siendo arrastrada y cuánto se alejó del abanico.
     `listo` dice si soltándola ahí se juega, y es lo que permite avisarlo
     antes de que el jugador levante el dedo. */
  const [arrastre, setArrastre] = useState(null);
  const timer = useRef(null);
  const fuePreview = useRef(false);
  /* Dónde apoyó el dedo, para medir desde ahí. */
  const origen = useRef(null);

  /* Qué está pasando con la mano: "entrando" mientras la carta nueva sube,
     "abierto" mientras el abanico le hace lugar. */
  const [fase, setFase] = useState(null);
  const [nuevaUid, setNuevaUid] = useState(null);
  const [saliendo, setSaliendo] = useState(null);
  const anterior = useRef(cartas.map((c) => c.uid));

  useEffect(() => {
    const ahora = cartas.map((c) => c.uid);
    const antes = anterior.current;
    anterior.current = ahora;

    const sumadas = ahora.filter((u) => !antes.includes(u));
    if (!sumadas.length) return;

    /* La última que llegó es la que se anima; si entraran dos juntas, la
       secuencia se vería igual y no vale complicarla. */
    setNuevaUid(sumadas[sumadas.length - 1]);
    setFase("entrando");

    const a = setTimeout(() => setFase("abierto"), ENTRADA_MS);
    const b = setTimeout(() => {
      setFase(null);
      setNuevaUid(null);
    }, ENTRADA_MS + ABIERTO_MS);

    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [cartas]);

  const soltar = useCallback(() => {
    clearTimeout(timer.current);
    setPreview(null);
    setArrastre(null);
    origen.current = null;
  }, []);

  /* El puntero se suelta en la ventana, no en la carta.
     Con los listeners puestos sólo en el botón alcanzaba con que la mano
     se actualizara —y en online el sondeo la reescribe cada dos segundos—
     para que el botón se desmontara con la vista previa abierta: el
     pointerup caía sobre un elemento que ya no existía, nadie limpiaba el
     estado y la carta quedaba clavada en el medio de la pantalla.
     En touch es todavía más fácil de provocar, porque el navegador captura
     el puntero en el elemento y pointerleave no llega a dispararse. */
  useEffect(() => {
    if (!preview && !arrastre) return;
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
    /* Cubre también el arrastre. Con el puntero capturado el `pointerup`
       llega igual a la carta y `levantar` decide si se juega, así que esto
       corre después y no le saca la jugada; sirve para cuando la carta se
       desmontó en el medio y ese `pointerup` ya no tiene a quién llegar. */
  }, [preview, arrastre, soltar]);

  /* Si la carta que estás mirando dejó de estar en la mano —la jugaste, te
     la robaron, terminó el turno— la vista previa pierde sentido y se
     cierra sola. */
  useEffect(() => {
    if (preview && !cartas.some((c) => c.uid === preview.uid)) setPreview(null);
  }, [cartas, preview]);

  /* La marca de "saliendo" se levanta cuando la carta ya no está en la mano,
     no cuando termina la animación. Es el mismo criterio que la vista previa
     de acá arriba: el estado se limpia cuando la razón para tenerlo dejó de
     existir, y no cuando un reloj dice que debería.

     El temporizador de abajo es la red de seguridad, y hace falta: si la
     jugada FALLA —el servidor la rechaza, se corta la red— la carta nunca
     sale de la mano, la condición de arriba no se cumple nunca, y sin esto
     quedaría invisible para siempre, porque el `forwards` de la animación la
     deja transparente. Con el tope vuelve sola a su lugar en el abanico.
     El tope es generoso a propósito: tiene que perder contra el caso normal
     —una jugada que llega— y ganar sólo cuando algo salió mal de verdad. */
  /* Se DERIVA en vez de sincronizarse con un efecto: la carta lleva la marca
     mientras siga en la mano, y deja de llevarla en cuanto sale. Un efecto
     que mirara la mano para apagar el estado sería escribir estado durante
     un pintado para volver a pintar — el mismo dato dicho dos veces. */
  const marcaSalida = saliendo && cartas.some((c) => c.uid === saliendo) ? saliendo : null;

  useEffect(() => {
    if (!marcaSalida) return;
    const t = setTimeout(() => setSaliendo(null), SALIDA_TOPE_MS);
    return () => clearTimeout(t);
  }, [marcaSalida]);

  /* El temporizador de mantener sobrevive al desmontaje si no se corta:
     dispararía un setState sobre un componente que ya no está. */
  useEffect(() => () => clearTimeout(timer.current), []);

  /* Si la carta que venías arrastrando desapareció de la mano, el arrastre
     no tiene sujeto: sin esto quedaría una carta fantasma pegada al dedo. */
  useEffect(() => {
    if (arrastre && !cartas.some((c) => c.uid === arrastre.uid)) setArrastre(null);
  }, [cartas, arrastre]);

  const apretar = useCallback((carta, e) => {
    fuePreview.current = false;
    clearTimeout(timer.current);
    /* Desde dónde empezó el dedo, para medir cuánto se alejó. */
    origen.current = { x: e.clientX, y: e.clientY, uid: carta.uid };
    /* El puntero se captura en la carta: sin esto, al arrastrar rápido el
       dedo se sale del botón y los movimientos siguientes se pierden. */
    e.currentTarget.setPointerCapture?.(e.pointerId);
    timer.current = setTimeout(() => {
      fuePreview.current = true;
      setPreview(carta);
    }, MANTENER_MS);
  }, []);

  /* Arrastrar la carta hacia la mesa para jugarla.
   *
   * Convive con los otros dos gestos sin pedirle al jugador que elija: un
   * toque corto la juega, mantener la muestra grande, y mover la mano la
   * arrastra. Lo que los separa es sólo cuánto se movió el dedo, así que
   * la intención se decide sola mientras el gesto ocurre.
   */
  const mover = useCallback(
    (carta, e) => {
      const ini = origen.current;
      if (!ini || ini.uid !== carta.uid) return;

      const dx = e.clientX - ini.x;
      const dy = e.clientY - ini.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ARRASTRE_MINIMO) return;

      /* Se movió: ya no es un toque con pulso ni una mirada larga. */
      clearTimeout(timer.current);
      if (preview) setPreview(null);

      /* La posición se escribe DIRECTO en el elemento, sin pasar por el
         estado. Un pointermove llega hasta 120 veces por segundo, y con
         cada uno React volvía a pintar el abanico entero —las cinco cartas,
         sus giros, sus solapes— para mover una sola: de ahí el tirón al
         arrastrar. Cambiando la variable a mano, el navegador sólo compone
         de nuevo la carta que se movió. */
      e.currentTarget.style.setProperty("--drag-x", `${dx}px`);
      e.currentTarget.style.setProperty("--drag-y", `${dy}px`);

      /* Al estado sólo llega lo que cambia de verdad: que empezó a
         arrastrarse, y si cruzó el umbral que la vuelve jugable. Eso ocurre
         un par de veces por gesto, no en cada cuadro. */
      const listo = dist >= LANZAR;
      if (!arrastre || arrastre.uid !== carta.uid || arrastre.listo !== listo) {
        setArrastre({ uid: carta.uid, listo });
      }
    },
    [preview, arrastre]
  );

  const levantar = useCallback(
    (carta, e) => {
      clearTimeout(timer.current);
      setPreview(null);
      origen.current = null;

      const nodo = e?.currentTarget;
      const tirandola = arrastre?.uid === carta.uid;
      const llegoLejos = tirandola && arrastre.listo;
      setArrastre(null);

      /* Al abanico ya no llegan defensas —se filtran antes de entrar— así
         que basta con que sea tu turno: todo lo que está acá se puede
         jugar. */
      const jugable = habilitada;
      /* Juega el toque corto o el arrastre que llegó lejos. El largo era
         para mirarla, y el arrastre corto es un arrepentimiento: la carta
         vuelve a su lugar sin jugarse, que es lo que hace que animarse a
         probar el gesto no cueste nada. */
      const juega = jugable && (llegoLejos || (!tirandola && !fuePreview.current));

      if (juega) {
        /* ►► El desplazamiento del gesto NO se borra si la carta se juega. ◄◄
         *
         * Acá estaba el "se devuelve al mazo antes de tirarse". La animación
         * de salida arranca en `translate(var(--drag-x), var(--drag-y))`, o
         * sea DONDE soltaste la carta; borrando esas dos variables antes de
         * lanzarla, el primer cuadro la ponía de vuelta en el abanico y el
         * vuelo salía desde ahí. Se veía exactamente como un rebote hacia
         * atrás — y no era un rebote: era la carta teletransportada.
         *
         * Las variables se van solas con el nodo cuando `onPlay` la saca de
         * la mano, así que no hay nada que limpiar después.
         *
         * `--giro-salida` guarda con qué inclinación arranca el vuelo:
         * arrastrando la carta ya estaba enderezada, y de un toque corto
         * sigue con el ángulo que tiene en el abanico. Sin esto, jugar de un
         * toque enderezaba la carta de golpe en el primer cuadro. */
        nodo?.style.setProperty("--giro-salida", tirandola ? "0deg" : "var(--giro, 0deg)");

        /* Se marca como saliendo antes de avisar: la carta se va hacia
           arriba y recién después desaparece de la mano. Jugándola de una,
           el movimiento no se vería nunca.
         *
         * ►► Y la marca NO se saca acá. ◄◄
         * Antes este mismo temporizador hacía las dos cosas: quitaba la
         * clase y avisaba. Quitarla devuelve la carta a su posición de
         * reposo, así que si en ese instante todavía no se fue de la mano,
         * la carta BAJA de vuelta al abanico y recién después desaparece.
         * Eso pasaba por dos motivos distintos:
         *
         *   · la animación arranca en el cuadro siguiente al `setState`,
         *     unos 16ms después de que este temporizador empezó a contar,
         *     así que el temporizador siempre gana por poco;
         *   · y en online `onPlay` va contra el servidor, o sea que la mano
         *     tarda una vuelta de red en actualizarse — ahí la carta
         *     reaparecía en el abanico durante medio segundo largo.
         *
         * Ahora la clase se mantiene y la carta queda donde la dejó el
         * `forwards` de la animación: arriba y transparente. La limpieza la
         * hace el efecto de abajo, cuando la carta EFECTIVAMENTE salió de la
         * mano — que es el único momento en que se sabe que ya no hace
         * falta. */
        setSaliendo(carta.uid);
        setTimeout(() => onPlay(carta.uid), LANZADA_MS);
      } else {
        /* Vuelve al abanico: ahí sí hay que borrar el desplazamiento. Como
           lo escribió el gesto sin pasar por React, no se limpia solo, y la
           carta quedaría corrida de donde la soltaste. */
        nodo?.style.removeProperty("--drag-x");
        nodo?.style.removeProperty("--drag-y");
      }
      fuePreview.current = false;
    },
    [habilitada, onPlay, arrastre]
  );

  return (
    <>
      <div
        className={`hand-fan lado-${lado + 1}${fase ? ` ${fase}` : ""}`}
        data-n={cartas.length}
        aria-label="Tus cartas"
      >
        {cartas.map((c, i) => {
          /* La defensa se muestra pero no se puede soltar: se gasta sola
             cuando te atacan, y jugarla sería tirarla. */
          const jugable = habilitada;
          const tirando = arrastre?.uid === c.uid;
          return (
            <button
              key={c.uid}
              className={[
                "card",
                c.type,
                jugable ? "" : "no-jugable",
                c.uid === nuevaUid ? "recien-llegada" : "",
                c.uid === marcaSalida ? "lanzada" : "",
                tirando ? "arrastrando" : "",
                tirando && arrastre.listo ? "listo" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                "--pos": posicionEnAbanico(i, cartas.length),
                /* `--drag-x` y `--drag-y` NO se escriben acá: las pone el
                   gesto directo sobre el elemento en cada movimiento. Si se
                   declararan en este objeto, React las volvería a aplicar en
                   cada pintado y borraría lo que acabara de escribir la
                   mano. */
                /* La que se arrastra va por encima de las demás, o se
                   metería por debajo de las que tiene al lado. */
                zIndex: tirando ? cartas.length + 10 : i,
              }}
              /* Lleva la misma explicación que la vista previa: ésa es
                 aria-hidden —es una ampliación de este botón, no contenido
                 nuevo—, así que sin esto la descripción no existiría para
                 quien navega con lector de pantalla. */
              title={`${CARD_LABEL[c.type]} — ${cardHint(c)}`}
              onPointerDown={(e) => apretar(c, e)}
              onPointerMove={(e) => mover(c, e)}
              onPointerUp={(e) => levantar(c, e)}
              /* Ya no cancela al salir del botón: con el puntero capturado
                 arrastrar significa justamente irse de él, y cancelar ahí
                 mataría el gesto apenas empieza. La vista previa se sigue
                 cerrando desde la ventana. */
              onPointerCancel={soltar}
              /* El click nativo se ignora: la jugada la decide el gesto,
                 que distingue el toque del mantener y del arrastre. */
              onClick={(e) => e.preventDefault()}
            >
              <CardFace carta={c} />
            </button>
          );
        })}
      </div>

      {preview && (
        <div className="card-preview" aria-hidden="true">
          <div className={`card ${preview.type}`}>
            <CardFace carta={preview} />
          </div>
          {/* Qué hace, mientras la tenés apretada. Es el único momento en
              que se puede leer sin abrir las reglas y sin soltar el turno. */}
          <p className="card-preview-hint">{cardHint(preview)}</p>
        </div>
      )}
    </>
  );
}
