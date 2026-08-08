/* Publica el build sobre la carpeta que sirve el portfolio.
 *
 * No se puede apuntar outDir de Vite directo ahí: junto al juego viven
 * piskels/, md-guides/ y convex/, y un emptyOutDir se los llevaría puestos.
 * Así que se copia, borrando sólo lo que este script generó la vez pasada
 * — los bundles llevan hash en el nombre y sin limpiarlos se acumulan.
 */
import { cpSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
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

cpSync(dist, target, { recursive: true });

const fresh = readdirSync(target).filter(isBundle);
console.log(`Publicado en AnimalGambling/`);
if (stale.length) console.log(`  bundles viejos borrados: ${stale.join(", ")}`);
if (orphans) console.log(`  assets huérfanos borrados: ${orphans}`);
console.log(`  bundles actuales: ${fresh.join(", ")}`);
