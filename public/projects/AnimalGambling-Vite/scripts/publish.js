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

const isBundle = (f) => /^index-.*\.(js|css)$/.test(f);

const stale = readdirSync(target).filter(isBundle);
for (const f of stale) rmSync(join(target, f));

/* Copiar encima no borra nada, así que un asset renombrado queda en las
 * dos versiones. Al pasar los frames de png a webp sobrevivieron los 44
 * png viejos, duplicando el peso publicado sin que nadie los pidiera.
 *
 * Sólo se sincronizan las carpetas que vienen de dist: al lado viven
 * piskels/ y md-guides/, que no se tocan. */
let orphans = 0;
for (const entry of readdirSync(dist, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const fromDist = new Set(readdirSync(join(dist, entry.name)));
  const inTarget = join(target, entry.name);
  if (!existsSync(inTarget)) continue;

  for (const f of readdirSync(inTarget)) {
    if (fromDist.has(f)) continue;
    const p = join(inTarget, f);
    if (statSync(p).isDirectory()) continue;
    rmSync(p);
    orphans++;
  }
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

const fresh = readdirSync(target).filter(isBundle);
console.log(`Publicado en AnimalGambling/`);
if (stale.length) console.log(`  bundles viejos borrados: ${stale.join(", ")}`);
if (orphans) console.log(`  assets huérfanos borrados: ${orphans}`);
if (saltados)
  console.log(
    `  no publicados: ${saltados} (fuentes de dibujo, backups, cachés)` +
      (saltadosBytes ? ` — ${Math.round(saltadosBytes / 1024)}KB` : "")
  );
console.log(`  bundles actuales: ${fresh.join(", ")}`);
