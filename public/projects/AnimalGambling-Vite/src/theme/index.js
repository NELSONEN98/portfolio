/* La cara pública del tema: SÓLO DATOS.
 *
 * Acá no se reexporta applyTheme y no es un olvido. applyTheme toca
 * `document`, y como los import se resuelven antes de que corra una sola
 * línea, alcanza con que este índice lo nombre para que todo el que haga
 * `import { ms } from "../theme"` se lleve el código del DOM de arriba.
 * En el navegador no se nota; en React Native eso revienta al importar,
 * antes de renderizar nada, y el error no apunta al culpable.
 *
 * Por eso el puente web se importa explícito y desde un solo lugar
 * (main.jsx), que es el único archivo que ya sabe que existe un DOM:
 *
 *   import { aplicarTema } from "./theme/applyTheme";
 *
 * La regla, dicha corta: por este índice pasa lo que se puede leer en
 * cualquier plataforma. Lo que toca una plataforma concreta se pide por
 * su nombre completo, para que se vea.
 */
export { COLOR, SEMANTICA, FUENTE, CARTA, TABLERO, DADO, BOTON, GESTO, ESPACIO, CAPA } from "./tokens";
export { MOTION, EASE, ms, entradas } from "./motion";
