import { useCallback, useEffect, useRef, useState } from "react";
import { CARD, CARD_LABEL, cardHint } from "../../convex/rules";
import { CARD_ICON } from "./icons";
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
    const Rata = CARD_ICON[CARD.STEAL];
    return (
      <>
        <span className="card-icon">{Rata ? <Rata /> : null}</span>
        <span className="card-kind">
          {CARD_LABEL.steal} <b className="card-steal-num">−{carta.value}</b>
        </span>
      </>
    );
  }
  const Icono = CARD_ICON[carta.type];
  return (
    <>
      <span className="card-icon">{Icono ? <Icono /> : null}</span>
      <span className="card-kind">{CARD_LABEL[carta.type]}</span>
    </>
  );
}

/* Abanico: 3° entre carta y carta, repartidos alrededor del centro.
 *
 *   3 cartas →        −3°  0°  3°
 *   5 cartas →   −6° −3°  0°  3°  6°
 *   7 cartas → −9° −6° −3°  0°  3°  6°  9°
 *
 * Sale de una fórmula y no de una tabla porque la mano crece y se achica
 * durante la partida: con valores fijos, cuatro cartas quedarían
 * descentradas. */
const PASO_GRADOS = 3;

export function anguloDe(i, total) {
  return (i - (total - 1) / 2) * PASO_GRADOS;
}

/* Cuánto se mete cada carta sobre la anterior. En un abanico real las
   cartas se tapan; sin superposición esto sería una lista inclinada. */
const SOLAPE = 0.42;

/* Mantener apretado muestra la carta grande; un toque la juega. El umbral
   es lo que separa las dos intenciones — sin él, cualquier toque
   levantaría la vista previa y jugar se volvería incómodo. */
const MANTENER_MS = ms("cartaMano.mantenerHueco");
/* Cuánto tarda la carta en irse antes de que la jugada llegue al motor. */
const LANZADA_MS = ms("cartaMano.lanzada");
const { arrastreMinimo: ARRASTRE_MINIMO, lanzar: LANZAR } = GESTO;

/* Los tres tiempos de recibir una carta: entra desde abajo, el abanico se
   abre para hacerle lugar, y vuelve a cerrarse. Separados porque cada uno
   dura distinto y el del medio tiene que alcanzar a verse. */
const ENTRADA_MS = ms("cartaMano.llega");
const ABIERTO_MS = ms("cartaMano.abrir");

export default function Hand({ cartas = [], habilitada, onPlay }) {
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
  const mover = useCallback((carta, e) => {
    const ini = origen.current;
    if (!ini || ini.uid !== carta.uid) return;

    const dx = e.clientX - ini.x;
    const dy = e.clientY - ini.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ARRASTRE_MINIMO) return;

    /* Se movió: ya no es un toque con pulso ni una mirada larga. */
    clearTimeout(timer.current);
    if (preview) setPreview(null);

    setArrastre({ uid: carta.uid, dx, dy, listo: dist >= LANZAR });
  }, [preview]);

  const levantar = useCallback(
    (carta) => {
      clearTimeout(timer.current);
      setPreview(null);
      origen.current = null;

      const tirandola = arrastre?.uid === carta.uid;
      const llegoLejos = tirandola && arrastre.listo;
      setArrastre(null);

      const jugable = habilitada && carta.type !== CARD.DEFENSE;
      /* Juega el toque corto o el arrastre que llegó lejos. El largo era
         para mirarla, y el arrastre corto es un arrepentimiento: la carta
         vuelve a su lugar sin jugarse, que es lo que hace que animarse a
         probar el gesto no cueste nada. */
      const juega = jugable && (llegoLejos || (!tirandola && !fuePreview.current));

      if (juega) {
        /* Se marca como saliendo antes de avisar: la carta se va hacia
           arriba y recién después desaparece de la mano. Jugándola de una,
           el movimiento no se vería nunca. */
        setSaliendo(carta.uid);
        setTimeout(() => {
          setSaliendo(null);
          onPlay(carta.uid);
        }, LANZADA_MS);
      }
      fuePreview.current = false;
    },
    [habilitada, onPlay, arrastre]
  );

  return (
    <>
      <div className={`hand-fan${fase ? ` ${fase}` : ""}`} aria-label="Tus cartas">
        {cartas.map((c, i) => {
          /* La defensa se muestra pero no se puede soltar: se gasta sola
             cuando te atacan, y jugarla sería tirarla. */
          const jugable = c.type !== CARD.DEFENSE && habilitada;
          const tirando = arrastre?.uid === c.uid;
          return (
            <button
              key={c.uid}
              className={[
                "card",
                c.type,
                jugable ? "" : "no-jugable",
                c.uid === nuevaUid ? "recien-llegada" : "",
                c.uid === saliendo ? "lanzada" : "",
                tirando ? "arrastrando" : "",
                tirando && arrastre.listo ? "listo" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                "--giro": `${anguloDe(i, cartas.length)}deg`,
                "--solape": SOLAPE,
                /* Lo que se movió el dedo, para que la carta lo siga. Las
                   escribe el gesto y las lee el CSS: así el arrastre no
                   necesita recalcular la posición del abanico. */
                ...(tirando
                  ? { "--drag-x": `${arrastre.dx}px`, "--drag-y": `${arrastre.dy}px` }
                  : null),
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
              onPointerUp={() => levantar(c)}
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
