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
  /* ►► Acá estaban "Mesa de 3" y "Mesa de 4", locales. Se fueron del menú. ◄◄
   *
   * No se borró nada más que estas dos líneas, y es a propósito: el camino
   * sigue entero. `jugadores` sigue viajando en el item, App.jsx sigue
   * leyéndolo (`item.jugadores ?? 2`) y las mesas de tres y cuatro siguen
   * dibujándose y jugándose enteras — por el online, que es de donde entran
   * ahora. Devolverlas al menú es volver a poner estas dos líneas.
   *
   * Se sacaron del MENÚ, no del juego. Borrar el soporte para sacar dos
   * botones habría sido tirar la mesa entera para no ver la silla. */
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
