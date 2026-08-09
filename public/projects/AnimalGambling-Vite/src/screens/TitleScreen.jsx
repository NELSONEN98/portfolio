import { useState } from "react";

/* Portada. Toda la pantalla es clickeable además del botón: en el teléfono
   nadie apunta a un botón chico si el resto también entra. */
export default function TitleScreen({ onStart }) {
  const [saliendo, setSaliendo] = useState(false);

  const salir = () => {
    if (saliendo) return;
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
