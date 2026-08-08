/* Convierte los frames a WebP y recomprime los que ya lo son.
 *
 * Lossless a propósito: son dibujos a mano con áreas planas y borde duro,
 * justo lo que el lossy ensucia con halos alrededor del contorno. WebP
 * lossless comprime mejor que PNG sin cambiar un pixel — se puede verificar
 * comparando los pixeles crudos, que es lo que hace este script antes de
 * quedarse con el resultado.
 */
import sharp from "sharp";
import { readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const DIRS = ["cat1", "cat2", "cat3", "cat4", "menu", "main-menu", "dices"];

const kb = (n) => (n / 1024).toFixed(0).padStart(5) + " KB";

/* Un archivo más chico no sirve de nada si el dibujo cambió.
 *
 * Donde el alpha es 0 se ignora el RGB: el PNG puede guardar cualquier
 * color debajo de un pixel invisible y WebP lo normaliza a cero. Comparar
 * esos bytes marcaba como distintos frames que se ven exactamente igual.
 * El alpha sí se compara siempre, en todos los píxeles. */
async function identical(a, b) {
  const [ra, rb] = await Promise.all([
    sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) return false;
  if (ra.data.length !== rb.data.length) return false;

  for (let i = 0; i < ra.data.length; i += 4) {
    if (ra.data[i + 3] !== rb.data[i + 3]) return false;
    if (ra.data[i + 3] === 0) continue;
    if (
      ra.data[i] !== rb.data[i] ||
      ra.data[i + 1] !== rb.data[i + 1] ||
      ra.data[i + 2] !== rb.data[i + 2]
    ) {
      return false;
    }
  }
  return true;
}

let before = 0;
let after = 0;
let converted = 0;
let kept = 0;

for (const dir of DIRS) {
  const full = join(pub, dir);
  let files;
  try {
    files = readdirSync(full);
  } catch {
    continue;
  }

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext !== ".png" && ext !== ".webp") continue;

    const src = join(full, file);
    const srcSize = statSync(src).size;
    const out = join(full, file.replace(/\.(png|webp)$/i, ".webp"));

    const buf = await sharp(src)
      .webp({ lossless: true, effort: 6 })
      .toBuffer();

    /* Recomprimir un webp que ya estaba bien puede dar más grande. */
    if (buf.length >= srcSize && ext === ".webp") {
      before += srcSize;
      after += srcSize;
      kept++;
      continue;
    }

    /* Se compara contra el buffer en memoria: sharp deja abierto el archivo
       que lee y en Windows eso impide borrar el temporal. */
    if (!(await identical(src, buf))) {
      console.error(`  DIFIERE, se deja como estaba: ${dir}/${file}`);
      before += srcSize;
      after += srcSize;
      kept++;
      continue;
    }

    writeFileSync(out, buf);
    if (ext === ".png") unlinkSync(src);

    before += srcSize;
    after += buf.length;
    converted++;
  }

  console.log(`${dir.padEnd(10)} listo`);
}

console.log("");
console.log(`antes:   ${kb(before)}`);
console.log(`después: ${kb(after)}`);
console.log(`ahorro:  ${kb(before - after)}  (${(((before - after) / before) * 100).toFixed(1)}%)`);
console.log(`${converted} convertidos, ${kept} sin tocar`);
