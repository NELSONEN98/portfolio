/* ►► EL CATÁLOGO DE SONIDOS. ◄◄
 *
 * Un solo lugar que declara qué suena, con qué archivo y a qué volumen.
 * Ningún componente escribe una ruta ni un número: piden un nombre.
 *
 * Es la misma forma que `motion.js`, y por la misma razón. Allá hay 69
 * duraciones en un archivo porque un tiempo escrito adentro del componente
 * es un tiempo que nadie encuentra el día que hay que ajustarlo. Con el
 * sonido pasa igual, y peor: el balance de volúmenes sólo se puede afinar
 * mirando todos los números juntos. Repartidos, cada `play()` suena bien
 * solo y la mesa entera suena a nada.
 *
 * ►► Los dos tipos NO son lo mismo por dentro. ◄◄
 *
 *  · `sfx`    — corto, se dispara muchas veces, se superpone consigo mismo.
 *               Se decodifica una vez a memoria y se dispara sin latencia.
 *  · `musica` — largo, uno solo a la vez, en bucle. Se transmite; meterlo
 *               decodificado en memoria son decenas de megas por pista.
 *
 * El reproductor los trata distinto, pero acá se declaran igual: quien
 * agrega un sonido no tiene por qué saber cuál de las dos tecnologías le
 * toca.
 */

/* Todo cuelga de `public/`, que Vite sirve en la raíz. Sin barra inicial:
   el juego se publica dentro de una subcarpeta del portfolio, y una ruta
   absoluta apuntaría a la raíz del dominio. */
const BASE = "sounds/";

export const SONIDOS = {
  /* ►► El dado no es un disparo, es una colisión. ◄◄
   *
   * `escena.js` es física de verdad —cannon-es, con piso y cuatro paredes—
   * así que el cubo rebota tres o cuatro veces antes de quedarse quieto. Un
   * sonido único al tirar sonaría una vez y dejaría los otros rebotes en
   * silencio, que es justo lo que separa un dado de un "efecto de sonido".
   *
   * Por eso `solapa: true` y un volumen bajo: se van a disparar varios muy
   * seguidos y encimados. El volumen real de cada golpe lo pone quien lo
   * dispara, a partir de la velocidad del impacto; esto es el techo. */
  /* ►► `recorte` corta el archivo AL SONAR, sin tocar el mp3. ◄◄
   *
   * El archivo dura 0,40s y la espera entre rebotes es de 55ms, así que en
   * una caída fuerte podía haber hasta SIETE copias encimadas: eso no suena
   * a dado, suena a barro. Cortado a la mitad bajan a tres y cada golpe se
   * distingue del siguiente.
   *
   * Se recorta acá y no en el archivo por dos motivos. El primero es que se
   * puede probar otro número y oírlo al recargar, sin reexportar nada — y
   * este número hay que afinarlo de oído, no se puede calcular. El segundo
   * es que los 16KB no le pesan a nadie: recortar el mp3 ahorraría 8KB y
   * costaría una herramienta y una vuelta de recodificación cada vez que se
   * quiera mover.
   *
   * `desde` no está de adorno: TODO mp3 arranca con unos 26ms de silencio
   * que le mete el codificador. En un sonido percusivo disparado por una
   * colisión eso es latencia pura — el golpe se ve antes de oírse. */
  dado: {
    archivo: BASE + "rolling-dice.mp3",
    volumen: 0.55,
    tipo: "sfx",
    solapa: true,
    recorte: { desde: 0.02, dura: 0.2 },
  },

  /* ►► El impacto de una carta que ENTRÓ. ◄◄
   *
   * Se llama igual que `CARD.PUNCH` a propósito: cuando lleguen los sonidos
   * del robo y de la maldición, se declaran con el nombre de su tipo de
   * carta y se conectan solos, sin tocar una línea de código. Mientras
   * tanto éste hace de golpe genérico para las tres — ver `sonarCarta`. */
  punch: { archivo: BASE + "punch.mp3", volumen: 0.85, tipo: "sfx", solapa: true },

  /* ►► Y el de la carta que NO entró. ◄◄
   *
   * No se llama `defense` sino `shield`, y es la única excepción de nombre
   * del catálogo. La razón: la defensa no es la carta que se juega —nunca se
   * juega, se gasta sola— así que este sonido no pertenece a una carta sino
   * a un RESULTADO: el ataque rebotó. Bautizarlo como la carta sugeriría que
   * suena al jugarla, que es lo único que esa carta no hace. */
  shield: { archivo: BASE + "shield.mp3", volumen: 0.8, tipo: "sfx", solapa: true },

  /* ►► El tema, y va en Opus por el BUCLE, no sólo por el peso. ◄◄
   *
   * El original es un WAV de 43MB —sin comprimir son 10MB por minuto, y
   * dura 4:17—; queda en `source-art/soundtrack/`, fuera de `public/`, así
   * que no viaja al juego publicado. Lo que sí viaja son 3,2MB de Opus a
   * 96kbps, un 92% menos.
   *
   * Y Opus antes que mp3 aunque el resto del catálogo sea mp3, porque acá
   * el archivo se repite para siempre. Medido sobre estas mismas
   * conversiones: el mp3 declara `start: 0.025057` —los 25ms de silencio
   * que el codificador le mete adelante, los mismos que el `desde` del dado
   * saltea— y en un bucle eso es un bache audible en cada vuelta. El Opus
   * declara `start: -0.007`, que es su pre-skip: el decodificador descarta
   * exactamente lo que el codificador agregó y el bucle cierra sin hueco.
   * De paso pesa menos que el mp3 a 128k (3,2MB contra 3,9MB).
   *
   * `volumen: 1` es el techo de la pista, no su volumen final: el
   * reproductor ya baja la música al 55% para que no se coma los golpes
   * del dado, que son cortos y agudos. */
  tema: { archivo: BASE + "gambling-katz-v3.webm", volumen: 1, tipo: "musica" },

  /* ►► La de la mesa, y por eso es OTRA pista y no la misma. ◄◄
   *
   * `tema` suena desde la puerta del sonido hasta que alguien elige gato:
   * es la música de estar mirando. Ésta arranca cuando empieza la partida,
   * que es cuando el juego pasa de mostrarse a jugarse — y el cambio de
   * pista es lo que marca ese salto sin que haya que decirlo con un cartel.
   *
   * El reproductor ya sabe hacer el relevo: `musica()` desvanece la que está
   * sonando antes de poner la nueva, así que pedirla es todo el trabajo.
   *
   * Mismo tratamiento que la otra —Opus a 96k, 4:37 en 3,5MB contra los
   * 46,6MB del wav— y por el mismo motivo del bucle: esta se repite durante
   * toda la partida, que es donde los 25ms de silencio del mp3 se
   * escucharían una y otra vez. */
  partida: { archivo: BASE + "gambling-katz-gameplay.webm", volumen: 1, tipo: "musica" },
};

/* ►► Lo que todavía no existe, dicho acá y no en un comentario suelto. ◄◄
 *
 * Van a llegar sonidos para casi cada carta y una segunda pista de música
 * —la primera ya está, `tema`—. Cuando lleguen, cada uno es UNA LÍNEA en
 * `SONIDOS` con su nombre, y el nombre lo consume `hechos.js` desde los
 * hechos que ya emite el motor. Nada más del proyecto se entera.
 *
 * Los nombres de los hechos ya están puestos y son estos —salen de
 * `useGame`, no hay que inventarlos—:
 *
 *   quemado · penitencia · bonus · bonusLleno · cartaPuesta · cartaRevelada
 *   cartasDevueltas · cartaRetirada · vuelta · cerveza · dosDados · salto
 *   mediaVuelta · ganado · plantado
 *
 * Un sonido que se llame igual que su hecho se conecta solo. Uno que no,
 * necesita una línea en la tabla de `useSonido`, y conviene que sean pocos.
 */

export function definicion(nombre) {
  return SONIDOS[nombre] ?? null;
}

/* Sólo los efectos se precargan. La música se transmite cuando toca sonar:
   precargarla sería bajar varios megas para una pista que quizá no se use
   en toda la sesión. */
export function efectos() {
  return Object.entries(SONIDOS).filter(([, d]) => d.tipo === "sfx");
}
