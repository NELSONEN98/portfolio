import { useState } from "react";

/* Los modos que existen y los que todavía no.
 *
 * `listo: false` dibuja la entrada pero la deja muerta: un botón que
 * parece vivo y no hace nada es peor que uno que dice que no está. Sumar
 * un modo es dar vuelta la bandera y agregarle su ruta.
 */
export const MENU_ITEMS = [
  /* Una sola entrada para el online, y ahora sí es una sola cosa: se abre
     una mesa, entran de dos a cuatro, y se juega con los que haya. "Duelo"
     nombraba la mesa de dos, que era la única que existía; con tres
     tamaños posibles el nombre estaba mintiendo sobre dos tercios de los
     casos. */
  { id: "online", label: "Mesa Online", listo: true, ruta: "room-choice", modo: "online", nota: "2 a 4" },
  { id: "cpu", label: "Vs. IA", listo: false, nota: "práctica" },
  { id: "local", label: "Duelo Local", listo: true, ruta: "select", modo: "local" },
  /* `jugadores` es lo único que distingue una mesa de otra: el resto del
     camino —elegir gato, repartir, tirar— es el mismo. La mesa de tres es
     literalmente esta línea con un 3, que era lo que decía el comentario
     que estaba acá y ahora está cumplido. */
  { id: "local3", label: "Mesa de 3", listo: true, ruta: "select", modo: "local", jugadores: 3 },
  { id: "local4", label: "Mesa de 4", listo: true, ruta: "select", modo: "local", jugadores: 4 },
  { id: "skins", label: "Personalización", listo: false },
  { id: "shop", label: "Tienda", listo: false },
];

export default function MenuScreen({ onPick, onBack }) {
  const [saliendo, setSaliendo] = useState(false);

  const elegir = (item) => {
    if (!item.listo || saliendo) return;
    setSaliendo(true);
    setTimeout(() => onPick(item), 420);
  };

  return (
    <section className={`screen menu-screen active${saliendo ? " leaving" : ""}`}>
      <div className="menu-art" />

      <nav className="menu-options" aria-label="Menú principal">
        {MENU_ITEMS.map((it) => (
          <button
            key={it.id}
            className={`menu-option${it.listo ? "" : " locked"}`}
            disabled={!it.listo}
            aria-disabled={!it.listo}
            onClick={() => elegir(it)}
          >
            <span className="opt-label">{it.label}</span>
            {it.listo
              ? it.nota && <span className="opt-note">{it.nota}</span>
              : <span className="opt-note locked-note">pronto</span>}
          </button>
        ))}
      </nav>

      <button className="btn-nav" onClick={onBack}>‹ Volver</button>
    </section>
  );
}
