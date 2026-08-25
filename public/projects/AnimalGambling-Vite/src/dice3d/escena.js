import * as THREE from "three";
import * as CANNON from "cannon-es";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DADO } from "../theme";

/* El dado de verdad: cubos con física que ruedan y chocan por toda la mesa.
 *
 * Va aparte de React a propósito. Three y Cannon son imperativos y con
 * estado propio —una escena, un mundo, un bucle de render— y meterlos en un
 * componente obligaría a re-crear todo eso en cada pintado. Acá el
 * componente sólo monta esto una vez y después le da órdenes.
 *
 * LA REGLA QUE ORDENA TODO EL ARCHIVO: la física NO decide el resultado.
 * El número lo decide el motor, y en online el servidor; si lo eligiera la
 * simulación, la maldición dejaría de limitar el dado a 5 y las dos
 * pantallas de una partida en red mostrarían tiradas distintas.
 *
 * Cómo se concilian las dos cosas: antes de tirar se prueban tiros a
 * puertas cerradas —simulados, sin dibujar— hasta encontrar uno que YA dé
 * el número pedido, y ése es el que se reproduce. Lo que se ve es una caída
 * real. Sólo si la búsqueda no llega a tiempo se acomoda el cubo al final.
 */

/* Qué normal del cubo corresponde a cada valor. Sale del orden en que se
   pegan las texturas más abajo. */
const NORMAL_DE = {
  1: new THREE.Vector3(1, 0, 0),
  6: new THREE.Vector3(-1, 0, 0),
  2: new THREE.Vector3(0, 1, 0),
  5: new THREE.Vector3(0, -1, 0),
  3: new THREE.Vector3(0, 0, 1),
  4: new THREE.Vector3(0, 0, -1),
};

const ARRIBA = new THREE.Vector3(0, 1, 0);

const LADO = 2.5;

/* Cuánto del mundo entra en el ALTO del lienzo, medido desde el centro. Es
   lo que decide el tamaño del dado en pantalla: cuanto menos abarca la
   cámara, más grande se ve el cubo. Se toca esto y no el lado del cubo
   porque el lado es física —altera el peso y los rebotes—, mientras que
   esto es puro encuadre.
 *
 * El ancho no está acá: sale del aspecto del lienzo, que es el de la mesa.
 * Al pasar el tablero a diez filas la mesa se volvió casi cuadrada y el
 * área perdió un cuarto de ancho — de ahí que con dos dados empezaran a
 * quedar uno sobre otro, y que la búsqueda de tiro tenga que descartar
 * esos casos.
 *
 * Un 25% más de encuadre = un 20% menos de dado en pantalla (6.13 → 7.66).
 * Se sube esto y no se baja LADO porque el lado del cubo es física: cambiarlo
 * altera la masa, los rebotes y la altura a la que un dado queda "montado"
 * sobre otro. El encuadre no toca nada de eso — y de yapa el área por donde
 * ruedan los cubos crece en la misma proporción, que es justo lo que hacía
 * falta al agrandar la mesa. */
const VISTA = 7.66;

/* ─── La bomba de humo ───────────────────────────────────────────────────
 * Tapa la aparición y la desaparición del segundo dado. Sin ella el cubo
 * se materializaba de la nada en el medio de la mesa, que es el único
 * momento de toda la escena donde algo pasa sin explicación física.
 *
 * Son sprites y no geometría: una bocanada es humo, no un objeto: no tiene
 * silueta que valga la pena modelar, y un puñado de planos que siempre
 * miran a la cámara da el volumen a un costo que ni se nota. */
const HUMO_BOCANADAS = 11;
const HUMO_VIDA_MS = 620;
/* Cuánto se abre la nube. En lados de cubo, para que siga al dado si algún
   día cambia de tamaño.
   Medido contra el encuadre: a 1.15 la nube ocupaba el 79% del alto visible
   y tapaba la mesa entera dos veces por cada carta de dos dados. A 0.8 queda
   en ~60% —sigue siendo una bomba, deja ver dónde está jugando—. Éste es el
   número a tocar si se quiere más o menos aparatosa. */
const HUMO_RADIO = LADO * 0.8;

/* Cuánto se meten las paredes respecto del borde visible, para que un cubo
   apoyado contra el muro no quede cortado por la mitad. */
const MARGEN = LADO * 0.55;

const QUIETO = 0.28;
/* Tope de seguridad: si por lo que sea los dados no frenan solos, se
   resuelve igual. Sin esto, un cubo apoyado en una arista podría dejar el
   turno colgado para siempre. */
const MAX_RODANDO_MS = 2600;
const CORRECCION_MS = 320;

/* Qué cara quedó mirando arriba. Es la misma lectura que haría cualquiera
   sobre un dado real; acá sirve para comprobar si un tiro simulado dio el
   número que hacía falta. */
function caraArriba(q) {
  let mejor = 1;
  let maxY = -Infinity;
  for (const valor of [1, 2, 3, 4, 5, 6]) {
    const y = NORMAL_DE[valor].clone().applyQuaternion(q).y;
    if (y > maxY) {
      maxY = y;
      mejor = valor;
    }
  }
  /* `plano` dice si el cubo quedó bien asentado o inclinado. Un dado
     apoyado contra una pared o montado en el borde de otro deja su cara de
     arriba a treinta grados: el número se lee a medias y se ve torcido.
     Leer sólo cuál es la cara no alcanza —eso da un valor igual— así que
     hay que mirar cuán vertical quedó. */
  return { valor: mejor, plano: maxY > 0.985 };
}

/* Un tiro: de dónde sale cada cubo y con qué impulso.
 *
 * `gesto` es opcional. Cuando el jugador tira con la mano lleva la
 * dirección y la fuerza de su movimiento, y los tiros que se prueban salen
 * de ahí con pequeñas variaciones: así el dado va para donde lo mandaste
 * aunque el número ya estuviera decidido. Sin gesto —o sea, con el botón—
 * el tiro es el de siempre: desde el fondo hacia el centro. */
function tiroAlAzar(cuantos, limites, gesto) {
  const { x: LX, z: LZ } = limites;

  return Array.from({ length: cuantos }, (_, i) => {
    const aparte = cuantos > 1 ? (i - (cuantos - 1) / 2) * LADO * 1.9 : 0;

    if (gesto) {
      const ruido = () => (Math.random() - 0.5) * 6;
      /* Los dos cubos salen del mismo punto —tu dedo— así que hay que
         abrirlos a mano: con la misma partida y casi la misma velocidad
         terminaban uno encima del otro. El signo reparte uno a cada lado y
         la velocidad los sigue separando en el aire. */
      const lado = cuantos > 1 ? (i === 0 ? -1 : 1) : 0;
      return {
        x: Math.max(-LX + 1, Math.min(LX - 1, gesto.x + lado * LADO * 1.5)),
        y: 6 + Math.random() * 2 + i * 1.2,
        z: Math.max(-LZ + 1, Math.min(LZ - 1, gesto.z + lado * LADO * 0.5)),
        rot: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2],
        vel: [gesto.vx + ruido() + lado * 5, -10 - Math.random() * 5, gesto.vz + ruido()],
        giro: [(Math.random() - 0.5) * 34, (Math.random() - 0.5) * 34, (Math.random() - 0.5) * 34],
      };
    }

    return {
      x: aparte,
      y: 8 + Math.random() * 2,
      z: -LZ * 0.55 + Math.random() * 1.5,
      rot: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2],
      vel: [(Math.random() - 0.5) * 11, -14 - Math.random() * 6, 6 + Math.random() * 6],
      giro: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30],
    };
  });
}

/* Corre un tiro entero sin dibujar nada y devuelve qué salió. */
function simularTiro(tiro, limites) {
  const { x: LX, z: LZ } = limites;
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -40, 0) });
  world.defaultContactMaterial.restitution = 0.32;
  world.defaultContactMaterial.friction = 0.28;

  const suelo = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  suelo.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(suelo);

  for (const [pos, rot] of [
    [[-LX, 0, 0], [0, Math.PI / 2, 0]],
    [[LX, 0, 0], [0, -Math.PI / 2, 0]],
    [[0, 0, -LZ], [0, 0, 0]],
    [[0, 0, LZ], [0, Math.PI, 0]],
  ]) {
    const pared = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    pared.position.set(...pos);
    pared.quaternion.setFromEuler(...rot);
    world.addBody(pared);
  }

  const forma = new CANNON.Box(new CANNON.Vec3(LADO / 2, LADO / 2, LADO / 2));
  const cuerpos = tiro.map((t) => {
    const b = new CANNON.Body({ mass: 5, shape: forma, angularDamping: 0.1 });
    b.position.set(t.x, t.y, t.z);
    b.quaternion.setFromEuler(...t.rot);
    b.velocity.set(...t.vel);
    b.angularVelocity.set(...t.giro);
    world.addBody(b);
    return b;
  });

  for (let i = 0; i < 240; i++) {
    world.step(1 / 60);
    const quietos = cuerpos.every(
      (b) => b.velocity.length() < QUIETO && b.angularVelocity.length() < QUIETO
    );
    if (quietos && i > 30) break;
  }

  return cuerpos.map((b) => ({
    ...caraArriba(new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)),
    /* Un cubo apoyado en el suelo tiene su centro a media altura. Bastante
       más arriba significa que quedó montado sobre el otro. */
    montado: b.position.y > LADO * 0.85,
  }));
}

/* Un tiro sirve si da los números pedidos, deja los cubos asentados y no
   deja ninguno encima de otro.
 *
 * Las dos condiciones de más nacieron de errores distintos. Sin `plano` se
 * colaban tiros que "acertaban" pero terminaban con el dado trepado al
 * borde de una pared, mostrando la cara de costado. Sin `montado`, al
 * angostarse la mesa los dos cubos empezaron a quedar uno sobre el otro:
 * el número era el correcto y el de abajo no se veía. */
function sirve(resultado, valores) {
  return resultado.every((r, i) => r.valor === valores[i] && r.plano && !r.montado);
}

/* Busca un tiro que dé exactamente los valores pedidos, con presupuesto de
   tiempo para no congelar la pantalla. Con un dado acierta casi siempre;
   con dos la probabilidad por intento baja a 1/36 y a veces se agota — ahí
   devuelve null y entra la corrección, que sigue estando por eso. */
function buscarTiro(valores, limites, gesto) {
  const presupuesto = valores.length > 1 ? 100 : 55;
  const hasta = performance.now() + presupuesto;
  let intentos = 0;
  while (performance.now() < hasta && intentos < 400) {
    intentos++;
    const tiro = tiroAlAzar(valores.length, limites, gesto);
    if (sirve(simularTiro(tiro, limites), valores)) return tiro;
  }
  return null;
}

/* La cara del dado, dibujada en un canvas. Se genera en vez de cargarse
   como imagen para que los puntos escalen sin pixelarse y para que el color
   salga de la paleta del juego en vez de estar horneado en un PNG. */
function texturaCara(numero, fondo, punto, puntoUno) {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d");

  g.fillStyle = fondo;
  g.fillRect(0, 0, S, S);

  const r = S * 0.082;
  const p = S * 0.28;
  const m = S * 0.5;
  const q = S - p;

  /* Las posiciones de los puntos de un dado real. El 6 va en dos columnas
     de tres, que es como se imprimen. */
  const puntos = {
    1: [[m, m]],
    2: [[p, p], [q, q]],
    3: [[p, p], [m, m], [q, q]],
    4: [[p, p], [q, p], [p, q], [q, q]],
    5: [[p, p], [q, p], [m, m], [p, q], [q, q]],
    6: [[p, p], [q, p], [p, m], [q, m], [p, q], [q, q]],
  }[numero];

  /* ►► El as no es un punto: es una X. ◄◄
   *
   * Y no es decoración. El 1 dejó de mover la ficha —te quema el turno y te
   * deja donde estabas— así que ya no es "el número más chico", es la única
   * cara que NO es un número: es una cruz, un cero, una tirada anulada. Un
   * punto rojo seguía diciendo "uno" y había que saberse la regla aparte;
   * una X dice lo que hace sin que nadie la explique.
   *
   * Por eso también es gruesa y grande. Este dado se mira rodando, chico y
   * en perspectiva, desde el otro lado de la mesa: un trazo fino se pierde
   * en el sombreado del cubo y a esa distancia una X flaca y un punto son
   * la misma mancha.
   *
   * La condición mira el NÚMERO y no la cantidad de puntos, aunque acá sean
   * lo mismo. Son dos cosas distintas que hoy coinciden: el uno lleva X
   * porque es el uno, no porque tenga un punto solo. Escrito sobre
   * `puntos.length === 1` diría lo otro, y sería una trampa para el día que
   * alguien dibuje una cara distinta.
   *
   * El respaldo a `punto` deja la firma vieja funcionando: quien llame sin
   * el cuarto argumento obtiene el dado de siempre, todo del mismo color. */
  const color = numero === 1 ? puntoUno ?? punto : punto;

  if (numero === 1) {
    /* Los dos trazos salen del centro hacia las esquinas. `b` es cuánto se
       alejan: más que el radio de un punto y bastante menos que media cara,
       para que la X respire dentro del marco en vez de tocar los bordes. */
    const b = S * 0.24;
    g.strokeStyle = color;
    /* Gruesa de verdad: casi el doble del diámetro de un punto normal. Es lo
       que la hace legible con el cubo girando. */
    g.lineWidth = S * 0.115;
    /* Las puntas redondeadas y la unión redonda son lo que evita que el
       cruce se vea como cuatro palitos sueltos: sin esto, en el centro
       quedan cuatro esquinas cuadradas pisándose y el trazo se ve sucio
       justo donde más grueso es. */
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(m - b, m - b);
    g.lineTo(m + b, m + b);
    g.moveTo(m + b, m - b);
    g.lineTo(m - b, m + b);
    g.stroke();
  } else {
    g.fillStyle = color;
    for (const [x, y] of puntos) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  /* ►► Declarar el espacio de color NO es opcional. ◄◄
   *
   * Un canvas 2D dibuja en sRGB. Sin este renglón, Three asume que los
   * valores ya vienen en lineal y se saltea la conversión: el 0.91 del hueso
   * entra como 0.91 cuando en lineal es 0.81. Todo el medio tono se levanta,
   * la diferencia entre la cara iluminada y la que está en sombra se
   * comprime, y el cubo queda plano y lechoso — exactamente lo que se ve
   * como "opaco". No era falta de luz: era el contraste aplastado antes de
   * que la luz llegara a hacer nada.
   *
   * Con la conversión en su lugar, el sombreado vuelve a repartirse como
   * corresponde y recién ahí los números de intensidad significan algo. */
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ►► `alGolpear` es un aviso, no un reproductor. ◄◄
 *
 * Esta escena sabe de Three y de cannon-es y de nada más. Importar acá el
 * reproductor de audio la ataría a la web y rompería lo único que la hace
 * portable — es la misma razón por la que `useGame` no toca el DOM.
 *
 * Así que la escena AVISA —"un cubo pegó, con esta fuerza"— y quien la creó
 * decide si eso suena, con qué archivo y a qué volumen. */
export function crearEscena(canvas, { alGolpear } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  /* ►► VSM y no PCFSoft. ◄◄
   *
   * PCFSoft suaviza tomando unas pocas muestras alrededor de cada punto del
   * mapa de sombra, así que su borde mide dos o tres téxels y nada más. Con
   * el mapa de 512 estirado sobre toda la mesa eso son unos milímetros: la
   * sombra del cubo salía con el canto casi duro, un cuadrado negro pegado
   * al fieltro.
   *
   * VSM (variance shadow map) desenfoca el mapa DE VERDAD, con un pase de
   * blur propio, así que `radius` se traduce en penumbra real. Una lámpara
   * colgada sobre una mesa no proyecta cantos: proyecta una mancha con el
   * borde deshecho, y cuanto más lejos está el objeto del piso, más deshecho.
   *
   * Cuesta un blur sobre una textura de 512², una vez por cuadro. Al lado de
   * lo que ya se paga por simular la física de los cubos, es nada. */
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();

  /* Ortográfica y no en perspectiva: los dados ruedan por toda la mesa, y
     con perspectiva los de los costados se verían inclinados hacia el
     centro como si se estuvieran cayendo. */
  const camera = new THREE.OrthographicCamera(-VISTA, VISTA, VISTA, -VISTA, 0.1, 100);
  camera.position.set(0, 20, 0.001);
  camera.lookAt(0, 0, 0);

  /* ►► La misma lámpara que pinta el CSS, pero para los cubos. ◄◄
   *
   * Si el paño tiene un charco de luz colgado desde arriba y los dados
   * siguen planos, el truco se cae: son el único objeto con volumen de la
   * pantalla, y son justo lo que uno mira. La luz tiene que ser una sola,
   * aunque la dibujen dos tecnologías distintas.
   *
   * La ambiental baja de 0.85 a 0.34. Ese número era el problema de fondo:
   * la ambiental ilumina todas las caras por igual, así que a 0.85 el cubo
   * llegaba casi saturado antes de que la direccional pudiera modelarlo. Con
   * 0.34 las caras que no miran a la lámpara quedan en sombra de verdad y el
   * dado se lee como un cuerpo y no como un recorte.
   *
   * La direccional sube y se centra: de (4, 12, 6) a (1.5, 18, 3.5). Casi a
   * plomo, apenas corrida para que el relieve de los puntos se note; justo
   * encima del todo, las caras superiores quedan sin gradiente. Y sube a 1.15
   * para compensar lo que perdió la ambiental.
   *
   * El tibio (0xfff2d8) es el mismo tono del charco de luz del CSS: una
   * lámpara de bar no es blanca. Un cubo blanco puro sobre un paño cálido
   * delata que son dos escenas pegadas.
   *
   * Sobre el costo de la sombra proyectada: dije que no valía la pena y me
   * equivoqué en la cuenta. El pase extra por cuadro sólo dibuja los objetos
   * que ARROJAN sombra —uno o dos cubos— en un mapa de 512², que es un
   * render de dos cajas contra una textura chica. Lo caro de las sombras es
   * una escena con decenas de mallas o mapas de 2048; nada de eso pasa acá. */
  /* ►► La luz se corre del eje de la cámara. ◄◄
   *
   * Estaba a 11.9° de la cámara, y ése era el problema real: mirando desde
   * arriba con la lámpara también arriba, TODO lo que se ve está de frente a
   * la luz. No hay gradiente, no hay lado oscuro, no hay nada que leer — un
   * cubo perfectamente iluminado y perfectamente plano.
   *
   * A 30° las caras laterales que asoman se apagan, los cantos redondeados
   * del cubo agarran una caída de luz, y la sombra proyectada cae a un
   * costado en vez de esconderse justo debajo. Esa sombra corrida es la
   * mitad del efecto: es lo que dice a qué altura está el objeto.
   *
   * La ambiental baja de 0.34 a 0.20. Cuanto más ambiental, más se parecen
   * entre sí todas las caras: es luz que llega por igual a las seis, o sea
   * exactamente lo contrario de lo que hace falta acá. Lo justo para que el
   * lado en sombra no se vaya a negro.
   *
   * Con la luz a 30°, la cara de arriba recibe 0.866 de la direccional:
   *   arriba  0.20 + 1.10 * 0.866 = 1.15  → blanca, apenas quemada a
   *                                          propósito para que sea EL punto
   *                                          más claro de toda la pantalla
   *   lado iluminado                 0.62
   *   lado en sombra                 0.20 */
  /* ►► Por qué la cara de arriba salía crema y no blanca. ◄◄
   *
   * No era falta de intensidad —ya llegaba a 1.22— sino el CANAL AZUL, que
   * venía frenado por dos cosas a la vez:
   *   · la textura de hueso (#e8e1cc) arranca con el azul en 0.80;
   *   · y la lámpara cálida (0xfff2d8) lo baja otro 15%.
   * Multiplicados daban 0.78 de azul contra 1.00 de rojo: eso ES crema. Se
   * podía subir la intensidad para siempre y el rojo iba a saturar mucho
   * antes de que el azul llegara a blanco — más luz sólo la habría vuelto
   * MÁS amarilla.
   *
   * Por eso la direccional pasa de 0xfff2d8 a 0xfffaf0, casi blanca. La
   * calidez de la mesa la sigue poniendo la ambiental, que baña todo; la
   * lámpara que pega de lleno en la cara de arriba es la que tiene que
   * llegar limpia. Así se ve una bombilla fuerte sobre marfil, no marfil
   * teñido de amarillo.
   *
   * Con 1.30 el azul llega a 0.97 y las tres componentes quedan juntas —
   * blanco de verdad— pero SIN saturar del todo: si se pasara, el bisel
   * redondeado del cubo también se iría a blanco puro y el dado perdería el
   * canto. Los laterales suben apenas (0.51 → 0.55), así que el contraste
   * entre la cara iluminada y las de costado se mantiene. */
  scene.add(new THREE.AmbientLight(0xfff2d8, 0.12));
  const luz = new THREE.DirectionalLight(0xfffaf0, 1.5);
  luz.position.set(6, 16, 7);
  luz.castShadow = true;
  /* Mapa chico a propósito: la sombra de un cubo es una mancha con borde
     suave, no un contorno que haya que resolver al píxel. A 512 el pase
     cuesta casi nada y el desenfoque del PCF tapa cualquier escalonado. */
  luz.shadow.mapSize.set(512, 512);
  /* Cuánto se deshace el borde. Es EL número de esta sombra: a 2 vuelve a
     ser un cuadrado con el canto marcado, a 20 se convierte en una nube que
     ya no dice dónde está el dado. */
  luz.shadow.radius = 9;
  luz.shadow.blurSamples = 16;
  /* El bias negativo se va con PCF. VSM no lo necesita —resuelve el moteado
     por varianza, no por corrimiento— y encima un bias negativo acá despega
     la sombra del objeto y la deja flotando un poco más allá del cubo, que
     es justo lo contrario de lo que hace falta. */
  luz.shadow.bias = 0;
  luz.shadow.normalBias = 0.02;
  scene.add(luz);

  /* El rebote del paño, ahora desde donde sirve.
     Estaba en (-3, -6, -2), o sea DEBAJO del suelo: sólo tocaba las caras
     que miran hacia abajo, que son justamente las que la cámara nunca ve.
     Era una luz que no iluminaba nada.
     Puesto enfrente de la lámpara y bajo, levanta apenas el lado que quedó
     en sombra — que es lo que hace un fieltro verde devolviendo luz. */
  const rebote = new THREE.DirectionalLight(0x8fb9a8, 0.26);
  rebote.position.set(-9, 3, -7);
  scene.add(rebote);

  /* ►► El suelo que recibe la sombra, y NADA más. ◄◄
   *
   * `ShadowMaterial` existe justo para este caso: es transparente salvo
   * donde le cae una sombra. Un plano con material normal taparía el fieltro
   * —el lienzo va en alfa por encima de la mesa— y volveríamos a tener un
   * rectángulo pegado sobre el paño, que es lo que este juego evitó desde el
   * principio.
   *
   * Apenas por debajo de cero (−0.01) para no pelearse en z con la cara
   * inferior de un cubo apoyado. */
  const sombras = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    /* De 0.42 a 0.26. Con el borde ya deshecho por VSM, la mancha ganó
       superficie: al mismo negro pesaba mucho más que antes y competía con
       las casillas, que son lo que hay que leer. Una sombra que se nota más
       que el tablero está mal aunque sea correcta. */
    new THREE.ShadowMaterial({ opacity: 0.26 })
  );
  sombras.rotation.x = -Math.PI / 2;
  sombras.position.y = -0.01;
  sombras.receiveShadow = true;
  scene.add(sombras);

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -40, 0) });
  world.defaultContactMaterial.restitution = 0.32;
  world.defaultContactMaterial.friction = 0.28;

  const suelo = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  suelo.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(suelo);

  /* Las paredes se guardan para poder moverlas: el corral tiene que
     coincidir con lo que se ve, y lo que se ve cambia con el lienzo. */
  const paredes = [
    [0, Math.PI / 2, 0],
    [0, -Math.PI / 2, 0],
    [0, 0, 0],
    [0, Math.PI, 0],
  ].map((rot) => {
    const p = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    p.quaternion.setFromEuler(...rot);
    world.addBody(p);
    return p;
  });

  const geometria = new RoundedBoxGeometry(LADO, LADO, LADO, 4, 0.35);
  const forma = new CANNON.Box(new CANNON.Vec3(LADO / 2, LADO / 2, LADO / 2));

  let dados = [];
  let limites = { x: VISTA - MARGEN, z: VISTA - MARGEN };
  let estado = "quieto"; // quieto | rodando | corrigiendo | arrastrando
  let desdeMs = 0;
  let objetivo = null;
  let alTerminar = null;
  let hayQueCorregir = false;
  let raf = 0;
  let vivo = true;

  /* Las bocanadas vivas. Mientras haya una, el bucle no se puede dormir. */
  let humo = [];
  let humoMs = 0;

  /* Una sola textura para todas: un degradado radial que se desvanece hasta
     transparente en el borde. Dibujarla en un canvas y no traerla como PNG
     evita un archivo más para algo que son ocho líneas, y de paso no hay
     nada que se cargue tarde.
     `colorSpace` va sí o sí: sin eso el humo sale apagado, el mismo error
     que tenían las caras del dado. */
  const texturaHumo = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.6)");
    grad.addColorStop(0.4, "rgba(226, 228, 235, 0.3)");
    grad.addColorStop(1, "rgba(200, 204, 215, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  /* El cubo que el jugador tiene agarrado, si hay alguno. */
  let agarrado = null;

  function materialesDe(fondo, punto, puntoUno) {
    /* El orden es el que espera el cubo: +X, −X, +Y, −Y, +Z, −Z. Puesto
       así, cada índice cae en la normal que NORMAL_DE da por sentada. */
    return [1, 6, 2, 5, 3, 4].map(
      /* ►► Lambert y no Basic. ◄◄
       *
       * `MeshBasicMaterial` IGNORA las luces por completo: pinta la textura
       * plana, sin importar cuántas lámparas haya en la escena. Los cubos se
       * veían recortados sobre la mesa y ninguna cara se distinguía de otra,
       * porque no había sombreado — no es que fuera flojo, es que no existía.
       * Las luces de esta escena eran código decorativo que no llegaba a
       * ningún lado.
       *
       * Lambert es el escalón mínimo que responde a la luz: difuso puro, sin
       * especular ni PBR. Para un dado de hueso mate es exactamente el
       * modelo correcto —no tiene que brillar— y es el más barato de los que
       * se iluminan. Standard daría reflejos que este dado no debería tener,
       * y costaría más por cada píxel. */
      (n) =>
        new THREE.MeshLambertMaterial({
          map: texturaCara(n, fondo, punto, puntoUno),
        })
    );
  }

  /* Una bocanada en un punto de la mesa. */
  function soltarHumo(x, y, z) {
    for (let i = 0; i < HUMO_BOCANADAS; i++) {
      const material = new THREE.SpriteMaterial({
        map: texturaHumo,
        transparent: true,
        /* No escribe en el buffer de profundidad: si lo hiciera, la bocanada
           de adelante recortaría a la de atrás y en vez de una nube se
           verían discos pegados. */
        depthWrite: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(x, y, z);
      scene.add(sprite);

      /* Cada una sale hacia un lado distinto, en semiesfera: hacia arriba y
         hacia los costados, nunca hacia abajo, que es donde está la mesa. */
      const ang = Math.random() * Math.PI * 2;
      const alto = 0.25 + Math.random() * 0.75;
      const radio = Math.sqrt(1 - alto * alto);
      humo.push({
        sprite,
        material,
        t: 0,
        /* Vidas distintas: si todas se apagaran juntas, la nube
           desaparecería de golpe como si le cortaran la luz. */
        vida: HUMO_VIDA_MS * (0.7 + Math.random() * 0.6),
        x, y, z,
        dx: Math.cos(ang) * radio * HUMO_RADIO * (0.5 + Math.random() * 0.9),
        dy: alto * HUMO_RADIO * (0.4 + Math.random() * 0.7),
        dz: Math.sin(ang) * radio * HUMO_RADIO * (0.5 + Math.random() * 0.9),
        s0: LADO * 0.3,
        s1: LADO * (0.75 + Math.random() * 0.5),
        op: 0.55 + Math.random() * 0.35,
        giro: (Math.random() - 0.5) * 1.6,
      });
    }
    arrancarBucle();
  }

  function actualizarHumo(dt) {
    for (let i = humo.length - 1; i >= 0; i--) {
      const p = humo[i];
      p.t += dt;
      const k = p.t / p.vida;

      if (k >= 1) {
        scene.remove(p.sprite);
        /* El material es de cada bocanada —lleva su propia opacidad— así que
           se tira una por una. La textura NO: es compartida y vive hasta que
           se destruye la escena. */
        p.material.dispose();
        humo.splice(i, 1);
        continue;
      }

      /* Se abre rápido y va frenando, como algo que se expande contra el
         aire en vez de viajar. */
      const e = 1 - Math.pow(1 - k, 2.2);
      p.sprite.position.set(p.x + p.dx * e, p.y + p.dy * e, p.z + p.dz * e);
      const escala = p.s0 + (p.s1 - p.s0) * e;
      p.sprite.scale.set(escala, escala, escala);
      /* Al cuadrado: se desvanece despacio al principio y se apaga rápido al
         final. Lineal deja un velo gris flotando que se nota. */
      p.material.opacity = p.op * (1 - k) * (1 - k);
      p.material.rotation = p.giro * e;
    }
  }

  function setCantidad(n) {
    if (dados.length === n) return;

    const previo = dados.length;

    /* Los que se van sueltan humo DONDE ESTÁN, no donde arrancaron: el
       segundo dado desaparece desde el rincón al que rodó, y la bocanada
       tiene que taparlo ahí. */
    for (let i = n; i < previo; i++) {
      const q = dados[i].mesh.position;
      soltarHumo(q.x, q.y, q.z);
    }

    for (const d of dados) {
      scene.remove(d.mesh);
      world.removeBody(d.body);
      d.mesh.material.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    }
    dados = [];

    for (let i = 0; i < n; i++) {
      /* Los colores salen de `DADO.cara`, que es el token del dado, y no de
         la paleta suelta. Estaban escritos a mano acá —`COLOR.hueso`— así
         que el token existía y nadie lo leía: cambiarlo en el tema no movía
         un píxel del cubo. */
      const mesh = new THREE.Mesh(
        geometria,
        materialesDe(DADO.cara.fondo, DADO.cara.punto, DADO.cara.puntoUno)
      );
      // Arroja sombra; no la recibe: un dado no se sombrea a sí mismo.
      mesh.castShadow = true;
      scene.add(mesh);

      /* La bocanada del que aparece, en el punto exacto donde se materializa
         y no un cuadro después: sin esto se lo ve aparecer y el humo llega
         tarde a taparlo. */
      const x = (i - (n - 1) / 2) * LADO * 1.6;
      if (i >= previo) soltarHumo(x, LADO * 0.5, 0);

      const body = new CANNON.Body({
        mass: 5,
        shape: forma,
        position: new CANNON.Vec3(x, LADO * 0.5, 0),
        sleepSpeedLimit: 0.4,
        angularDamping: 0.1,
      });
      world.addBody(body);

      /* ►► El golpe del dado sale de la FÍSICA, no de la tirada. ◄◄
       *
       * Un sonido único al lanzar sonaría una vez y dejaría en silencio los
       * tres o cuatro rebotes que vienen después — que es exactamente lo que
       * separa un dado de un "efecto de sonido". Acá cada contacto avisa por
       * su cuenta, con la fuerza con la que ocurrió.
       *
       * ►► Y esto es seguro sólo porque está DENTRO de `crearEscena`. ◄◄
       *
       * Este archivo tiene DOS mundos de física. `simularTiro` corre una
       * tirada entera sin dibujar nada, para encontrar un lanzamiento que dé
       * el número pedido — y puede correr varias seguidas. Es otro
       * `CANNON.World` con sus propios cuerpos, así que este oyente no lo
       * toca: si se colgara de los cuerpos de allá, cada tirada dispararía
       * cientos de golpes de golpe y antes de que se vea nada. */
      if (alGolpear) body.addEventListener("collide", (e) => avisarGolpe(body, e));

      dados.push({ mesh, body, corrigiendo: null, ultimoGolpe: 0 });
    }
    sincronizar();
    pintar();
  }

  /* ►► Un golpe no es un contacto. ◄◄
   *
   * cannon-es emite `collide` por cada par en contacto y en cada paso, así
   * que un cubo apoyado en el suelo dispara sesenta por segundo. Sin filtro
   * el dado sonaría como una lija.
   *
   * Dos condiciones, y las dos hacen falta:
   *
   *  · UMBRAL de velocidad. Descarta el roce y el apoyo: si el cubo no venía
   *    entrando de verdad contra la superficie, no hubo golpe.
   *  · ESPERA por cuerpo. Un mismo rebote genera varios contactos en pasos
   *    seguidos —los vértices del cubo tocan de a uno— y todos son el MISMO
   *    golpe. Sin esto, un rebote suena a tres.
   *
   * El volumen sale de la fuerza y el tono varía un poco: son rebotes del
   * mismo cubo, no cubos distintos, y sin variación se oye como el archivo
   * repetido en vez de como un dado. */
  const GOLPE_MINIMO = 1.6;
  const GOLPE_ESPERA_MS = 55;

  function avisarGolpe(body, e) {
    const dado = dados.find((d) => d.body === body);
    if (!dado) return;

    const fuerza = Math.abs(e.contact?.getImpactVelocityAlongNormal?.() ?? 0);
    if (fuerza < GOLPE_MINIMO) return;

    const ahora = performance.now();
    if (ahora - dado.ultimoGolpe < GOLPE_ESPERA_MS) return;
    dado.ultimoGolpe = ahora;

    /* Se normaliza contra una caída fuerte para que `alGolpear` reciba
       siempre algo entre 0 y 1 y no tenga que saber en qué unidades trabaja
       cannon-es. */
    alGolpear({
      fuerza: Math.min(1, fuerza / 14),
      tono: 0.92 + Math.random() * 0.18,
    });
  }

  function sincronizar() {
    for (const { mesh, body } of dados) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }

  function pintar() {
    renderer.render(scene, camera);
  }

  function lanzar(valores, cuandoTermine, gesto) {
    setCantidad(valores.length);
    objetivo = valores;
    alTerminar = cuandoTermine;
    estado = "rodando";
    desdeMs = performance.now();

    const encontrado = buscarTiro(valores, limites, gesto);
    hayQueCorregir = !encontrado;
    const tiro = encontrado ?? tiroAlAzar(valores.length, limites, gesto);

    dados.forEach(({ body }, i) => {
      const t = tiro[i];
      body.position.set(t.x, t.y, t.z);
      body.quaternion.setFromEuler(...t.rot);
      body.velocity.set(...t.vel);
      body.angularVelocity.set(...t.giro);
      body.wakeUp();
    });

    arrancarBucle();
  }

  function frenaron() {
    return dados.every(
      ({ body }) => body.velocity.length() < QUIETO && body.angularVelocity.length() < QUIETO
    );
  }

  function terminar() {
    estado = "quieto";
    const avisar = alTerminar;
    alTerminar = null;
    avisar?.();
  }

  /* Se calcula el giro MÍNIMO que lleva la cara pedida a mirar arriba, así
     el cubo no da una vuelta entera delante de los ojos: desde donde haya
     quedado, se acomoda lo justo. */
  function prepararCorreccion() {
    /* No alcanza con confiar en lo que prometía el tiro simulado: la
       reproducción puede terminar unos grados corrida, o el cubo puede
       haber quedado trepado al borde del otro. Se comprueba el estado real
       antes de dar por bueno el resultado — es más barato acomodarlo un
       poco que mostrar un número de costado. */
    const torcido = dados.some((d, i) => {
      const r = caraArriba(new THREE.Quaternion().copy(d.body.quaternion));
      return !r.plano || r.valor !== (objetivo?.[i] ?? r.valor);
    });

    if (!hayQueCorregir && !torcido) {
      terminar();
      return;
    }

    dados.forEach((d, i) => {
      const valor = objetivo?.[i] ?? 1;
      const normalMundo = NORMAL_DE[valor].clone().applyQuaternion(d.body.quaternion);
      const ajuste = new THREE.Quaternion().setFromUnitVectors(normalMundo, ARRIBA);
      const desde = new THREE.Quaternion().copy(d.body.quaternion);

      d.corrigiendo = { desde, hasta: ajuste.multiply(desde.clone()) };
      d.body.sleep();
    });
    estado = "corrigiendo";
    desdeMs = performance.now();
  }

  function arrancarBucle() {
    if (raf) return;
    humoMs = performance.now();
    const paso = () => {
      if (!vivo) return;

      /* El delta real y no un valor fijo por cuadro: en una pantalla de
         120Hz o con la pestaña volviendo de segundo plano, un paso fijo
         hace que la nube dure el doble o salte entera. */
      const ahora = performance.now();
      const dt = Math.min(64, ahora - humoMs);
      humoMs = ahora;
      if (humo.length) actualizarHumo(dt);

      if (estado === "rodando") {
        world.fixedStep();
        sincronizar();
        const t = performance.now() - desdeMs;
        if ((frenaron() && t > 500) || t > MAX_RODANDO_MS) prepararCorreccion();
      } else if (estado === "corrigiendo") {
        const t = Math.min(1, (performance.now() - desdeMs) / CORRECCION_MS);
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic: llega frenando
        for (const d of dados) {
          if (!d.corrigiendo) continue;
          d.mesh.quaternion.slerpQuaternions(d.corrigiendo.desde, d.corrigiendo.hasta, e);
          d.body.quaternion.copy(d.mesh.quaternion);
        }
        if (t >= 1) terminar();
      } else if (estado === "arrastrando") {
        world.fixedStep();
        sincronizar();
      }

      pintar();

      /* El bucle se apaga cuando no hay nada moviéndose. Dejarlo girando
         come batería durante todo el turno del rival.
         El humo cuenta como movimiento: los dados pueden estar quietos y la
         nube a medio disipar, y sin esta condición se congelaba en el aire
         hasta la próxima tirada. */
      if (estado === "quieto" && !humo.length) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }

  /* ─── agarrar el dado y tirarlo con la mano ──────────────────────────
     Convierte un punto de la pantalla en un punto de la mesa. Sin esto no
     hay forma de saber qué cubo tocó el dedo ni hacia dónde lo empujó. */
  function aMundo(clienteX, clienteY) {
    const r = canvas.getBoundingClientRect();
    const nx = ((clienteX - r.left) / r.width) * 2 - 1;
    const ny = ((clienteY - r.top) / r.height) * 2 - 1;
    return { x: nx * limites.x, z: ny * limites.z };
  }

  /* Devuelve true sólo si de verdad agarró un cubo. Es lo que le permite al
     componente distinguir "arrastró el dado" de "tocó el fieltro", y por
     eso el lienzo puede cubrir toda la mesa sin robarle los toques a las
     casillas. */
  function agarrar(clienteX, clienteY) {
    if (estado === "rodando" || estado === "corrigiendo") return false;
    const p = aMundo(clienteX, clienteY);

    let cerca = null;
    let menor = LADO * 1.5; // radio de agarre, algo mayor que el cubo
    for (const d of dados) {
      const dist = Math.hypot(d.body.position.x - p.x, d.body.position.z - p.z);
      if (dist < menor) {
        menor = dist;
        cerca = d;
      }
    }
    if (!cerca) return false;

    agarrado = { dado: cerca, x: p.x, z: p.z, t: performance.now(), vx: 0, vz: 0 };
    cerca.body.wakeUp();
    estado = "arrastrando";
    arrancarBucle();
    return true;
  }

  function arrastrar(clienteX, clienteY) {
    if (!agarrado) return;
    const p = aMundo(clienteX, clienteY);
    const ahora = performance.now();
    const dt = Math.max(16, ahora - agarrado.t) / 1000;

    /* La velocidad del gesto se guarda mientras se mueve: al soltar es lo
       único que queda para saber con cuánta fuerza lo tiró. */
    agarrado.vx = (p.x - agarrado.x) / dt;
    agarrado.vz = (p.z - agarrado.z) / dt;
    agarrado.x = p.x;
    agarrado.z = p.z;
    agarrado.t = ahora;

    const b = agarrado.dado.body;
    b.position.set(
      Math.max(-limites.x + 1, Math.min(limites.x - 1, p.x)),
      LADO * 1.1,
      Math.max(-limites.z + 1, Math.min(limites.z - 1, p.z))
    );
    b.velocity.setZero();
    b.angularVelocity.set(6, 4, 6);
  }

  /* Suelta y devuelve el impulso del tiro.
   *
   * SIEMPRE devuelve uno, por flojo que haya sido el gesto. Soltar el dado
   * y que se quede donde lo dejaste lo convierte en una ficha que se
   * arrastra por el tablero: aunque no cambie el resultado —el número ya lo
   * decidió el motor— deja creer que se puede acomodar a mano, y eso es
   * justo lo que un dado no permite.
   *
   * Si el gesto no traía fuerza se le da la mínima: en la dirección que
   * llevaba, o en una cualquiera si estaba parado. */
  function soltar() {
    if (!agarrado) return null;
    const g = agarrado;
    agarrado = null;
    estado = "quieto";

    const MINIMO = 10;
    const TOPE = 26;

    let vx = g.vx;
    let vz = g.vz;
    const fuerza = Math.hypot(vx, vz);

    if (fuerza < 0.5) {
      /* Ni siquiera se movió: un toque. Sale para cualquier lado, como
         cuando tirás un dado con dos dedos sin apuntar. */
      const angulo = Math.random() * Math.PI * 2;
      vx = Math.cos(angulo) * MINIMO;
      vz = Math.sin(angulo) * MINIMO;
    } else if (fuerza < MINIMO) {
      const k = MINIMO / fuerza;
      vx *= k;
      vz *= k;
    } else if (fuerza > TOPE) {
      /* Se recorta el manotazo: a esa velocidad la simulación se vuelve
         inestable y el cubo atraviesa la pared. */
      const k = TOPE / fuerza;
      vx *= k;
      vz *= k;
    }

    return { x: g.x, z: g.z, vx, vz };
  }

  function redimensionar() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);

    const aspecto = w / h;
    camera.left = -VISTA * aspecto;
    camera.right = VISTA * aspecto;
    camera.top = VISTA;
    camera.bottom = -VISTA;
    camera.updateProjectionMatrix();

    /* El corral sigue al encuadre: con las paredes fijas mientras el lienzo
       cambia, los dados rebotarían contra un muro invisible antes del borde
       o se irían de cuadro por el costado. */
    limites = { x: VISTA * aspecto - MARGEN, z: VISTA - MARGEN };

    /* La sombra sigue al encuadre igual que las paredes.
     *
     * La cámara de sombra es ORTOGRÁFICA y su recuadro no se ajusta solo:
     * dejándolo en el tamaño por defecto, en una mesa ancha los cubos que
     * ruedan hacia los costados salen del área mapeada y su sombra
     * desaparece de golpe a mitad de camino. Se estira al área visible más
     * un margen, para que un cubo pegado al muro proyecte igual.
     *
     * Y el plano que las recibe se agranda con lo mismo: es transparente
     * salvo donde cae la sombra, así que sobrarle no cuesta nada, pero
     * quedarse corto le corta la mancha en una línea recta. */
    const s = luz.shadow.camera;
    s.left = -VISTA * aspecto - LADO;
    s.right = VISTA * aspecto + LADO;
    s.top = VISTA + LADO;
    s.bottom = -VISTA - LADO;
    s.near = 1;
    s.far = 60;
    s.updateProjectionMatrix();

    sombras.scale.set(VISTA * aspecto * 2 + LADO * 2, VISTA * 2 + LADO * 2, 1);
    paredes[0].position.set(-limites.x, 0, 0);
    paredes[1].position.set(limites.x, 0, 0);
    paredes[2].position.set(0, 0, -limites.z);
    paredes[3].position.set(0, 0, limites.z);

    pintar();
  }

  function destruir() {
    vivo = false;
    if (raf) cancelAnimationFrame(raf);
    for (const d of dados) {
      d.mesh.material.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    }
    for (const p of humo) {
      scene.remove(p.sprite);
      p.material.dispose();
    }
    humo = [];
    texturaHumo.dispose();
    geometria.dispose();
    renderer.dispose();
  }

  return { setCantidad, lanzar, agarrar, arrastrar, soltar, redimensionar, destruir };
}
