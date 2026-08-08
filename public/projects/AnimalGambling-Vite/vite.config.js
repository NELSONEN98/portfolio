import { defineConfig } from 'vite'

// El juego se sirve desde /projects/animalgambling/, no desde la raíz del
// dominio. Con base absoluta el bundle se pide a /assets/... y da 404.
export default defineConfig({
  base: './',
  build: {
    /* El CSS referencia los dibujos como url(cat1/frame0000.png), relativo
       a sí mismo. Metido en assets/ eso apunta a assets/cat1/… y no existe
       nada ahí. Emitiendo el bundle junto al index las rutas cierran. */
    assetsDir: '.',
  },
})
