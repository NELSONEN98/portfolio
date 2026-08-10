import * as THREE from "three";
import * as CANNON from "cannon-es";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { COLOR } from "../theme";

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
 * esos casos. */
const VISTA = 6.13;

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
function texturaCara(numero, fondo, punto) {
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

  g.fillStyle = punto;
  for (const [x, y] of puntos) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export function crearEscena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();

  /* Ortográfica y no en perspectiva: los dados ruedan por toda la mesa, y
     con perspectiva los de los costados se verían inclinados hacia el
     centro como si se estuvieran cayendo. */
  const camera = new THREE.OrthographicCamera(-VISTA, VISTA, VISTA, -VISTA, 0.1, 100);
  camera.position.set(0, 20, 0.001);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const luz = new THREE.DirectionalLight(0xffffff, 0.9);
  luz.position.set(4, 12, 6);
  scene.add(luz);

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

  /* El cubo que el jugador tiene agarrado, si hay alguno. */
  let agarrado = null;

  function materialesDe(fondo, punto) {
    /* El orden es el que espera el cubo: +X, −X, +Y, −Y, +Z, −Z. Puesto
       así, cada índice cae en la normal que NORMAL_DE da por sentada. */
    return [1, 6, 2, 5, 3, 4].map(
      (n) => new THREE.MeshBasicMaterial({ map: texturaCara(n, fondo, punto) })
    );
  }

  function setCantidad(n) {
    if (dados.length === n) return;

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
      const mesh = new THREE.Mesh(geometria, materialesDe(COLOR.hueso, COLOR.negro));
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: 5,
        shape: forma,
        position: new CANNON.Vec3((i - (n - 1) / 2) * LADO * 1.6, LADO * 0.5, 0),
        sleepSpeedLimit: 0.4,
        angularDamping: 0.1,
      });
      world.addBody(body);
      dados.push({ mesh, body, corrigiendo: null });
    }
    sincronizar();
    pintar();
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
    const paso = () => {
      if (!vivo) return;

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
         come batería durante todo el turno del rival. */
      if (estado === "quieto") {
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
    geometria.dispose();
    renderer.dispose();
  }

  return { setCantidad, lanzar, agarrar, arrastrar, soltar, redimensionar, destruir };
}
