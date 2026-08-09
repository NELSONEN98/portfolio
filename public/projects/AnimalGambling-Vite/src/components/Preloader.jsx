import { useEffect, useState } from "react";
import { ms } from "../theme";

/* Piso en pantalla: un preloader que aparece cien milisegundos y se va
   parece un parpadeo defectuoso, no una presentación. */
const MINIMO_MS = ms("pantalla.preloaderMinimo");

export default function Preloader() {
  const [yendose, setYendose] = useState(false);
  const [fuera, setFuera] = useState(false);

  useEffect(() => {
    const arranque = performance.now();

    /* Espera dos cosas antes de irse:
       - la fuente, porque yéndose antes el nombre aparecería en la
         tipografía de respaldo y saltaría a Bungee a la vista de todos;
       - el evento load, que es cuando terminaron las imágenes del título. */
    const listo = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((ok) => window.addEventListener("load", ok, { once: true })),
    ]);

    let salida;
    let quitar;

    listo.then(() => {
      const resta = Math.max(0, MINIMO_MS - (performance.now() - arranque));
      salida = setTimeout(() => {
        setYendose(true);
        // Desmontar recién cuando terminó de desvanecerse.
        quitar = setTimeout(() => setFuera(true), 600);
      }, resta);
    });

    return () => {
      clearTimeout(salida);
      clearTimeout(quitar);
    };
  }, []);

  if (fuera) return null;

  return (
    <div id="preloader" className={yendose ? "done" : ""} style={{ background: "#fff" }}>
      <div className="preloader-text">
        La mini tarberna
        <br />
        GAMES
      </div>
    </div>
  );
}
