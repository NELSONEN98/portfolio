/* Publica el build sobre la carpeta que sirve el portfolio.
 *
 * No se puede apuntar outDir de Vite directo ahí: junto al juego viven
 * piskels/, md-guides/ y convex/, y un emptyOutDir se los llevaría puestos.
 * Así que se copia, borrando sólo lo que este script generó la vez pasada
 * — los bundles llevan hash en el nombre y sin limpiarlos se acumulan.
 */
import { cpSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const target = join(here, "..", "..", "AnimalGambling");

if (!existsSync(dist)) {
  console.error("No hay dist/. Corré `npm run build` primero.");
  process.exit(1);
}

/* ►► Cualquier archivo con hash, no sólo los que se llaman `index-`. ◄◄
 *
 * Era `/^index-.*\.(js|css)$/`, y alcanzaba mientras el build escupía un
 * único archivo. Al partir el dado 3D en su propio trozo apareció
 * `escena-<hash>.js`, que ese patrón no reconocía: se copiaba pero no se
 * borraba nunca, así que cada publicación iba dejando el anterior de 617KB
 * al lado del nuevo, para siempre.
 *
 * Ahora el patrón es el de Vite —`<nombre>-<hash>.<ext>`— y además se
 * cruza contra lo que dist trae de verdad: se borra lo que parece un
 * trozo de build Y ya no está en la salida nueva. Con las dos condiciones,
 * un archivo suelto que alguien haya dejado a mano en la carpeta publicada
 * no se lo lleva puesto por parecerse a un bundle. */
const pareceBundle = (f) => /^[\w.]+-[A-Za-z0-9_-]{6,}\.(js|css)$/.test(f);
const enLaSalida = new Set(readdirSync(dist));

const stale = readdirSync(target).filter((f) => pareceBundle(f) && !enLaSalida.has(f));
for (const f of stale) rmSync(join(target, f));

/* Copiar encima no borra nada, así que un asset renombrado queda en las
 * dos versiones. Al pasar los frames de png a webp sobrevivieron los 44
 * png viejos, duplicando el peso publicado sin que nadie los pidiera.
 *
 * ►► Y la primera vez esto se arregló a medias: sólo miraba un nivel. ◄◄
 *
 * Había un `if (isDirectory()) continue` que salteaba las subcarpetas en
 * vez de entrar en ellas, así que limpiaba `cat1/cat1-damage.png` pero no
 * `cat1/damage1/frame0000.png`. Al convertir los 80 png a webp quedaron 55
 * sobrevivientes —todos en `catN/damageM/`— y el publicado PESÓ MÁS que
 * antes de optimizarlo: 9,8MB contra 8,9MB, con cada dibujo por duplicado.
 *
 * El barrido ahora baja por el árbol comparando carpeta contra carpeta. Y
 * borra la carpeta entera si dist ya no la trae: una carpeta renombrada
 * dejaba todo su contenido publicado para siempre.
 *
 * Sólo se sincronizan las carpetas que vienen de dist: al lado viven
 * piskels/ y md-guides/, que no se tocan. */
let orphans = 0;
function limpiarHuerfanos(enDist, enTarget) {
  const deDist = new Set(readdirSync(enDist));
  for (const f of readdirSync(enTarget)) {
    const p = join(enTarget, f);
    const esDir = statSync(p).isDirectory();

    if (!deDist.has(f)) {
      /* Lo que dist ya no trae se va, sea archivo o carpeta entera. */
      rmSync(p, { recursive: true, force: true });
      orphans++;
      continue;
    }
    /* Está en los dos lados: si es carpeta hay que seguir bajando, que es
       justo lo que antes no se hacía. */
    if (esDir) limpiarHuerfanos(join(enDist, f), p);
  }
}

for (const entry of readdirSync(dist, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const inTarget = join(target, entry.name);
  if (!existsSync(inTarget)) continue;
  limpiarHuerfanos(join(dist, entry.name), inTarget);
}

/* ►► Lo que NO se publica, aunque esté en public/. ◄◄
 *
 * Vite copia `public/` entero a `dist/` sin mirar el `.gitignore`, así que
 * todo lo que el artista deja al lado de sus exportados viaja al servidor.
 * Se venía limpiando a mano después de cada publicación —tres veces
 * seguidas— y eso es una tarea que alguien se va a olvidar de hacer.
 *
 * Lo que se filtra y por qué:
 *
 *  · `*~`            copias de seguridad del editor. Son el mismo dibujo de
 *                    al lado, con una tilde.
 *  · `*.kra` `.psd`  el archivo FUENTE del dibujo. Ningún navegador lo
 *      `.xcf`        abre; el que se usa es el PNG exportado. Uno solo son
 *                    427KB.
 *  · `*.zip`         paquetes de assets sin desempaquetar.
 *  · `local_cache`   el caché de modelos de una herramienta que no es el
 *                    juego. Se coló una vez y publicó 127MB.
 *  · vacías          carpetas sin nada adentro, que no sirven a nadie.
 *
 * Se filtra al COPIAR y no borrando después: lo segundo deja una ventana en
 * la que los archivos ya están en la carpeta publicada, y si alguien
 * commitea en el medio se van igual. */
const NO_PUBLICAR = [/~$/, /\.(kra|psd|xcf|zip)$/i];
const CARPETAS_NO_PUBLICAR = new Set(["local_cache"]);

let saltados = 0;
let saltadosBytes = 0;

function copiarFiltrando(desde, hacia) {
  for (const entry of readdirSync(desde, { withFileTypes: true })) {
    const origen = join(desde, entry.name);
    const destino = join(hacia, entry.name);

    if (entry.isDirectory()) {
      if (CARPETAS_NO_PUBLICAR.has(entry.name)) {
        saltados++;
        continue;
      }
      /* Una carpeta que después del filtro queda vacía no se crea: es lo que
         venía dejando las `New folder` sueltas en lo publicado. */
      mkdirSync(destino, { recursive: true });
      copiarFiltrando(origen, destino);
      if (readdirSync(destino).length === 0) rmSync(destino, { recursive: true });
      continue;
    }

    if (NO_PUBLICAR.some((re) => re.test(entry.name))) {
      saltados++;
      saltadosBytes += statSync(origen).size;
      continue;
    }
    cpSync(origen, destino);
  }
}

copiarFiltrando(dist, target);

const fresh = readdirSync(target).filter(pareceBundle);
console.log(`Publicado en AnimalGambling/`);
if (stale.length) console.log(`  bundles viejos borrados: ${stale.join(", ")}`);
if (orphans) console.log(`  assets huérfanos borrados: ${orphans}`);
if (saltados)
  console.log(
    `  no publicados: ${saltados} (fuentes de dibujo, backups, cachés)` +
      (saltadosBytes ? ` — ${Math.round(saltadosBytes / 1024)}KB` : "")
  );
console.log(`  bundles actuales: ${fresh.join(", ")}`);
