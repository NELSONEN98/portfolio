/* EL PUENTE WEB — el único archivo de theme/ que NO viaja a React Native.
 *
 * tokens.js y motion.js son datos puros: no saben que existe un DOM. Este
 * archivo es el que los traduce a custom properties para que el CSS los
 * pueda usar. Al portar a RN, este archivo se borra y los otros dos
 * quedan intactos. Esa es toda la idea de la separación.
 *
 * Qué se inyecta y qué no:
 *
 * DURACIONES sí. Son el punto donde CSS y JS tienen que coincidir o el
 * bug es invisible, así que valen la inyección.
 *
 * COLORES no. Van declarados en :root dentro de style.css. Si los pusiera
 * acá, entre que carga el CSS y corre el JS habría un frame sin paleta —
 * un destello blanco en un juego que es negro entero. Un color que llega
 * tarde se ve; una duración que llega tarde, no. Por eso el trato es
 * distinto para cada uno.
 *
 * Pero "declarados en dos lados" es exactamente el problema que este
 * directorio vino a resolver, así que abajo hay un guardián que compara
 * los dos y avisa en desarrollo si alguien cambia uno y se olvida del
 * otro.
 */
import { COLOR } from "./tokens";
import { entradas } from "./motion";

/* Escribe cada duración y cada curva del catálogo como variable CSS.
   `--dur-carta-lanzada-vuela: 520ms` y su `--ease-...` al lado. */
export function aplicarMotion(raiz = document.documentElement) {
  for (const a of entradas()) {
    if (typeof a.ms === "number") raiz.style.setProperty(`--dur-${a.clave}`, `${a.ms}ms`);
    if (a.ease) raiz.style.setProperty(`--ease-${a.clave}`, a.ease);
  }
}

/* Los nombres de :root que tienen que seguir a tokens.js. Sólo la paleta
   de marca: los tonos de fieltro y madera son textura de la mesa web y no
   van a sobrevivir el port tal cual, así que no vale la pena atarlos. */
const ESPEJO = {
  "--c-black": COLOR.negro,
  "--c-blue": COLOR.azul,
  "--c-green": COLOR.verde,
  "--c-bronze": COLOR.bronce,
  "--c-gold": COLOR.oro,
  "--c-red": COLOR.rojo,
  "--c-red-deep": COLOR.rojoProfundo,
  "--c-purple": COLOR.morado,
};

/* Corre sólo en desarrollo. Vite reemplaza import.meta.env.DEV por false
   al compilar y el bundler borra todo el bloque, así que esto no pesa un
   byte en producción.

   No rompe la app: avisa. Un color corrido es un problema de prolijidad,
   no una razón para dejar a alguien sin poder jugar. */
export function verificarPaleta(raiz = document.documentElement) {
  /* El `?.` no sobra: `import.meta.env` lo define Vite, y este archivo
     también se puede llegar a cargar desde un test corriendo en Node
     pelado, donde no existe. Sin él, el chequeo de paleta tiraría un
     TypeError y voltearía la suite por un aviso de prolijidad. */
  if (!import.meta.env?.DEV) return;

  const leidos = getComputedStyle(raiz);
  const desviados = Object.entries(ESPEJO)
    .map(([nombre, esperado]) => ({
      nombre,
      esperado: esperado.toLowerCase(),
      real: leidos.getPropertyValue(nombre).trim().toLowerCase(),
    }))
    .filter((c) => c.real && c.real !== c.esperado);

  if (desviados.length) {
    console.warn(
      "[theme] La paleta del CSS se separó de tokens.js. Al migrar a RN, " +
        "tokens.js es la que manda — corregí el que esté mal:",
      desviados
    );
  }
}

export function aplicarTema(raiz = document.documentElement) {
  aplicarMotion(raiz);
  verificarPaleta(raiz);
}
