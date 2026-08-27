import { reproducir } from "./player";
import { SONIDOS } from "./sonidos";

/* ►► DE UN HECHO DEL MOTOR A UN SONIDO. ◄◄
 *
 * El motor emite hechos con nombre —`quemado`, `penitencia`, `bonus`— y no
 * sabe que existe el audio, igual que no sabe que existen los carteles. Esta
 * tabla es la hermana de `MENSAJES` en App.jsx: la misma corriente de
 * hechos, traducida a otra cosa.
 *
 * ►► Por qué acá y no en un hook aparte. ◄◄
 *
 * Los hechos se consumen y se vacían —`consumeEvents`— así que sólo puede
 * haber UN consumidor. Un `useSonido` que también los leyera competiría con
 * el efecto que ya los traduce a carteles, y quien llegara segundo
 * encontraría la lista vacía. Un lector, dos traducciones.
 *
 * ►► Cómo se agrega un sonido. ◄◄
 *
 * Si el archivo se declara en `sonidos.js` con el MISMO nombre que el hecho,
 * se conecta solo y acá no hay que tocar nada: la búsqueda de abajo lo
 * encuentra. La tabla existe sólo para los casos que no coinciden, y
 * conviene que sean pocos — un nombre distinto entre el hecho y su sonido es
 * una traducción que alguien tiene que recordar.
 */

/* Los hechos cuyo sonido NO se llama igual que ellos. Vacía a propósito:
   mientras siga así, agregar un sonido es una línea en `sonidos.js`. */
const EXCEPCIONES = {
  /* La penitencia que rebotó en un escudo suena al escudo. Es la primera
     entrada de esta tabla y es exactamente para lo que existía: el hecho se
     llama `penitenciaBloqueada` porque eso es lo que pasó, y el sonido se
     llama `shield` porque un archivo de audio no se llama por el hecho que
     lo dispara sino por lo que suena. Renombrar cualquiera de los dos para
     que coincidieran habría empeorado el que se renombra. */
  penitenciaBloqueada: () => "shield",
};

/* Algunos hechos merecen sonar más fuerte que otros aunque compartan
   archivo. El volumen del catálogo sigue siendo el techo; esto ajusta
   dentro. */
const FUERZA = {
  quemado: 1,
  ganado: 1,
};

/* ►► Lo que suena cuando una carta aterriza sobre alguien. ◄◄
 *
 * Dos resultados y dos sonidos, y la diferencia es lo único que importa
 * contar: la carta entró, o el escudo la tapó. El jugador que recibe el
 * ataque tiene que poder distinguirlos SIN mirar — el sello de BLOQUEADO
 * aparece en el centro de la pantalla y el golpe tiñe al peleador en otra
 * punta, así que el oído llega antes que el ojo.
 *
 * ►► El respaldo a `punch` no es pereza. ◄◄
 *
 * El sonido se busca por el TIPO de carta, así que el día que existan
 * `steal.mp3` y `curse.mp3` se declaran en el catálogo con esos nombres y
 * toman el mando solos. Hasta entonces las tres usan el golpe genérico, que
 * es mejor que el silencio: un robo que aterriza y no suena se lee como que
 * no pasó nada, justo al revés de lo que pasó.
 */
export function sonarCarta(tipoDeCarta, bloqueada) {
  if (bloqueada) {
    reproducir("shield");
    return;
  }
  reproducir(SONIDOS[tipoDeCarta] ? tipoDeCarta : "punch");
}

export function sonarHecho(hecho) {
  const excepcion = EXCEPCIONES[hecho.tipo];
  const nombre = typeof excepcion === "function" ? excepcion(hecho) : excepcion ?? hecho.tipo;
  /* Se pregunta antes de disparar en vez de dejar que el reproductor lo
     descarte: así este archivo puede crecer con hechos que todavía no tienen
     sonido sin que ninguno haga ruido de más ni cueste una llamada. */
  if (!nombre || !SONIDOS[nombre]) return;
  reproducir(nombre, { volumen: FUERZA[hecho.tipo] ?? 0.85 });
}
