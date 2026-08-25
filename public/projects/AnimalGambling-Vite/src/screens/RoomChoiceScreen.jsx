import { useEffect, useState } from "react";
import { MIN_PLAYERS, MAX_PLAYERS } from "../../convex/rules";

/* Crear sala o entrar a una. Va antes de elegir personaje: el que crea
   necesita el código para pasárselo a alguien, y recién cuando los demás
   entran tiene sentido ponerse a elegir gato.

   ►► Y ahora además es el vestíbulo. ◄◄

   Antes esto era una pantalla de espera con una frase: "esperando al otro
   jugador". Alcanzaba porque el otro era uno solo y su llegada era el
   evento entero — la sala arrancaba sola con el segundo.

   Con mesas de hasta cuatro esa frase deja de ser cierta y de ser útil: hay
   que decir cuántos hay, quién ya está, y quién decide arrancar.

   ►► Acá vivía un selector de tamaño, y se fue. ◄◄

   Pedía elegir "2, 3 o 4" ANTES de crear la sala, y esa pregunta no se
   puede contestar en ese momento: el anfitrión manda el código y recién
   después se entera de cuántos entran. Era pedirle un pronóstico y después
   hacérselo cumplir — una sala abierta para cuatro con tres adentro no
   arrancaba nunca.

   Ahora hay UNA sola forma de jugar online: se abre la sala, entra quien
   entre hasta cuatro, y el anfitrión arranca con los que haya. El tamaño
   dejó de ser una decisión y pasó a ser un resultado. */

const COPIADO_MS = 1800;

const CopyGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

/* ►► Las dos caras de una silla. ◄◄
 *
 * Ocupada lleva un gato; libre, la silueta del mismo gato en puro contorno.
 * Es a propósito el MISMO dibujo: dos formas distintas —una cara y una silla
 * vacía, por ejemplo— obligarían a comparar dos cosas para contar cuántos
 * hay. Con la misma silueta llena o vacía, el conteo se hace de un vistazo,
 * igual que un medidor de vidas.
 *
 * Van acá y no en `icons.jsx` porque no son del juego: ese archivo dibuja
 * cartas y casillas, cosas de la mesa. Esto es una pantalla de espera. */
const GatoLleno = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path
      d="M14 26 L11 9 L24 18 A28 28 0 0 1 40 18 L53 9 L50 26
         A22 21 0 1 1 14 26 Z"
      fill="currentColor"
    />
    <circle cx="24" cy="34" r="3.4" fill="#000" opacity="0.75" />
    <circle cx="40" cy="34" r="3.4" fill="#000" opacity="0.75" />
    <path
      d="M32 42 l-3 3 h6 z"
      fill="#000"
      opacity="0.75"
    />
  </svg>
);

const GatoVacio = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path
      d="M14 26 L11 9 L24 18 A28 28 0 0 1 40 18 L53 9 L50 26
         A22 21 0 1 1 14 26 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinejoin="round"
      strokeDasharray="5 4"
    />
  </svg>
);

const WhatsGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">
    <path d="M12.04 2A9.9 9.9 0 0 0 2.1 11.9a9.8 9.8 0 0 0 1.36 4.98L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.01A9.9 9.9 0 0 0 22 11.94 9.9 9.9 0 0 0 12.04 2Zm0 18.05h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.05-.2-.31a8.2 8.2 0 1 1 6.98 3.87Zm4.5-6.14c-.24-.12-1.45-.72-1.68-.8-.22-.09-.39-.13-.55.12s-.63.79-.77.96c-.14.16-.28.18-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.15-.24 0-.38.11-.5.11-.11.24-.29.36-.43.12-.15.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.47-.4-.4-.55-.41h-.47c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.72 2.62 4.17 3.68.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.45-.59 1.65-1.17.2-.57.2-1.06.15-1.16-.06-.11-.22-.17-.46-.29Z" />
  </svg>
);

const CheckGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

/* navigator.clipboard sólo existe en contexto seguro. Abierto por file:// o
   por http a secas ni siquiera está definido, y ahí un await pelado tira
   TypeError en vez de rechazar la promesa. El respaldo con textarea es
   viejo, pero funciona donde el otro no llega.
   Devuelve si copió de verdad: cantar "copiado" cuando no se copió nada es
   peor que no decir nada, porque el jugador se va convencido de que tiene
   el código en el portapapeles. */
async function alPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const caja = document.createElement("textarea");
    caja.value = texto;
    caja.setAttribute("readonly", "");
    caja.style.position = "fixed";
    caja.style.opacity = "0";
    document.body.appendChild(caja);
    caja.select();
    let listo = false;
    try {
      listo = document.execCommand("copy");
    } catch {
      /* execCommand no existe o está bloqueado: `listo` ya vale false. */
    }
    document.body.removeChild(caja);
    return listo;
  }
}

export default function RoomChoiceScreen({
  codigo,        // el de la sala creada, mientras se espera
  sala,          // la sala sondeada, o null mientras no llegó
  miLado = 0,
  onCreate,
  onJoin,
  onStart,
  onCancel,
  onBack,
}) {
  const [entrada, setEntrada] = useState("");
  const [copiado, setCopiado] = useState(false);
  const esperando = Boolean(codigo);

  const sentados = sala?.players?.length ?? (esperando ? 1 : 0);
  /* La capacidad sale de las REGLAS y no de la sala: toda mesa se abre al
     tope. Antes venía de `sala.size`, que era el pronóstico del anfitrión;
     ahora ese campo sólo dice a qué número arranca sola y no tiene nada que
     ver con cuántas sillas hay que dibujar. */
  const libres = Math.max(0, MAX_PLAYERS - sentados);
  /* El anfitrión es el asiento 0: el único que estuvo desde el principio y
     por lo tanto el único que sabe a quién está esperando. El servidor
     aplica la misma regla, así que este botón no puede prometer algo que la
     mutación después rechace. */
  const anfitrion = miLado === 0;
  /* Sin `libres > 0`: con la mesa llena la sala arranca sola y esta pantalla
     ya no está. Ponerlo sería escribir una condición para un instante que no
     se ve. */
  const puedeArrancar = anfitrion && sentados >= MIN_PLAYERS;

  /* El visto se apaga solo: si se quedara fijo dejaría de significar
     "acabo de copiar" y pasaría a ser parte del dibujo del botón. */
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), COPIADO_MS);
    return () => clearTimeout(t);
  }, [copiado]);

  const copiar = async () => setCopiado(await alPortapapeles(codigo));

  /* ►► El enlace de invitación. ◄◄
   *
   * El código va en la query y no en el hash: el hash es del router, que lo
   * compara contra su lista de rutas y no reconocería nada pegado ahí.
   *
   * Se arma desde `location` y no desde una dirección escrita a mano porque
   * este juego vive dentro de una carpeta del portafolio y además se abre en
   * local mientras se desarrolla. Una dirección fija funcionaría en uno de
   * los dos lugares y en el otro mandaría a la nada. */
  const enlace = `${location.origin}${location.pathname}?sala=${codigo}`;

  /* `wa.me` sin número abre WhatsApp con el mensaje listo y deja que la
     persona elija a quién mandárselo. Con número habría que pedirlo antes,
     que es exactamente el paso que este botón viene a evitar.
   *
   * El código va en el texto ADEMÁS del enlace: si alguien abre el mensaje
   * en un aparato donde el enlace no funciona —o lo lee por encima del
   * hombro— todavía puede entrar a mano. El enlace es el atajo, no el único
   * camino. */
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Te invito a una mesa de Animal Gambling.

Entra directo: ${enlace}

O usa el código: ${codigo}`
  )}`;

  return (
    <section className="screen room-choice-screen active">
      <div className="room-choice-header">
        <h2>{esperando ? "MESA ABIERTA" : "MESA ONLINE"}</h2>
      </div>

      {!esperando && (
        <div className="room-choice-content">
          <div className="room-choice-option">
            <button className="btn-nav" onClick={onCreate}>
              + CREAR MESA
            </button>
            {/* Se dice el rango acá y no se pregunta: la mesa admite de dos
                a cuatro y el jugador no tiene que elegir nada, pero sí tiene
                que saberlo — si no, manda el código a una sola persona. */}
            <p>
              Genera un código y comparte con tus rivales.{" "}
              <b>De {MIN_PLAYERS} a {MAX_PLAYERS} jugadores</b>: arrancas
              cuando estén los que quieras.
            </p>
          </div>

          {/* El campo va arriba del botón porque ése es el orden en que se
              usa: primero se pega el código y después se entra. Con el
              botón adelante, la acción aparecía antes que su requisito. */}
          <div className="room-choice-option">
            <input
              type="text"
              value={entrada}
              placeholder="Pega el código aquí"
              onChange={(e) => setEntrada(e.target.value.toUpperCase().trim())}
              onKeyDown={(e) => e.key === "Enter" && onJoin(entrada)}
            />
            <button className="btn-nav secondary" onClick={() => onJoin(entrada)}>
              UNIRSE A SALA
            </button>
          </div>
        </div>
      )}

      {esperando && (
        <div className="room-waiting" style={{ display: "flex" }}>
          {/* El código entero es el área de clic, no sólo el botón chico:
              es lo que el jugador ya está mirando y lo que su dedo apunta.
              El botón al lado queda como la señal de que esto se copia —
              un texto que se puede tocar no se anuncia solo. */}
          <div className="room-code">
            <span className="room-code-label">CÓDIGO</span>
            <div className="room-code-box">
              <button
                type="button"
                className="room-code-value"
                onClick={copiar}
                title="Copiar código"
              >
                {codigo}
              </button>
              <button
                type="button"
                className={`room-code-copy${copiado ? " ok" : ""}`}
                onClick={copiar}
                aria-label="Copiar código"
              >
                {copiado ? <CheckGlyph /> : <CopyGlyph />}
              </button>
            </div>
            <span
              className={`room-code-hint${copiado ? " ok" : ""}`}
              aria-live="polite"
            >
              {copiado ? "¡COPIADO!" : "Clic para copiar"}
            </span>

            {/* ►► Compartir por WhatsApp. ◄◄
             *
             * Copiar el código y pegarlo en otra aplicación son cuatro pasos
             * y una pantalla que no es ésta. Este botón los reemplaza por
             * uno, y lo que manda no es el código sino un enlace: quien lo
             * abre se sienta solo, sin escribir nada.
             *
             * `rel="noreferrer"` además de `noopener`: la dirección lleva el
             * código de la sala en la query, y sin esto se lo estaríamos
             * pasando a WhatsApp como referente. */}
            <a
              className="room-compartir"
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsGlyph />
              <span>COMPARTIR POR WHATSAPP</span>
            </a>
          </div>

          {/* ►► Las sillas. ◄◄
              Siempre las cuatro, ocupadas y vacías. Un contador —"2 de 4"—
              dice lo mismo en menos espacio y por eso parece mejor, pero hay
              que leerlo y restar; las sillas se cuentan de un vistazo y
              además hacen VER el lugar libre, que es exactamente la
              información con la que el anfitrión decide si arranca o
              espera. */}
          <ul
            className="room-seats"
            aria-label={`${sentados} de ${MAX_PLAYERS} jugadores`}
          >
            {Array.from({ length: MAX_PLAYERS }, (_, i) => {
              const ocupada = i < sentados;
              return (
                <li
                  key={i}
                  className={`room-seat${ocupada ? " ocupada" : ""}${i === miLado ? " yo" : ""}`}
                >
                  {/* El número va de marca de agua detrás del gato y no como
                      un renglón más: acá lo que se cuenta es cuántas sillas
                      hay ocupadas, y para eso el dibujo alcanza. El número
                      resuelve la otra pregunta —cuál es la mía— y esa se hace
                      una sola vez, así que puede estar en segundo plano. */}
                  <span className="room-seat-n" aria-hidden="true">{i + 1}</span>
                  <span className="room-seat-figura">
                    {ocupada ? <GatoLleno /> : <GatoVacio />}
                  </span>
                  <span className="room-seat-txt">
                    {i === miLado ? "TÚ" : ocupada ? "LISTO" : "LIBRE"}
                  </span>
                  {/* Quién manda la mesa, dicho en la silla y no en un cartel
                      aparte: es el único que puede arrancar, y el botón de
                      abajo sólo aparece de su lado. Sin esto, el invitado lee
                      "el anfitrión decide" sin saber cuál de los cuatro es. */}
                  {i === 0 && (
                    <span className="room-seat-jefe">ANFITRIÓN</span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Lo que se cuenta es lo que HAY, no lo que falta.
              "Faltan 2" era una cuenta contra un tamaño que el anfitrión
              había pronosticado, y ese pronóstico ya no existe: no falta
              nadie, la mesa está lista desde que hay dos. */}
          <p aria-live="polite">
            {sentados < MIN_PLAYERS
              ? "Esperando a que entre alguien…"
              : libres === 0
                ? "Mesa completa — arrancando…"
                : `${sentados} en la mesa · entran hasta ${MAX_PLAYERS}`}
          </p>

          {/* El botón que arranca la partida. No es un escape para cuando
              falta gente: es EL camino, y por eso está siempre a la vista
              del anfitrión desde que hay con quién jugar. */}
          {puedeArrancar && (
            <button className="btn-nav" onClick={onStart}>
              ▸ EMPEZAR CON {sentados}
            </button>
          )}
          {anfitrion && sentados < MIN_PLAYERS && (
            <p className="room-hint">
              Con {MIN_PLAYERS} ya puedes arrancar.
            </p>
          )}
          {/* Al invitado hay que decirle que la espera no depende de él, o
              se queda buscando un botón que no tiene. */}
          {!anfitrion && (
            <p className="room-hint">El anfitrión decide cuándo arrancar.</p>
          )}

          <button className="btn-nav secondary" onClick={onCancel}>Salir</button>
        </div>
      )}

      {/* Último en el orden de tabulación: primero las dos formas de
          entrar, y recién después la salida. */}
      <button className="btn-nav room-choice-back" onClick={onBack}>
        ‹ Volver al menú
      </button>
    </section>
  );
}
