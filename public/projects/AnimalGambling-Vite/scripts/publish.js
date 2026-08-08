/* Publica el build sobre la carpeta que sirve el portfolio.
 *
 * No se puede apuntar outDir de Vite directo ahí: junto al juego viven
 * piskels/, md-guides/ y convex/, y un emptyOutDir se los llevaría puestos.
 * Así que se copia, borrando sólo lo que este script generó la vez pasada
 * — los bundles llevan hash en el nombre y sin limpiarlos se acumulan.
 */
import { cpSync, readdirSync, rmSync, existsSync } from "node:fs";
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

cpSync(dist, target, { recursive: true });

const fresh = readdirSync(target).filter(isBundle);
console.log(`Publicado en AnimalGambling/`);
if (stale.length) console.log(`  bundles viejos borrados: ${stale.join(", ")}`);
console.log(`  bundles actuales: ${fresh.join(", ")}`);
