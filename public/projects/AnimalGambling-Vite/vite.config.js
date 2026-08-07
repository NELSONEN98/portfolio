import { defineConfig } from 'vite'

// El juego se sirve desde /projects/animalgambling/, no desde la raíz del
// dominio. Con base absoluta el bundle se pide a /assets/... y da 404.
export default defineConfig({
  base: './',
})
