import { useEffect, useState } from "react";
import { ms } from "../theme";
import { desbloquear, musica, silenciar, volumen } from "../audio/player";

/* Piso en pantalla: un preloader que aparece cien milisegundos y se va
   parece un parpadeo defectuoso, no una presentación. */
const MINIMO_MS = ms("pantalla.preloaderMinimo");

/* ►► Esta pantalla ya no se va sola: es la puerta del sonido. ◄◄
 *
 * Antes decía el nombre del estudio y se iba cuando terminaba de cargar. Lo
 * que hace ahora es lo único que NO se puede hacer en ningún otro lado: los
 * navegadores no dejan sonar nada hasta que el jugador toque algo, así que
 * la música necesita un gesto suyo, y un gesto necesita algo que lo pida.
 *
 * ►► Espera DOS cosas, no una. ◄◄
 *
 * El toque solo no alcanza: si alguien entra y aprieta al instante, el
 * juego aparecería a medio cargar —sin la tipografía, con los dibujos del
 * título todavía en camino—. Y la carga sola tampoco, que es lo que hacía
 * antes: sin gesto no hay audio.
 *
 * Así que la puerta se abre cuando la carga terminó, y recién ahí el botón
 * empieza a responder. Mientras tanto se ve el aviso con el botón quieto,
 * que además explica la espera en vez de dejar una pantalla muda.
 */
export default function Preloader() {
  const [listo, setListo] = useState(false);
  const [yendose, setYendose] = useState(false);
  const [fuera, setFuera] = useState(false);

  useEffect(() => {
    const arranque = performance.now();

    /* Espera dos cosas antes de habilitarse:
       - la fuente, porque abriendo antes el nombre aparecería en la
         tipografía de respaldo y saltaría a Bungee a la vista de todos;
       - el evento load, que es cuando terminaron las imágenes del título. */
    const cargado = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((ok) => window.addEventListener("load", ok, { once: true })),
    ]);

    let abrir;
    cargado.then(() => {
      /* El mínimo se respeta igual: cargar rapidísimo no es motivo para que
         el aviso pase de largo antes de que nadie llegue a leerlo. */
      const resta = Math.max(0, MINIMO_MS - (performance.now() - arranque));
      abrir = setTimeout(() => setListo(true), resta);
    });

    return () => clearTimeout(abrir);
  }, []);

  /* ►► Todo lo del audio va acá adentro, sincrónico. ◄◄
   *
   * `desbloquear` tiene que correr DENTRO del manejador del gesto: en iOS el
   * contexto nace suspendido y reanudarlo un tick más tarde —después de un
   * `await`, o en un efecto— falla en silencio, que es la peor forma de
   * fallar. Por eso no se espera su promesa antes de pedir la música.
   *
   * Y si el audio no arranca igual, la pantalla se va lo mismo: quedarse
   * trabada dejaría a alguien sin juego por no tener sonido. */
  const entrar = () => {
    if (!listo || yendose) return;
    desbloquear();

    /* ►► Un botón que dice "con sonido" tiene que dar sonido. ◄◄
     *
     * El silencio y el volumen se guardan en `localStorage` y sobreviven a
     * la pestaña. Sin esto, alguien con un `ag:mute` viejo guardado apretaba
     * "Entrar con sonido" y entraba en silencio: la pista arrancaba, corría
     * y avanzaba —comprobado, `paused:false` y el tiempo subiendo— pero con
     * `volume: 0`. Todo bien y nada que oír, que es la peor forma de fallar
     * porque no deja ni un error para seguir.
     *
     * Apretar ESTE botón es una declaración de intención de este momento, y
     * le gana a un ajuste que quedó de otra sesión. El volumen en cero se
     * trata igual que el silencio: es lo mismo puesto por otro lado.
     *
     * El día que haya un control de sonido adentro del juego, lo que ese
     * control guarde vale igual — esto corre una sola vez, al entrar. */
    silenciar(false);
    if (volumen() <= 0) volumen(0.8);

    musica("tema");
    setYendose(true);
    // Desmontar recién cuando terminó de desvanecerse.
    setTimeout(() => setFuera(true), 600);
  };

  if (fuera) return null;

  return (
    <div id="preloader" className={yendose ? "done" : ""}>
      <div className="preloader-caja">
        <div className="preloader-nota" aria-hidden="true">♪</div>
        <div className="preloader-text">
          ACTIVAR SONIDO
        </div>
        <p className="preloader-aviso">
          Este juego tiene música y sonido.
        </p>
        <button
          className="preloader-btn"
          onClick={entrar}
          disabled={!listo}
          /* Sin `listo` el botón todavía no hace nada, y decirlo en voz alta
             es lo que separa "esperá" de "esto no anda". */
          aria-label={listo ? "Entrar con sonido" : "Cargando el juego"}
        >
          {listo ? "Entrar con sonido" : "Cargando…"}
        </button>
      </div>
    </div>
  );
}
