import { definicion, efectos } from "./sonidos";
import { leerAjuste, guardarAjuste } from "../storage";

/* ►► EL REPRODUCTOR. Es lo único de audio que NO viaja. ◄◄
 *
 * Todo lo demás del sistema —el catálogo y la tabla que mapea hechos del
 * motor a sonidos— es JavaScript puro y se va tal cual a React Native. Este
 * archivo se reescribe allá contra `expo-av`, y ningún otro se entera. Es el
 * mismo trato que tiene `useRouter` con la navegación.
 *
 * Por eso la superficie hacia afuera es mínima: `desbloquear`, `reproducir`,
 * `musica`, `silenciar`, `volumen`. Si un componente necesitara un
 * `AudioContext`, el trato se rompió.
 *
 * ►► Dos tecnologías, y no es sobre-ingeniería. ◄◄
 *
 * EFECTOS con Web Audio: se decodifican UNA vez a un AudioBuffer y a partir
 * de ahí cada disparo es un nodo nuevo sobre el mismo búfer — sin latencia,
 * sin basura, y superponiéndose sin límite. Un `new Audio(url).play()` por
 * disparo tiene retardo en la primera reproducción, deja elementos para que
 * el recolector barra, y en móvil CADA elemento necesita su propio
 * desbloqueo por gesto.
 *
 * MÚSICA con HTMLAudio: se transmite y se repite sin quedar decodificada en
 * memoria. Una pista de cuatro minutos como AudioBuffer son decenas de megas
 * de PCM; como <audio> son unos pocos megas en vuelo, y encima de a pedazos.
 *
 * ►► Y por eso el volumen se aplica en DOS lugares, no en uno. ◄◄
 *
 * Acá decía que las dos colgaban del mismo nodo de ganancia. No era cierto:
 * había un `gainMusica` creado y conectado al maestro al que nunca llegó
 * nada, porque el <audio> nunca pasó por el grafo — se controlaba, y se
 * sigue controlando, con su propio `.volume`. Un nodo que promete gobernar
 * algo que no gobierna es peor que no tenerlo, así que se fue.
 *
 * Meterlo de verdad al grafo sería `createMediaElementSource`, y eso cuesta
 * más de lo que da: el elemento queda atado al contexto —su audio deja de
 * salir por su cuenta— y en Safari es una fuente conocida de silencios. El
 * `.volume` del elemento hace exactamente el mismo trabajo.
 *
 * `aplicarNivel` es el que mantiene a los dos de acuerdo: toca el maestro
 * para los efectos y el `.volume` de la pista para la música.
 */

let ctx = null;
let maestro = null;
let gainSfx = null;

const buffers = new Map();
let precargaPedida = false;

/* La pista sonando, si hay alguna. Es UNA: dos músicas a la vez no es una
   mezcla, es ruido. */
let pistaActual = null;
let nombrePista = null;

let silenciado = leerAjuste("mute", false);
let nivel = leerAjuste("volumen", 0.8);

/* ►► Nada suena hasta que el jugador toque algo. ◄◄
 *
 * Los navegadores no dejan arrancar audio sin un gesto, y en iOS además el
 * `AudioContext` nace suspendido: hay que llamar a `resume()` DENTRO del
 * manejador del gesto o falla en silencio, que es la peor forma de fallar.
 *
 * Este proyecto tiene el lugar perfecto y ya construido: el botón de la
 * pantalla de título. Todos pasan por ahí antes de jugar, así que para
 * cuando hay un dado que suene el audio hace rato que está vivo. */
let desbloqueado = false;

function crearContexto() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  maestro = ctx.createGain();
  gainSfx = ctx.createGain();
  gainSfx.connect(maestro);
  maestro.connect(ctx.destination);
  aplicarNivel();
  return ctx;
}

/* ►► Cuánto más bajo que los efectos va la música. ◄◄
 *
 * Es fondo: compitiendo de igual a igual se come los golpes del dado, que
 * son cortos y agudos. Vive acá como constante y no repetido en cada cuenta
 * porque lo leen dos lugares —el arranque de la pista y cada cambio de
 * volumen— y un número escrito dos veces se separa en cuanto alguien toca
 * uno solo. */
const NIVEL_MUSICA = 0.55;

function aplicarNivel() {
  if (maestro) maestro.gain.value = silenciado ? 0 : nivel;
  if (pistaActual) pistaActual.volume = silenciado ? 0 : nivel * NIVEL_MUSICA;
}

/* Se llama desde un manejador de gesto y de ningún otro lado. Devuelve si el
   audio quedó vivo, para que quien llame pueda decidir si vale la pena
   mostrar un control de volumen. */
export async function desbloquear() {
  if (desbloqueado) return true;
  const c = crearContexto();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
  } catch {
    /* Un navegador que no deja reanudar acá no lo va a dejar después
       tampoco. Se sigue sin sonido en vez de romper la pantalla. */
    return false;
  }
  desbloqueado = c.state === "running";
  if (desbloqueado) precargar();
  return desbloqueado;
}

/* ►► La precarga arranca DESPUÉS del desbloqueo, no antes. ◄◄
 *
 * Bajar los efectos en el arranque le compite ancho de banda a los dibujos
 * de los gatos, que es lo primero que se ve. Y no hace falta: entre el botón
 * del título y el primer dado hay dos pantallas —elegir modo y elegir gato—
 * que son varios segundos, de sobra para unos kilobytes. */
async function precargar() {
  if (precargaPedida) return;
  precargaPedida = true;
  await Promise.all(
    efectos().map(async ([nombre, def]) => {
      if (buffers.has(nombre)) return;
      try {
        const r = await fetch(def.archivo);
        const bruto = await r.arrayBuffer();
        buffers.set(nombre, await ctx.decodeAudioData(bruto));
      } catch {
        /* Un archivo que no está no puede callar al resto del juego: queda
           sin búfer y ese sonido simplemente no suena. */
      }
    })
  );
}

/* ►► Disparar un efecto. ◄◄
 *
 * `volumen` multiplica al del catálogo, no lo reemplaza: el catálogo pone el
 * techo de esa voz en la mezcla y quien dispara ajusta dentro de él. Es lo
 * que le permite al dado sacar el volumen de la fuerza del golpe sin poder
 * pasarse por encima del resto de la mesa.
 */
export function reproducir(nombre, { volumen = 1, tono = 1 } = {}) {
  if (!desbloqueado || silenciado) return;
  const def = definicion(nombre);
  const buf = buffers.get(nombre);
  if (!def || !buf) return;

  const fuente = ctx.createBufferSource();
  fuente.buffer = buf;
  /* Variar el tono es lo que evita que diez golpes seguidos suenen a diez
     copias del mismo archivo. Con el dado importa mucho: son rebotes del
     mismo cubo, no diez dados distintos. */
  fuente.playbackRate.value = tono;

  const g = ctx.createGain();
  const pico = def.volumen * Math.max(0, Math.min(1, volumen));
  g.gain.value = pico;
  fuente.connect(g);
  g.connect(gainSfx);

  /* ►► El recorte: se corta al SONAR, no en el archivo. ◄◄
   *
   * `start(cuándo, desde, cuánto)` arranca el búfer en un punto y lo suelta
   * después de un tiempo. Sirve para dos cosas distintas y las dos importan:
   * saltarse el silencio que el codificador mete al principio de todo mp3
   * —unos 26ms que en un percusivo son latencia pura— y quedarse sólo con
   * la parte útil de una muestra larga.
   *
   * El tiempo va en SEGUNDOS y no en una fracción del archivo: una fracción
   * cambia de significado sola el día que alguien reemplace el mp3 por otro
   * de distinto largo, y el sonido pasaría a cortarse en otro lado sin que
   * nadie haya tocado nada. */
  const { desde = 0, dura } = def.recorte ?? {};

  /* ►► Y un desvanecido de 12ms al final, o el corte CHASQUEA. ◄◄
   *
   * Cortar una onda a mitad de ciclo deja un escalón vertical, y un escalón
   * es un click audible. No es sutil: en un sonido que se dispara siete
   * veces por tirada son siete clicks. Doce milisegundos no se perciben como
   * un fundido, pero alcanzan para que la onda llegue a cero.
   *
   * Sólo cuando hay recorte: si la muestra suena entera ya termina en
   * silencio por su cuenta y un fundido encima le comería la cola. */
  if (dura) {
    /* ►► `dura` está en tiempo del BÚFER, el desvanecido en tiempo REAL. ◄◄
     *
     * `start()` mide su tercer argumento sobre la muestra, no sobre el
     * reloj, así que el tono cambia cuánto tarda en sonar: a 1.10 los mismos
     * 0,2s de búfer duran 0,18s de verdad. Programando el fundido a 0,2s
     * reales, la fuente se cortaría sola cuando la ganancia todavía va por
     * el 93% — y eso es justo el click que el fundido venía a evitar.
     *
     * Dividir por el tono los pone de acuerdo. Se nota sólo en los golpes
     * agudos, que son la mitad de los rebotes del dado. */
    const real = dura / (tono || 1);
    const fin = ctx.currentTime + real;
    g.gain.setValueAtTime(pico, Math.max(ctx.currentTime, fin - 0.012));
    g.gain.linearRampToValueAtTime(0.0001, fin);
    fuente.start(0, desde, dura);
  } else {
    fuente.start(0, desde);
  }

  /* Se desconecta solo al terminar: sin esto la cadena de nodos crece con
     cada disparo y el grafo termina con miles de gains muertos colgando. */
  fuente.onended = () => {
    fuente.disconnect();
    g.disconnect();
  };
}

/* ►► La música: una sola, en bucle, y cambiarla no la corta de golpe. ◄◄
 *
 * Pedir la que ya está sonando es un no-op y no un reinicio: el mismo tema
 * se pide desde varias pantallas, y sin esto volvería al principio cada vez
 * que se navega. */
export function musica(nombre) {
  if (nombre === nombrePista) return;
  const def = nombre ? definicion(nombre) : null;

  if (pistaActual) {
    const vieja = pistaActual;
    /* Un corte seco se nota más que cualquier otra cosa del audio. */
    const baja = setInterval(() => {
      vieja.volume = Math.max(0, vieja.volume - 0.06);
      if (vieja.volume <= 0.01) {
        clearInterval(baja);
        vieja.pause();
        vieja.src = "";
      }
    }, 40);
    pistaActual = null;
    nombrePista = null;
  }

  if (!def || def.tipo !== "musica") return;
  const el = new Audio(def.archivo);
  el.loop = true;
  el.volume = silenciado ? 0 : nivel * NIVEL_MUSICA * (def.volumen ?? 1);
  el.play().catch(() => {
    /* Sin gesto todavía, o el archivo no está. Se ignora: el juego no
       depende de la música para funcionar. */
  });
  pistaActual = el;
  nombrePista = nombre;
}

export function silenciar(valor) {
  silenciado = valor ?? !silenciado;
  guardarAjuste("mute", silenciado);
  aplicarNivel();
  return silenciado;
}

export function volumen(v) {
  if (v === undefined) return nivel;
  nivel = Math.max(0, Math.min(1, v));
  guardarAjuste("volumen", nivel);
  aplicarNivel();
  return nivel;
}

export function estaSilenciado() {
  return silenciado;
}
