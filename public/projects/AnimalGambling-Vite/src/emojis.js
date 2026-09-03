/* ►► LOS EMOJIS QUE SE PUEDEN TIRAR EN LA MESA. ◄◄
 *
 * Un archivo, como `roster.js` para los gatos y `sonidos.js` para el audio.
 * Ningún componente escribe una ruta ni un rótulo: piden la lista.
 *
 * ►► El orden ES la posición en pantalla. ◄◄
 *
 * El anillo se dibuja recorriendo esta lista, así que el primero cae arriba
 * del personaje, el del medio a su izquierda y el último abajo. Reordenar
 * acá reordena el abanico, y agregar uno lo reparte solo — el ángulo se
 * calcula con la cantidad, no está escrito en ningún lado.
 *
 * ►► `label` no es decoración. ◄◄
 *
 * Es lo único que tiene quien no ve el dibujo: son cinco botones que
 * mandan cinco cosas distintas y ninguno lleva texto. Va al `aria-label` y
 * al `title`.
 */
export const EMOJIS = [
  { id: "smart", img: "emojis/smart.webp", label: "Te lo dije" },
  { id: "anger", img: "emojis/anger.webp", label: "Bronca" },
  { id: "electrocutado", img: "emojis/electrocutado.webp", label: "Fulminado" },
  { id: "cry", img: "emojis/cry.webp", label: "Llanto" },
  { id: "piedad", img: "emojis/piedad.webp", label: "Piedad" },
];

export function emojiPorId(id) {
  return EMOJIS.find((e) => e.id === id) ?? null;
}

/* ►► Se calientan igual que los gatos, y por el mismo motivo. ◄◄
 *
 * Un emoji aparece y se va en poco más de un segundo. Sin precargar, el
 * navegador recién PIDE el archivo cuando el jugador abre el anillo, y son
 * 150KB cada uno: el abanico se abriría con cinco huecos y se llenaría de a
 * uno. La primera vez de cada partida se vería roto y la segunda bien, que
 * es la clase de fallo que parece un fantasma.
 *
 * Prioridad baja a propósito: esto compite con los dibujos de los gatos, que
 * son lo que el jugador está mirando mientras tanto.
 */
let calentados = false;
export function warmEmojis() {
  if (calentados) return;
  calentados = true;
  for (const e of EMOJIS) {
    const img = new Image();
    img.fetchPriority = "low";
    img.src = e.img;
  }
}
