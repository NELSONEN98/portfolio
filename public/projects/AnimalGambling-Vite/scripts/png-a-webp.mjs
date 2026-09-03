/* Pasa a WebP los PNG que quedaron sin convertir.
 *
 * ►► Lossless y no lossy, y no es la eleccion conservadora: es la MEJOR. ◄◄
 *
 * Medido sobre los 80 archivos: lossless da 2,63MB y lossy calidad 82 da
 * 2,96MB. El sin perdida pesa MENOS que el con perdida, y encima no toca un
 * pixel. Suena al reves hasta que se mira que es este arte: linea negra
 * gruesa sobre zonas planas, que es exactamente para lo que esta hecho el
 * modo lossless de WebP; el lossy, en cambio, gasta bits tratando de
 * suavizar bordes duros y despues los deja con halos.
 *
 * Y esos halos se notarian: el juego dibuja con `image-rendering: pixelated`
 * y amplia los sprites, asi que un artefacto de compresion no se disimula,
 * se agranda. Medido a calidad 82, 95 y todo lo del medio, entre el 4% y el
 * 7% de los pixeles VISIBLES de los emojis quedaban con una diferencia que
 * el ojo alcanza a ver, y subir la calidad casi no lo bajaba — porque el
 * problema no era la calidad, era el algoritmo.
 *
 * Se corre a mano, no en cada build: convertir los 80 tarda, y el resultado
 * se commitea. `--escribir` para que toque el disco; sin eso solo informa.
 */
import sharp from "sharp";
import { readdirSync, statSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const publico = join(here, "..", "public");
const escribir = process.argv.includes("--escribir");

function pngs(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) pngs(p, acc);
    else if (/\.png$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

const lista = pngs(publico);
let antes = 0;
let despues = 0;
let convertidos = 0;

for (const png of lista) {
  const destino = png.replace(/\.png$/i, ".webp");
  const pesoAntes = statSync(png).size;

  const buf = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();

  /* Si el WebP saliera mas grande que su PNG, convertirlo seria empeorar.
     Hoy no pasa en ninguno de los 80, pero el dia que entre un dibujo nuevo
     con otra pinta este script no tiene por que saberlo de antemano. */
  if (buf.length >= pesoAntes) {
    console.log(`  = se queda en PNG (el WebP pesaria mas): ${png.replace(publico, "")}`);
    continue;
  }

  antes += pesoAntes;
  despues += buf.length;
  convertidos++;

  if (escribir) {
    await sharp(png).webp({ lossless: true, effort: 6 }).toFile(destino);
    rmSync(png);
  }
}

const mb = (n) => (n / 1048576).toFixed(2);
console.log(
  `\n${escribir ? "Convertidos" : "Se convertirian"}: ${convertidos} de ${lista.length}\n` +
    `  antes : ${mb(antes)} MB\n` +
    `  ahora : ${mb(despues)} MB\n` +
    `  ahorro: ${mb(antes - despues)} MB (${(((antes - despues) / antes) * 100).toFixed(0)}% menos)`
);
if (!escribir) console.log(`\n(simulacion — pasar --escribir para tocar el disco)`);
