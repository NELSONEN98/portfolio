/* TOKENS DE DISEÑO — lo que sí viaja a React Native.
 *
 * La regla que ordena todo este directorio: un color es un DATO, un
 * gradiente es un DIBUJO. El dato viaja tal cual — RN entiende "#c70000"
 * igual que el navegador. El dibujo hay que rehacerlo con otras
 * herramientas (expo-linear-gradient, react-native-svg) o directamente
 * exportarlo como imagen.
 *
 * Por eso acá vive el valor plano y nunca la declaración CSS. Nada de
 * `linear-gradient(...)`, nada de `box-shadow`, nada de `clamp()`. Todo
 * eso queda en style.css, que es el archivo que se tira a la basura el
 * día de la migración.
 */

/* ─── PALETA ──────────────────────────────────────────────────────────
   Los cuatro del medio son los fondos de cada gato en la selección: el
   color de un personaje y el de la interfaz salen del mismo lugar, y por
   eso la pantalla se ve de una sola pieza. */
export const COLOR = {
  negro: "#000000",
  azul: "#072475",
  verde: "#13563b",
  bronce: "#a46928",
  oro: "#e4a700",
  rojo: "#c70000",
  rojoProfundo: "#7b1414",
  /* Fuera de la paleta original: la maldición necesitaba un color propio
     que no se confundiera con el rojo del robo ni con el azul del bonus. */
  morado: "#5b2d8e",

  // Mesa de pool
  fieltro0: "#061a10",
  fieltro1: "#0a2e1f",
  fieltro2: "#0f4028",
  fieltro3: "#155233",
  fieltroBorde: "#3a1a0e",
  madera: "#2a120a",
  maderaClara: "#4a2414",

  // Texto y superficies
  tinta: "#05110a",
  hueso: "#e8e1cc",
  huesoTenue: "#a89e85",
  /* El marfil del dado, aparte del hueso de la interfaz.
     `hueso` es un crema de tipografía: su azul está en 0.80, y eso alcanza
     sobre fondo negro pero impide que la cara iluminada del dado llegue a
     blanco por más luz que se le eche —el rojo satura mucho antes que el
     azul y la cara se pone amarilla en vez de blanca—. Este marfil sube el
     azul a 0.92 y deja que la lámpara la lleve hasta el blanco.
     Va aparte y no reemplaza a `hueso` porque ese color es correcto en todo
     lo demás: acá el problema no es el tono sino el margen que deja. */
  marfil: "#f7f4ea",
  blanco: "#ffffff",

  // Acentos de cartel
  ambar: "#f5b942",
  ambarBrillo: "#ffd076",
  sangre: "#c7365f",
  sangreProfunda: "#8a1e3c",
  toxico: "#7ee06b",
  cian: "#6fd3d9",
};

/* Colores con nombre de función, no de tinta. El día que el robo deje de
   ser rojo se cambia acá y no en catorce lugares. */
export const SEMANTICA = {
  robo: COLOR.rojo,
  defensa: COLOR.verde,
  maldicion: COLOR.morado,
  doble: COLOR.oro,
  penitencia: COLOR.rojo,
  bonus: COLOR.azul,
  turnoActivo: COLOR.oro,
  turnoEspera: COLOR.hueso,
};

/* ─── TIPOGRAFÍA ──────────────────────────────────────────────────────
   Una sola familia para todo. Bungee es display: excelente en carteles
   cortos y en mayúsculas, ilegible en párrafos — que es exactamente lo
   que este juego necesita, porque no tiene párrafos salvo las reglas.

   `archivo` importa para RN: allá la fuente se registra por archivo, no
   por @font-face, y hay que saber cuál es. */
export const FUENTE = {
  display: {
    familia: "Bungee",
    fallback: "sans-serif",
    archivo: "Bungee-Regular.ttf",
    /* Bungee viene sólo en 400. Los "negritas" del diseño son tamaño y
       color, nunca font-weight: pedirle 700 hace que el navegador la
       engorde sintéticamente y se ve sucia. */
    pesos: [400],
    mayusculas: true,
  },
};

/* ─── CARTAS ──────────────────────────────────────────────────────────
   La forma de la carta es una sola en todo el juego; lo que cambia es el
   tamaño según dónde esté. Las cuatro medidas son las mismas proporciones
   a distinta escala, y por eso una carta se reconoce como carta esté en
   la mano, en el centro o sobre la mesa. */
export const CARTA = {
  /* 5:7, la proporción de un naipe de verdad. El alto se calcula, nunca
     se declara: declararlo por separado deja que se desincronicen. */
  proporcion: 1.4,
  radio: 0.14, // del ancho
  borde: { grosor: 2, color: COLOR.blanco },

  /* Cuánto se tapan entre sí en el abanico. Por encima de ~0.45 el número
     de la carta de atrás queda oculto y el abanico deja de ser legible. */
  solape: 0.42,
  /* Grados entre carta y carta. Suave a propósito: más abierto se veía
     como un abanico de casino y este es un juego de taberna. */
  giroPorCarta: 3,

  /* Cada tipo con su color y su texto. El texto no es decisión estética:
     sobre el oro, el blanco no tiene contraste suficiente para leerse. */
  tipos: {
    /* La única en negro. Su color semántico sigue siendo el rojo —así
       destella el peleador al recibirla— pero la carta en sí va en negro
       para que tenerla en la mano no se confunda con el momento de que te
       la tiren. */
    steal: { fondo: COLOR.negro, texto: COLOR.blanco },
    defense: { fondo: SEMANTICA.defensa, texto: COLOR.blanco },
    curse: { fondo: SEMANTICA.maldicion, texto: COLOR.blanco },
    double: { fondo: SEMANTICA.doble, texto: COLOR.negro },
  },
};

/* ─── TABLERO ─────────────────────────────────────────────────────────
   Las medidas del recorrido salen de convex/rules.js (BOARD_COLS, ROWS),
   porque son reglas de juego y no decoración. Acá va sólo cómo se ve. */
export const TABLERO = {
  casilla: {
    radio: 0.22,
    colores: {
      plain: "rgba(232, 225, 204, 0.10)",
      penalty: SEMANTICA.penitencia,
      bonus: SEMANTICA.bonus,
    },
  },
  /* La casilla 0 es de dónde salen las fichas: se marca como meta para
     que el recorrido tenga un principio visible. */
  meta: { claro: "#f2f2f2", oscuro: "#111111" },
  ficha: {
    colores: [SEMANTICA.robo, SEMANTICA.bonus],
    borde: COLOR.blanco,
  },
};

/* ─── DADO ────────────────────────────────────────────────────────────
   Un cubo real: seis caras en 3D. Ese `preserve-3d` es la parte que NO
   viaja — RN no tiene contexto 3D en views. Al portar, o se rehace con
   una librería 3D o se cambia por seis imágenes y una rotación plana. */
export const DADO = {
  /* ►► El uno va en rojo, y no es un capricho de diseño. ◄◄
   *
   * Es como se pintan los dados de verdad desde hace siglos: el as en rojo
   * y el resto en negro. Acá además hace un trabajo concreto — el uno es la
   * peor tirada del juego, la que te quema el turno, y con todos los puntos
   * del mismo color hay que CONTARLOS para saber qué salió. Un punto solo y
   * rojo se lee de un vistazo desde el otro lado de la mesa, que es la
   * distancia real a la que se mira este dado mientras rueda.
   *
   * Es el mismo rojo del robo y de la penitencia. Deliberado: en este juego
   * el rojo ya significa "algo te salió mal", y el uno es exactamente eso.
   *
   * Vive en el token y no adentro del canvas porque el canvas dibuja, no
   * decide. Cambiar el rojo del juego tiene que mover el dado también. */
  cara: {
    fondo: COLOR.marfil,
    punto: COLOR.negro,
    puntoUno: COLOR.rojo,
    radio: 0.16,
  },
  /* Grados de cada cara para dejarla mirando al frente. Esto sí viaja:
     son números, no CSS.
   *
   * Cada valor es la rotación INVERSA de donde está pegada esa cara en el
   * cubo. Las caras se colocan así en el CSS —cara: su transform—:
   *
   *     1: rotateY(0)      frente      ->  cubo [  0,   0]
   *     2: rotateY(90)     derecha     ->  cubo [  0, -90]
   *     3: rotateY(180)    atrás       ->  cubo [  0, 180]
   *     4: rotateY(-90)    izquierda   ->  cubo [  0,  90]
   *     5: rotateX(90)     arriba      ->  cubo [-90,   0]
   *     6: rotateX(-90)    abajo       ->  cubo [ 90,   0]
   *
   * Cuatro de las seis estaban mal y el dado mostraba una cara que no era
   * la que había salido: pedía 4 y enseñaba el 6, pedía 6 y enseñaba el 3.
   * Como el motor y el tablero usaban el valor de verdad, la ficha avanzaba
   * bien y parecía que el error estaba en el movimiento. */
  rotaciones: {
    1: [0, 0],
    2: [0, -90],
    3: [0, 180],
    4: [0, 90],
    5: [-90, 0],
    6: [90, 0],
  },
};

/* ─── BOTONES ─────────────────────────────────────────────────────────
   Tres variantes y ninguna más. La cantidad de variantes es una decisión
   de diseño, no una consecuencia: cada botón nuevo con estilo propio es
   una regla que alguien va a tener que adivinar después.

   `primario` es la acción que avanza el juego. `secundario` es la que lo
   frena (plantarse, volver). `fantasma` es utilitario y no compite por
   atención (reglas, cerrar). */
export const BOTON = {
  primario: { fondo: COLOR.oro, texto: COLOR.negro, borde: COLOR.negro },
  secundario: { fondo: COLOR.rojoProfundo, texto: COLOR.blanco, borde: COLOR.negro },
  fantasma: { fondo: "transparent", texto: COLOR.hueso, borde: COLOR.huesoTenue },
  /* Lo mínimo que puede medir algo que se toca con el dedo. No es
     estética: por debajo de 44px la gente falla el toque, y en este juego
     fallar el toque puede significar plantarse cuando querías tirar. */
  areaMinima: 44,
  radio: 8,
  deshabilitado: { opacidad: 0.4 },
};

/* ─── GESTOS ──────────────────────────────────────────────────────────
   Distancias en píxeles. Viajan a React Native tal cual: allá el gesto lo
   maneja PanResponder en vez de eventos de puntero, pero los umbrales —que
   son lo que define cuándo un movimiento cuenta como intención— siguen
   siendo los mismos números. */
export const GESTO = {
  /* A partir de acá el movimiento deja de ser un toque y pasa a ser un
     arrastre. Por debajo, el temblor normal de la mano al apoyar el dedo
     cancelaría el toque y jugar se volvería impredecible. */
  arrastreMinimo: 8,
  /* Cuánto hay que alejar la carta del abanico para que al soltarla se
     juegue. Corto de más se jugarían cartas sin querer; largo de más el
     gesto se siente pesado y la gente vuelve al toque. */
  lanzar: 64,
};

/* ─── ESPACIADO ───────────────────────────────────────────────────────
   Escala de 4. No hace falta más: con pasos arbitrarios cada pantalla
   termina con su propio ritmo y el conjunto se ve desprolijo. */
export const ESPACIO = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

/* ─── PROFUNDIDAD ─────────────────────────────────────────────────────
   Quién tapa a quién. Estos son los valores que HOY tiene el CSS, no una
   escala ideal: si acá pusiera números lindos y el CSS tuviera otros,
   este archivo mentiría, y un token que miente es peor que no tenerlo.

   Y lo que muestran es una escalera que se fue de las manos sola. Del
   999 para arriba los saltos ya no significan nada: son "que esté
   adelante de todo", pedido cuatro veces por cuatro elementos distintos
   sin mirar qué había. Es el síntoma clásico de z-index declarado donde
   hacía falta en vez de decidido de antemano.

   Al portar a React Native esto se simplifica solo: allá el orden de
   apilado lo da el orden de los hijos y no hay guerra de números. Lo que
   hay que llevarse no son los valores sino el ORDEN — y para eso están
   escritos de menor a mayor. */
export const CAPA = {
  ficha: 4,
  cartaMesa: 10,
  /* La línea del jugador —sus cartas y él— va por encima de la mesa: al
     arrastrar una carta hacia el tablero tiene que pasar por delante, como
     si la estuvieras apoyando sobre el fieltro. */
  lineaJugador: 40,
  particulas: 100,
  cartaAmpliada: 300,
  cartaVolando: 320, // .card-cast y .card-gained: tapan hasta la ampliación
  botonReglas: 400,
  modalReglas: 500,
  toast: 999,
  scanlines: 9999,
  tweaks: 10000,
  preloader: 10001, // lo primero que se ve, tapa incluso al panel de ajustes
};
