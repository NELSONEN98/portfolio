/* Los cuatro peleadores.
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
      img.src = `${c.dir}/frame${String(i).padStart(4, "0")}.webp`;
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
