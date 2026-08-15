/* Dónde está un elemento respecto del centro de la pantalla.
 *
 * Se mide en vez de calcularse: la mesa se dimensiona con `dvh` y `rem` a la
 * vez, así que la posición de sus piezas no se puede expresar en `vmin` sin
 * quedar cerca pero mal — y peor, quedar mal de forma distinta en cada
 * pantalla.
 *
 * Devuelve null si no encuentra el elemento o si todavía no tiene tamaño. El
 * que llama decide qué hacer con eso; en general, caer en los valores de
 * respaldo del CSS: que algo salga de un lugar aproximado es mucho mejor que
 * no mostrarlo.
 *
 * Vive suelto y no adentro de un componente porque lo usan dos —la carta que
 * entrega el bonus y el reparto de la apertura— y una copia por componente
 * es una copia que se corrige en uno solo.
 */
export function medir(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  return {
    x: Math.round(r.left + r.width / 2 - window.innerWidth / 2),
    y: Math.round(r.top + r.height / 2 - window.innerHeight / 2),
  };
}
