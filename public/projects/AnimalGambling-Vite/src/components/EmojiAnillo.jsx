import { EMOJIS } from "../emojis";

/* ►► EL ABANICO DE EMOJIS. ◄◄
 *
 * Se abre sosteniendo el propio personaje y rodea al gato, salvo por la
 * derecha: ese lado es el borde de la pantalla —el personaje del jugador va
 * clavado ahí con `justify-self: end`— y cualquier cosa dibujada de ese lado
 * se saldría o quedaría pegada al filo.
 *
 * ►► El ángulo se CALCULA, no se escribe. ◄◄
 *
 * Barre media vuelta: arranca arriba del personaje, pasa por su izquierda y
 * termina abajo. Repartir esa media vuelta entre los que haya significa que
 * agregar o sacar un emoji del catálogo reacomoda el abanico solo. Cinco
 * posiciones escritas a mano serían cinco números que hay que rehacer el día
 * que aparezca el sexto — y nadie se acuerda de eso hasta que lo ve mal.
 *
 * Los dos extremos van justo arriba y justo abajo, no en diagonal: son las
 * dos posiciones que quedan lejos del borde derecho pase lo que pase, así
 * que el abanico entero cae siempre del lado seguro.
 */
export default function EmojiAnillo({ abierto, onElegir }) {
  if (!abierto) return null;

  const n = EMOJIS.length;

  return (
    /* `presentation` y no un `menu` de verdad: el anillo se opera con el
       dedo apoyado, no con el teclado, y anunciarlo como menú prometería una
       navegación con flechas que no existe. Cada emoji sí es un botón real,
       que es lo que de verdad se puede tocar. */
    <div className="emoji-anillo" role="presentation">
      {EMOJIS.map((e, i) => {
        /* De −90° (arriba) a −270° (abajo), pasando por −180° (izquierda).
           Con uno solo el reparto sería una división por cero: ahí se lo
           deja a la izquierda, que es el medio del recorrido. */
        const grados = n === 1 ? -180 : -90 - (i * 180) / (n - 1);
        const rad = (grados * Math.PI) / 180;
        return (
          <button
            key={e.id}
            className="emoji-opcion"
            style={{
              /* El radio vive en el CSS —depende del tamaño del personaje,
                 que cambia con la mesa— y acá sólo viaja la DIRECCIÓN. */
              "--x": Math.cos(rad).toFixed(4),
              "--y": Math.sin(rad).toFixed(4),
              /* Escalonado: el abanico se abre como un abanico y no como
                 cinco cosas apareciendo juntas. */
              "--retraso": `${i * 35}ms`,
            }}
            /* Lo lee el personaje al soltar el dedo: con el puntero
               capturado, esto es lo único que dice qué emoji hay debajo. */
            data-emoji={e.id}
            title={e.label}
            aria-label={e.label}
            /* ►► Esto cubre el segundo gesto, no el primero. ◄◄
             *
             * Hay dos formas de llegar acá y sólo una pasa por este
             * manejador:
             *
             *  · sostener, ARRASTRAR hasta el emoji y soltar — el puntero
             *    quedó capturado por el personaje desde el primer apoyo,
             *    así que estos botones NO reciben eventos. Ese caso lo
             *    resuelve el personaje leyendo qué hay debajo del dedo al
             *    soltar (ver `alSoltar` en Fighter).
             *  · sostener, soltar sin elegir —el anillo queda abierto un
             *    instante— y tocar un emoji: ahí sí es un puntero nuevo y
             *    este manejador es el que corre.
             *
             * `pointerdown` y no `click` porque el segundo también es un
             * toque, y esperar el click agrega una espera que no aporta. */
            onPointerDown={(ev) => {
              ev.stopPropagation();
              ev.preventDefault();
              onElegir?.(e.id);
            }}
          >
            <img src={e.img} alt="" draggable="false" />
          </button>
        );
      })}
    </div>
  );
}
