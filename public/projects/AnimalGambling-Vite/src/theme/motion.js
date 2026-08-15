/* CATÁLOGO DE ANIMACIONES — única fuente de verdad de los tiempos.
 *
 * Por qué existe este archivo:
 *
 * Una animación vive en dos lados a la vez. El CSS la dibuja, pero el JS
 * tiene que saber cuánto dura para encadenar lo que viene después: cuándo
 * la carta ya llegó, cuándo el dado terminó de girar, cuándo limpiar el
 * destello. Hasta ahora esos dos números estaban escritos por separado
 * — `dice-roll 0.7s` en el CSS y `DICE_ROLL_MS = 650` en el JS — y nada
 * impedía que se desincronizaran. Cuando eso pasa no explota nada: la
 * animación simplemente se corta a la mitad o deja un frame colgado, y
 * el bug es dificilísimo de encontrar.
 *
 * Acá el tiempo se declara UNA vez. El CSS lo recibe como custom property
 * (ver applyTheme.js) y el JS lo lee del mismo objeto.
 *
 * Por qué está pensado para React Native:
 *
 * De una animación, RN puede reusar el TIEMPO y la CURVA — que es lo que
 * `Animated.timing({ duration, easing })` pide. Lo que no puede reusar son
 * los @keyframes. Por eso cada entrada guarda `ms` y `ease` como datos
 * planos, y el nombre del keyframe queda aparte, marcado como lo que hay
 * que reescribir. Al portar, este archivo se lee igual; lo que cambia es
 * quién lo consume.
 *
 * `el` documenta a qué elemento pertenece cada animación. No lo usa el
 * código: está para poder responder "¿qué se mueve en esta pantalla?"
 * sin leer 2800 líneas de CSS.
 */

/* Las curvas tienen nombre por lo que hacen, no por sus números. `rebote`
   se pasa de largo y vuelve — sirve para algo que aterriza. `impulso`
   arranca lento y acelera — sirve para algo que se va. */
export const EASE = {
  lineal: "linear",
  salida: "ease-out",
  entrada: "ease-in",
  suave: "ease-in-out",
  rebote: "cubic-bezier(0.2, 0.9, 0.3, 1.4)",
  reboteCorto: "cubic-bezier(0.2, 0.9, 0.3, 1.2)",
  reboteLargo: "cubic-bezier(0.2, 0.9, 0.3, 1.35)",
  impulso: "cubic-bezier(0.5, 0, 0.8, 0.4)",
  impulsoCorto: "cubic-bezier(0.5, 0, 0.75, 0.4)",
  expansion: "cubic-bezier(0.2, 0.7, 0.3, 1)",
  material: "cubic-bezier(0.4, 0, 0.2, 1)",
  /* Los gatos no interpolan: saltan de un dibujo al otro. Es animación
     cuadro a cuadro, y suavizarla la arruinaría. */
  cuadro: "step-end",
};

/* Cada entrada: qué se mueve, cuánto dura, con qué curva, y con qué
   keyframes lo dibuja el CSS hoy. */
export const MOTION = {
  // ─── DADO ────────────────────────────────────────────────────────────
  dado: {
    /* El dado dejó de ser una animación y pasó a ser una simulación: los
       cubos ruedan con física (src/dice3d/escena.js) y no hay keyframes que
       ajustar. Estos tiempos siguen mandando igual, pero ahora los consume
       el bucle de render en vez del CSS. */
    tirada: {
      ms: 700,
      ease: EASE.material,
      el: "dice3d/escena.js · rodando",
      nota: "Referencia de cuánto dura un tiro típico. La física decide el momento exacto: se corrige en cuanto los cubos frenan, con tope en 2600ms por si alguno queda apoyado en una arista.",
    },
    /* No es una animación: es cuánto espera el JS antes de dar la tirada
       por terminada. Va 50ms por debajo del giro a propósito — si
       esperara lo mismo, el número aparecería después de que el dado ya
       frenó y se vería el cambio. */
    esperaTirada: { ms: 650, el: "Dice.jsx" },
    /* Lo mínimo que sigue girando una vez que ya se sabe el resultado. En
       online el dado arranca al apretar, sin esperar al servidor, así que
       la respuesta puede llegar con el giro casi cumplido: sin este piso,
       la cara aparecería de golpe y se leería como un salto en vez de como
       un dado frenando. */
    giroMinimo: { ms: 220, el: "Dice.jsx" },
    /* Cuánto tarda el cubo en acomodarse hasta la cara que ya decidió el
       motor, una vez que la física lo dejó quieto. Es el giro MÍNIMO desde
       donde haya caído, así que se lee como que termina de asentarse y no
       como una corrección. */
    correccion: { ms: 320, ease: EASE.salida, el: "dice3d/escena.js · corrigiendo" },
    dobles: {
      ms: 350,
      ease: EASE.salida,
      el: "dice3d/escena.js · setCantidad",
      nota: "Con la carta de doble aparece un segundo cubo en la mesa antes de tirar: verlo esperando es lo que anuncia que la carta está activa.",
    },
    quemado: {
      ms: 1400,
      ease: EASE.salida,
      keyframes: "warn-flash",
      el: ".alerta",
      nota: "El cartel grande del medio: TE QUEMASTE, MAZO LLENO, LA CASA INVITA. Largo a propósito, porque frena el turno. Lo consume también useAlerta para saber cuánto dejarlo en pantalla.",
    },
  },

  /* ─── LA APERTURA ────────────────────────────────────────────────────
     La partida no arranca de golpe: primero se dice a qué se juega, después
     se reparte, y recién al final aparece el dado. Cada paso explica el
     siguiente, y el orden es el de una mesa de verdad.
     Corre UNA vez por partida y no se puede saltar, así que la suma de
     estos tiempos es lo que el jugador espera antes de tocar nada: con dos
     jugadores son ~2.1s, con cuatro ~2.8s. */
  apertura: {
    /* El cartel de la meta, solo en pantalla antes de que se reparta. Es lo
       único que hay que saber para jugar, así que se dice primero y sin
       nada más compitiendo. */
    reglas: { ms: 900, el: ".pool-goal" },
    carta: {
      ms: 420,
      ease: EASE.salida,
      keyframes: "reparte",
      el: ".reparto .carta-repartida",
      nota: "Lo que tarda UNA carta en ir del mazo a su jugador.",
    },
    /* El retraso de una carta a la siguiente. Es lo que hace que se lea como
       un reparto y no como que todas aparecen de golpe. */
    escalon: { ms: 110, el: "Reparto.jsx" },
    /* El respiro entre la última carta y el dado. Corto: es una coma, no un
       punto — sin nada de pausa el humo del dado tapa la carta que todavía
       está llegando. */
    respiro: { ms: 260, el: "useApertura.js" },
  },

  // ─── CARTAS: EN LA MANO ──────────────────────────────────────────────
  cartaMano: {
    llega: {
      ms: 420,
      ease: EASE.reboteCorto,
      keyframes: "carta-llega",
      el: ".card.recien-llegada",
      nota: "La carta se acomoda en el abanico. Rebota: llegó, no apareció.",
    },
    lanzada: {
      ms: 260,
      ease: EASE.entrada,
      keyframes: "carta-lanzada",
      el: ".card.lanzada",
      nota: "Sale del abanico hacia arriba. Corta, porque lo que importa viene después (CardCast).",
    },
    /* Cuánto se mantiene el hueco en el abanico después de que la carta
       se fue. Sin esta pausa, las cartas de al lado se cierran de golpe y
       parece que la carta nunca existió. */
    mantenerHueco: { ms: 260, el: "Hand.jsx" },
    abrir: {
      ms: 520,
      ease: EASE.salida,
      el: "Hand.jsx",
      nota: "Cuánto queda la carta abierta en grande al dejarla apretada.",
    },
    preview: {
      ms: 160,
      ease: EASE.salida,
      keyframes: "preview-in",
      el: ".card-preview",
      nota: "La ampliación al mantener el dedo. Casi instantánea: responde al gesto.",
    },
  },

  // ─── CARTAS: LANZAMIENTO AL RIVAL (CardCast) ─────────────────────────
  /* La secuencia completa es lectura + vuelo. El JS suma las dos para
     saber cuándo avisar que terminó. */
  cartaLanzada: {
    sale: {
      ms: 450,
      ease: EASE.reboteLargo,
      keyframes: "carta-sale",
      el: ".card-cast.sale .card",
      nota: "Del mazo al centro, en grande.",
    },
    /* Cuánto queda quieta en el medio para que se lea qué carta es. Es el
       único momento en que el rival se entera de lo que le llega. */
    lectura: { ms: 850, el: "CardCast.jsx" },
    vuela: {
      ms: 520,
      ease: EASE.impulso,
      keyframes: "carta-vuela",
      el: ".card-cast.vuela .card",
      nota: "Del centro al rival. Acelera: es un golpe.",
    },
    /* La defensa no la frena: la parte. La carta se quiebra por el medio y
       las dos mitades se van para lados opuestos.
       Dura más que el vuelo a propósito: un ataque que no llega es la mejor
       noticia del turno para uno de los dos, y merece que se vea. */
    rotura: {
      ms: 560,
      ease: EASE.salida,
      keyframes: "rotura-izq / rotura-der",
      el: ".card-cast.bloqueada .mitad",
    },
    /* El sello aparece rebotando mientras la carta se rompe detrás, y se
       queda un momento antes de irse: es la palabra que explica por qué el
       ataque no hizo nada. */
    sello: {
      ms: 320,
      ease: EASE.rebote,
      keyframes: "sello-rebote",
      el: ".bloqueado-sello",
    },
    selloVida: { ms: 1150, el: "CardCast.jsx", nota: "Cuánto queda el sello en pantalla, rebote incluido." },
  },

  // ─── CARTAS: BONUS RECIBIDO (CardGained) ─────────────────────────────
  cartaGanada: {
    entra: {
      ms: 420,
      ease: EASE.reboteLargo,
      keyframes: "carta-ganada-entra",
      el: ".card-gained.entra .card, .card-gained-label",
    },
    lectura: { ms: 900, el: "CardGained.jsx", nota: "50ms más que en el lanzamiento: acá la carta es tuya y conviene mirarla." },
    viaja: {
      ms: 520,
      ease: EASE.impulsoCorto,
      keyframes: "carta-ganada-viaja",
      el: ".card-gained.viaja .card",
      nota: "Del centro al abanico propio.",
    },
  },

  // ─── CARTAS: SOBRE LA MESA ───────────────────────────────────────────
  cartaMesa: {
    cae: {
      ms: 300,
      ease: EASE.salida,
      keyframes: "card-drop",
      el: ".played-card",
    },
  },

  // ─── TABLERO ─────────────────────────────────────────────────────────
  tablero: {
    /* La ficha se desliza con `transition`, no con keyframes: el destino
       cambia en cada tirada y una animación fija no puede saber a dónde va.

       Esto mide UN paso —de una casilla a la vecina—, no el viaje entero.
       El recorrido se camina de a una casilla porque interpolando de punta
       a punta se movían `left` y `top` a la vez y la ficha cruzaba en
       diagonal por adentro del tablero en vez de doblar la esquina. Entre
       vecinas eso no puede pasar: comparten fila o columna.

       Curva lineal a propósito: con aceleración, cada casilla frenaría por
       su cuenta y el recorrido se vería a los tirones en vez de continuo.
       El viaje total lo calcula Board.jsx como pasos × esto. */
    pasoFicha: { ms: 125, ease: EASE.lineal, el: ".token (transition: left/top)" },
    /* Techo del recorrido completo. Sin él, una tirada de dos dados podía
       caminar doce casillas a 90ms cada una: más de un segundo mirando una
       ficha avanzar, por turno, varias veces por mano. Pasado el techo los
       pasos se acortan y la ficha va más rápido, que es exactamente lo que
       hace la mano de alguien moviendo una ficha lejos en un tablero real.
       Las tiradas cortas no lo alcanzan y conservan su ritmo. */
    viajeMaximo: { ms: 1100, el: "Board.jsx" },
    /* El destello de cada casilla que la ficha PISA al pasar, no sólo la
       del final. Deja una estela corta detrás del recorrido: sin ella, con
       el paso más lento la ficha parecía deslizarse por encima de un dibujo
       en vez de ir tocando casillas.
       Dura más que un paso a propósito —así hay siempre dos o tres
       encendidas— pero poco: si quedaran prendidas todo el trayecto, la
       estela taparía cuál es la casilla donde terminó. */
    /* El confeti de la meta. Corto: es un acuse de recibo de tres puntos,
       no una celebración de victoria — y ocurre cada vuelta, así que si
       durara se volvería ruido de fondo. */
    confeti: {
      ms: 900,
      ease: EASE.salida,
      keyframes: "confeti-vuela",
      el: ".confeti .papel",
    },
    pisada: { ms: 290, ease: EASE.salida, keyframes: "casilla-pisada", el: ".square.pisada" },
    aterriza: {
      ms: 420,
      ease: EASE.rebote,
      keyframes: "ficha-aterriza",
      el: ".token.aterriza",
      nota: "El rebote al frenar. Arranca cuando la ficha llegó, no cuando salió.",
    },
    casillaGolpe: {
      ms: 900,
      ease: EASE.salida,
      keyframes: "casilla-golpe",
      el: ".square.impacto",
      nota: "Sólo las casillas que hacen algo. Encender también las vacías volvería el aviso ruido de fondo.",
    },
    onda: {
      ms: 900,
      ease: EASE.expansion,
      keyframes: "onda",
      el: ".impacto-onda",
      nota: "El destello que sale de la casilla. Conecta dónde cayó la ficha con el número que se mueve.",
    },
    /* El respiro entre que los puntos del dado terminan de contar y la
       casilla dice lo suyo. No es una animación: es el silencio que separa
       dos hechos para que se lean como dos y no como uno. Sale por encima
       del tope del conteo (numero.conteoMax) para que el número ya haya
       frenado cuando aparece la carta o el castigo. */
    esperaCasilla: { ms: 520, el: "App.jsx · alLlegar" },
    penitenciaNumero: {
      ms: 1500,
      ease: EASE.salida,
      keyframes: "casilla-hit-float",
      el: ".casilla-hit",
      nota: "El −N que sale de la casilla roja. Dura lo mismo que el −N del marcador (numero.perdido) a propósito: son el mismo dato dicho en dos lugares, y con tiempos distintos parecerían dos cosas.",
    },
  },

  // ─── PELEADOR ────────────────────────────────────────────────────────
  peleador: {
    /* Los cuatro gatos parpadean a ritmos distintos para que no se vean
       sincronizados como un GIF. Dos a 500ms, dos a 560ms. */
    boilCat1: { ms: 500, ease: EASE.cuadro, keyframes: "cat1-boil", el: '.boil[data-cat="cat1"]', loop: true },
    boilCat2: { ms: 500, ease: EASE.cuadro, keyframes: "cat2-boil", el: '.boil[data-cat="cat2"]', loop: true },
    boilCat3: { ms: 560, ease: EASE.cuadro, keyframes: "cat3-boil", el: '.boil[data-cat="cat3"]', loop: true },
    boilCat4: { ms: 560, ease: EASE.cuadro, keyframes: "cat4-boil", el: '.boil[data-cat="cat4"]', loop: true },
    maldito: {
      ms: 2200,
      ease: EASE.suave,
      keyframes: "cursed-pulse",
      el: ".fighter.cursed .fighter-frame",
      loop: true,
      nota: "Late mientras dure la maldición. Lento: es un estado, no un evento.",
    },
    malditoPuntaje: {
      ms: 2200,
      ease: EASE.suave,
      keyframes: "cursed-score",
      el: ".fighter.cursed .f-score",
      loop: true,
    },
    ganador: {
      ms: 1200,
      keyframes: "winner-pulse",
      el: ".fighter.winner .fighter-frame",
      loop: true,
    },
    /* Los tres corren juntos y duran lo mismo: marco, fondo y número son
       un solo golpe visto en tres lugares. Si se desfasaran, se leería
       como tres cosas distintas. El COLOR lo pone la clase impacto-robo o
       impacto-maldicion; el tiempo es el mismo para las dos. */
    golpeMarco: { ms: 900, ease: EASE.salida, keyframes: "golpe-marco", el: ".fighter.impacto-* .fighter-frame" },
    golpeFondo: { ms: 900, ease: EASE.salida, keyframes: "golpe-fondo", el: ".fighter.impacto-* .fighter-art" },
    golpeNumero: { ms: 900, ease: EASE.salida, keyframes: "golpe-numero", el: ".fighter.impacto-* .f-score" },
  },

  // ─── NÚMEROS ─────────────────────────────────────────────────────────
  numero: {
    sube: { ms: 380, ease: EASE.salida, keyframes: "num-bump", el: ".bump" },
    baja: { ms: 380, ease: EASE.salida, keyframes: "num-drop", el: ".f-score.down" },
    perdido: {
      ms: 1500,
      ease: EASE.salida,
      keyframes: "hit-float",
      el: ".f-hit.show",
      nota: "El −N rojo que flota. Dura mucho más que el conteo porque es la explicación de por qué bajó.",
    },
    /* El conteo del número grande. No es CSS: lo hace useAnimatedNumber
       con requestAnimationFrame, porque el valor es dato, no estilo. La
       duración escala con la distancia — bajar 40 puntos tiene que verse
       más largo que bajar 5. */
    conteoBase: { ms: 140, el: "useAnimatedNumber.js" },
    conteoPorPunto: { ms: 28, el: "useAnimatedNumber.js" },
    conteoMax: { ms: 620, el: "useAnimatedNumber.js" },
  },

  // ─── PANTALLAS Y AMBIENTE ────────────────────────────────────────────
  pantalla: {
    salida: {
      ms: 450,
      ease: "ease",
      keyframes: "title-out",
      el: ".title-screen.leaving, .menu-screen.leaving",
    },
    tituloBoil: { ms: 750, ease: EASE.cuadro, keyframes: "boil", el: ".title-art", loop: true },
    menuBoil: { ms: 250, ease: EASE.cuadro, keyframes: "menu-boil", el: ".menu-art", loop: true },
    /* El mismo keyframe a dos velocidades: el cartel de fin de partida
       titila nervioso, el título de las reglas apenas respira. */
    flickerGameover: { ms: 3000, keyframes: "flicker", el: ".gameover-banner .big", loop: true },
    flickerReglas: { ms: 6000, keyframes: "flicker", el: ".rules-title", loop: true },
    particula: { ms: 3000, ease: EASE.lineal, keyframes: "particle-fall", el: ".particle" },
    /* Mínimo que se muestra el preloader aunque las imágenes ya estén.
       Si desaparece antes, el salto se lee como un parpadeo roto. */
    preloaderMinimo: { ms: 3100, el: "Preloader.jsx" },
  },

  ambiente: {
    humo: { ms: 18000, ease: EASE.lineal, keyframes: "drift", el: ".smoke-wisp", loop: true },
    /* Baja de 1100 a 820ms: dos alternancias por segundo en vez de una y
       pico. A 1100 el cartel parecía respirar; a 820 titila, que es lo que
       hace un cartel de casino. Más rápido que esto empieza a molestar
       encima de una mesa donde hay que leer números. */
    luces: { ms: 820, ease: EASE.cuadro, keyframes: "bulbs-on", el: ".pool-table::after", loop: true },
    fichaEntra: { ms: 400, ease: EASE.salida, keyframes: "chip-in", el: ".chip" },
  },

  // ─── BOTONES ─────────────────────────────────────────────────────────
  boton: {
    /* El resplandor mientras el botón está apretado. Va en bucle y no de
       una sola pasada: sirve para el toque corto y también para el dedo
       que se queda apoyado, que es lo que pasa cuando alguien duda antes
       de plantarse. */
    destello: {
      ms: 700,
      ease: EASE.suave,
      keyframes: "destello-tirar / destello-plantarse",
      el: ".btn-accion:active",
      loop: true,
      nota: "Cada botón destella de su propio color: dorado el del dado, blanco el de plantarse.",
    },
    /* El latido permanente del botón de tirar, mientras se pueda tirar.
       Tres veces más lento que el destello del toque a propósito: aquél es
       una respuesta a algo que hiciste y tiene que ser inmediato; éste es
       ambiente —el cartel de neón de la mesa— y a la velocidad del otro
       sería un parpadeo nervioso imposible de ignorar. */
    brillo: {
      ms: 2200,
      ease: EASE.suave,
      keyframes: "brillo-tirar",
      el: ".btn-accion.tirar:not(:disabled)",
      loop: true,
      nota: "Es lo que señala a dónde hay que ir cuando te toca. Se apaga solo al deshabilitarse el botón, que es cuando no es tu turno.",
    },
  },

  // ─── AVISOS ──────────────────────────────────────────────────────────
  toast: {
    entra: { ms: 280, ease: "ease", keyframes: "toast-in", el: ".toast" },
    sale: { ms: 250, ease: "ease", keyframes: "toast-out", el: ".toast.leaving" },
    vida: { ms: 3200, el: "useToasts.js", nota: "Cuánto queda leíble antes de irse solo." },
  },

  // ─── RED (no es animación, pero es tiempo y vive acá para no perderse) ─
  red: {
    sondeo: { ms: 2000, el: "useOnlineRoom.js", nota: "Cada cuánto se pregunta por el estado de la sala." },
    reintento: { ms: 5000, el: "useOnlineRoom.js" },
  },
};

/* Acceso corto para el JS: `ms("cartaLanzada.vuela")` en vez de cadenas
   de puntos que rompen si falta un nivel. Falla ruidosamente si la clave
   no existe — un tiempo indefinido produce `NaN` en un setTimeout y eso
   se traduce en "ejecutar ya", que es un bug silencioso e insufrible. */
export function ms(ruta) {
  const val = ruta.split(".").reduce((o, k) => o?.[k], MOTION);
  if (typeof val?.ms !== "number") {
    throw new Error(`motion: no existe la duración "${ruta}"`);
  }
  return val.ms;
}

/* Todas las entradas aplanadas, para generar las variables CSS y para
   poder auditar el catálogo sin recorrerlo a mano. */
export function entradas() {
  return Object.entries(MOTION).flatMap(([grupo, animaciones]) =>
    Object.entries(animaciones).map(([nombre, def]) => ({
      grupo,
      nombre,
      clave: `${grupo}-${nombre}`.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
      ...def,
    }))
  );
}
