/* Pasa un audio a lo que se publica: Opus en .webm.
 *
 *   node scripts/audio-a-web.mjs "C:/ruta/al/tema.wav" nombre-nuevo
 *
 * ►► Opus y no mp3, y el motivo es el BUCLE antes que el peso. ◄◄
 *
 * Medido sobre el primer soundtrack: el mp3 declara `start: 0.025057` —los
 * 25ms de silencio que el codificador le mete adelante, los mismos que el
 * `desde` del dado ya saltea— y en una pista que se repite para siempre eso
 * es un bache audible en cada vuelta. El Opus declara un `start` negativo,
 * su pre-skip: el decodificador descarta exactamente lo que el codificador
 * agregó y el bucle cierra sin hueco. De paso pesa menos que el mp3 a 128k
 * (3,2MB contra 3,9MB en aquella pista de 4:17).
 *
 * ►► Y por eso el nombre se pide, en vez de reusar el del wav. ◄◄
 *
 * Los bundles llevan hash y una versión nueva estrena URL sola; los
 * archivos de `public/` NO —Vite los copia tal cual—, así que pisar el
 * .webm con el mismo nombre deja a quien ya lo escuchó oyendo el viejo
 * desde su caché. Un nombre nuevo es una URL nueva, y es gratis.
 *
 * Después de correr esto quedan dos pasos a mano, y quedan a mano porque
 * los dos son decisiones:
 *   1. apuntar `tema` en `src/audio/sonidos.js` al archivo nuevo;
 *   2. borrar el .webm viejo de `public/sounds/` — `publish.js` lo saca
 *      solo de la carpeta publicada en el próximo `npm run publish:game`.
 */
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const destino = join(here, "..", "public", "sounds");

const [entrada, nombre] = process.argv.slice(2);
const BITRATE = process.env.BITRATE || "96k";

if (!entrada || !nombre) {
  console.error(
    'Faltan argumentos.\n' +
      '  node scripts/audio-a-web.mjs "<archivo de entrada>" <nombre-sin-extension>\n' +
      "  BITRATE=64k node scripts/... para una pista más liviana"
  );
  process.exit(1);
}
if (!existsSync(entrada)) {
  console.error(`No existe: ${entrada}`);
  process.exit(1);
}

const salida = join(destino, `${nombre}.webm`);
if (existsSync(salida)) {
  console.error(
    `Ya hay un ${nombre}.webm. Elegí otro nombre: pisarlo es justo lo que\n` +
      `deja a los navegadores sirviendo el viejo desde su caché.`
  );
  process.exit(1);
}

const antes = statSync(entrada).size;
const r = spawnSync(
  ffmpeg,
  ["-hide_banner", "-loglevel", "error", "-i", entrada, "-c:a", "libopus", "-b:a", BITRATE, "-vn", salida],
  { encoding: "utf8" }
);
if (r.status !== 0) {
  console.error(r.stderr || "ffmpeg falló");
  process.exit(1);
}

const despues = statSync(salida).size;
const mb = (n) => (n / 1048576).toFixed(2);
console.log(
  `${nombre}.webm listo (opus ${BITRATE})\n` +
    `  entrada: ${mb(antes)} MB\n` +
    `  salida : ${mb(despues)} MB  (${(((antes - despues) / antes) * 100).toFixed(0)}% menos)\n\n` +
    `Falta:\n` +
    `  1. en src/audio/sonidos.js, apuntar \`tema\` a "sounds/${nombre}.webm"\n` +
    `  2. borrar el .webm anterior de public/sounds/\n` +
    `  3. npm run publish:game`
);
