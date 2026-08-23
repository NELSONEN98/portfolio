import { useState } from "react";
import { desbloquear } from "../audio/player";

/* Portada. Toda la pantalla es clickeable además del botón: en el teléfono
   nadie apunta a un botón chico si el resto también entra.
 *
 * ►► Y es donde nace el audio. ◄◄
 *
 * Los navegadores no dejan sonar nada antes de un gesto del jugador, y en
 * iOS el contexto de audio nace suspendido: hay que reanudarlo DENTRO del
 * manejador del toque o falla en silencio.
 *
 * Esta pantalla es el lugar perfecto y no hubo que construirlo: todos pasan
 * por acá antes de jugar, así que para cuando hay un dado que suene el audio
 * lleva dos pantallas despierto. Puesto en el botón de tirar —que sería el
 * primer sitio donde hace falta— el primer dado de cada partida saldría
 * mudo.
 */
export default function TitleScreen({ onStart }) {
  const [saliendo, setSaliendo] = useState(false);

  const salir = () => {
    if (saliendo) return;
    /* Sin `await` y antes que nada: tiene que correr DENTRO del gesto, y la
       navegación no espera al audio. Si falla, se juega sin sonido. */
    desbloquear();
    setSaliendo(true);
    // La transición dura 420ms en el CSS; se navega cuando terminó.
    setTimeout(onStart, 420);
  };

  return (
    <section
      className={`screen title-screen active${saliendo ? " leaving" : ""}`}
      onClick={salir}
    >
      <div className="title-art" />
      <button className="btn-nav title-start" onClick={salir}>
        Iniciar
      </button>
    </section>
  );
}
