import { leerAjuste } from "../storage";

/* ►► EL SILENCIO DE DESARROLLO, SIN JSX. ◄◄
 *
 * Vive aparte del botón porque lo consultan dos módulos que no son
 * componentes: `audio/player.js`, que decide con qué volumen arranca, y
 * `components/Preloader.jsx`, que decide si enciende el sonido al entrar.
 * Si esto viviera dentro del `.jsx` del botón, los dos tendrían que
 * importar un componente de React para leer un booleano.
 *
 * ►► `import.meta.env.DEV` está DENTRO de la función, no afuera. ◄◄
 *
 * Puesto adentro, Vite lo reemplaza por `false` al construir y el cuerpo
 * entero queda como código muerto: la función devuelve `false` constante
 * en producción y ni siquiera lee el localStorage. Un `if` afuera que
 * envolviera el export dejaría el nombre sin definir y rompería a quien lo
 * importe.
 *
 * ►► Y la clave es PROPIA, no el `mute` del jugador. ◄◄
 *
 * `mute` es lo que el jugador eligió y el juego lo respeta entre sesiones.
 * Si el silencio de desarrollo lo escribiera, apagar la música para
 * trabajar dejaría mudo el juego para quien lo abra después — y al revés,
 * probar el juego con sonido borraría el silencio de trabajo sin aviso.
 * Con dos claves las dos cosas conviven y ninguna pisa a la otra.
 */

export const CLAVE = "devMute";

export function silencioDeDesarrollo() {
  return import.meta.env.DEV && leerAjuste(CLAVE, false) === true;
}
