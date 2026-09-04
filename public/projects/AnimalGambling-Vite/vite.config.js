import { defineConfig } from 'vite'

/* ►► Qué versión del juego probó quien deja una opinión. ◄◄
 *
 * El formulario del final manda este dato junto con el resto. Sin él, un
 * bug que se arregló hace un mes vuelve a leerse como un bug abierto, y no
 * hay forma de saber si dos reportes iguales son el mismo problema o uno
 * que volvió.
 *
 * Es la fecha del build y no el `version` del package.json, que hace
 * meses dice 0.0.0 y nadie lo sube: un número que no cambia no distingue
 * nada. Esto cambia solo, en cada publicación, sin que haya que acordarse.
 */
const VERSION_BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ')

// El juego se sirve desde /projects/animalgambling/, no desde la raíz del
// dominio. Con base absoluta el bundle se pide a /assets/... y da 404.
export default defineConfig({
  base: './',
  define: {
    __VERSION__: JSON.stringify(VERSION_BUILD),
  },
  build: {
    /* El CSS referencia los dibujos como url(cat1/frame0000.png), relativo
       a sí mismo. Metido en assets/ eso apunta a assets/cat1/… y no existe
       nada ahí. Emitiendo el bundle junto al index las rutas cierran. */
    assetsDir: '.',
  },
})
