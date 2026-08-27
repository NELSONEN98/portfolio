/* Los cinco peleadores.
 *
 * Cada uno es un boil: `frames` dibujos hechos a mano en `dir` que el CSS
 * cicla, elegidos por `id` a través de .boil[data-cat="…"]. Sumar un gato
 * es esta entrada más sus dos reglas de CSS; ni la selección ni el versus
 * necesitan enterarse.
 *
 * ►► `damage` es una RUTA COMPLETA y no un patrón, a propósito. ◄◄
 *
 * Los cuatro archivos no se llaman igual: `cat1-damage.png` para el
 * primero y `damaged-catN.png` para los otros tres. Derivar la ruta de una
 * plantilla obligaría a renombrarlos —o peor, a escribir un caso especial
 * para el primero—, y este catálogo ya existe justamente para eso: es el
 * único lugar donde cada gato declara lo suyo, igual que `frames`, que
 * vale 9 para dos de ellos y 10 para los otros dos.
 *
 * Vive fuera de los componentes porque también lo usan el sondeo online
 * —para reconstruir al rival desde su catId— y la pantalla de final.
 */
export const ROSTER = [
  {
    id: "cat1",
    name: "Bonifacio",
    dir: "cat1",
    frames: 9,
    img: "cat1/frame0000.webp",
    damage: "cat1/cat1-damage.png",
    age: "7",
    cond: "Le debe plata a todos los gatos del barrio.",
    quote: "Te dije que tenía un sistema.",
    loseQuote: "Los dados están cargados. Lo sé.",
    tags: ["ANSIOSO", "SIN FILTRO"],
  },
  {
    id: "cat2",
    name: "Abilio",
    dir: "cat2",
    frames: 9,
    img: "cat2/frame0000.webp",
    damage: "cat2/damaged-cat2.png",
    age: "11",
    cond: "Dice que se retiró. Vuelve todas las noches.",
    quote: "Nunca dudé. Ni un segundo.",
    loseQuote: "Una más. Solo una más.",
    tags: ["VETERANO", "MENTIROSO"],
  },
  {
    id: "cat3",
    name: "Hermenegildo",
    dir: "cat3",
    frames: 10,
    img: "cat3/frame0000.webp",
    damage: "cat3/damaged-cat3.png",
    age: "5",
    cond: "Cree que esto es un juego. No entiende el dinero.",
    quote: "¡Esto es lo mejor que pasó en mi vida!",
    loseQuote: "Pero... ¿cuándo es mi turno de ganar?",
    tags: ["INGENUO", "PURO"],
  },
  {
    id: "cat4",
    name: "El Mago",
    dir: "cat4",
    frames: 10,
    img: "cat4/frame0000.webp",
    damage: "cat4/damaged-cat4.png",
    age: "??",
    cond: "Nadie sabe de dónde vino. Gana sin hablar.",
    quote: "...",
    loseQuote: "...",
    tags: ["MISTERIO", "SILENCIO"],
  },
  {
    id: "cat5",
    /* ►► Tres nombres y una cara de pocos amigos. ◄◄
     *
     * El personaje ES ese contraste: se llama como una campeona de concurso
     * y mira como si le hubieran servido el agua tibia. Los otros cuatro se
     * definen por lo que hacen en la mesa —el que debe plata, el que dice
     * que se retiró, el que no entiende, el que no habla—; ésta se define
     * por lo que cree que merece. */
    name: "Maisie Pixie Lou",
    dir: "cat5",
    /* Siete archivos, y eso es lo que hay que precargar. Ojo: son sólo TRES
       dibujos distintos —0000=0001=0002, 0003=0004=0005, y el 0006— así que
       el boil de abajo usa los tres únicos y no los siete. El número de acá
       es de la PRECARGA, que tiene que cubrir los archivos que existen. */
    frames: 7,
    /* ►► La única en `png`, y por eso la extensión se declara. ◄◄
     *
     * Los otros cuatro son `.webp` y la precarga la tenía escrita a mano en
     * la plantilla. Con esta gata pedía `cat5/frame0000.webp`, que no
     * existe: los siete dibujos se bajaban recién al entrar a elegir gato,
     * que es justo lo que la precarga viene a evitar.
     *
     * Se declara acá por el mismo motivo que `damage` es una ruta completa y
     * que `frames` vale 9 para dos gatos y 10 para otros dos: este catálogo
     * ES el lugar donde cada gato dice en qué se diferencia. */
    ext: "png",
    img: "cat5/frame0000.png",
    /* Y acá está el TERCER patrón de nombre de los cinco: `cat1-damage`,
       `damaged-catN` y ahora `damage-cat5`. Es exactamente lo que este
       campo venía diciendo desde el principio — por eso es una ruta
       completa y no una plantilla. Sumarla fue una línea, sin renombrar
       nada ni escribir un caso especial. */
    damage: "cat5/damage-cat5.png",
    age: "3",
    cond: "Tres nombres, ni un amigo. Juega como si le debieran algo.",
    quote: "Obviamente. ¿Esperaban otra cosa?",
    loseQuote: "Esta mesa está sucia. Todo esto está sucio.",
    tags: ["PEDIGRÍ", "MAL GENIO"],
  },
];

export function charFromCatId(catId) {
  return ROSTER.find((c) => c.id === catId) ?? null;
}

/* El boil cambia de dibujo cada 100ms; uno que todavía no se decodificó se
   pinta como un agujero. Se calientan en el evento load: el título ya está
   en pantalla y todavía faltan segundos hasta que el jugador entre. */
let calentados = false;
export function warmRosterFrames() {
  if (calentados) return;
  calentados = true;
  ROSTER.forEach((c) => {
    for (let i = 0; i < c.frames; i++) {
      const img = new Image();
      // Baja prioridad: son para dos pantallas más adelante.
      img.fetchPriority = "low";
      /* La extensión sale del catálogo y ya no está escrita acá: cuatro
         gatos son `.webp` y uno es `.png`, y con la plantilla fija la
         precarga de ése pedía archivos que no existen. */
      img.src = `${c.dir}/frame${String(i).padStart(4, "0")}.${c.ext ?? "webp"}`;
    }
    /* ►► La cara de daño se calienta acá o no se ve nunca. ◄◄
     *
     * Aparece durante 900ms y sin aviso: el golpe llega, se muestra y se va.
     * Sin precargar, el navegador recién PIDE el archivo cuando la clase se
     * enciende, y para cuando llega —son 80KB— la animación ya termino. El
     * primer golpe de cada partida no mostraría nada, y el segundo sí, que
     * es la clase de fallo que parece un fantasma.
     *
     * Va con los cuadros del boil y no aparte porque es exactamente el mismo
     * problema que resuelve este bucle, para el mismo gato. */
    if (c.damage) {
      const golpe = new Image();
      golpe.fetchPriority = "low";
      golpe.src = c.damage;
    }
  });
}
