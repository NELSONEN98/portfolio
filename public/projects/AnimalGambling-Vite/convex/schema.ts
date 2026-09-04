import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const card = v.object({
  uid: v.string(),
  type: v.string(),
  value: v.optional(v.number()),
});

/* Los campos del tablero y las cartas van optional: las salas creadas
   antes de esta versión no los tienen y el schema tiene que seguir
   validándolas. El código las trata como cero / mano vacía. */
const player = v.object({
  sessionId: v.string(),
  name: v.union(v.null(), v.string()),
  catId: v.union(v.null(), v.string()),
  score: v.number(),
  current: v.number(),

  // Casilla del camino donde está la ficha.
  pos: v.optional(v.number()),
  hand: v.optional(v.array(card)),
  /* Cartas jugadas boca abajo, en el orden en que se pusieron. Se revelan
     al plantarse y recién ahí se resuelven, que es lo que le da al rival
     la chance de responder. Se pueden acumular varias en un turno.
     pendingCard queda por las salas creadas con la versión de una sola. */
  pendingCard: v.optional(v.union(v.null(), card)),
  pendingCards: v.optional(v.array(card)),
  // Turnos que le quedan al rival con el dado limitado.
  curseTurns: v.optional(v.number()),
  // Turnos que le quedan con la mesa borrosa. Opcional como el resto: las
  // salas abiertas de antes no lo traen y tienen que seguir validando.
  beerTurns: v.optional(v.number()),
  // Cuántas cervezas encima: se apilan y multiplican la borrosidad.
  //
  // Este campo faltaba acá mientras el código ya lo escribía, y eso rompía
  // createRoom entero: Convex valida CADA escritura contra el schema y
  // rechaza el documento que trae un campo sin declarar. No lo agarra el
  // build ni un typecheck —no es un error de tipos, es una validación en
  // tiempo de ejecución— y sólo aparece al crear una sala de verdad.
  // Al sumar un campo al estado del jugador hay que tocar los DOS lugares.
  beerStacks: v.optional(v.number()),
  // Vale para la próxima tirada y se consume ahí mismo.
  doubleNext: v.optional(v.boolean()),
});

export default defineSchema({
  rooms: defineTable({
    roomId: v.string(),

    /* ►► La mesa, en orden de asiento. ◄◄
     *
     * Reemplaza a `player1` / `player2`, que eran dos campos separados y por
     * lo tanto una mesa de exactamente dos, escrita en el schema. Con un
     * array el tamaño de la mesa deja de ser una decisión de la base.
     *
     * El índice en este array ES el asiento: quién le pega a quién y a quién
     * le toca después salen de ahí (ver `targetOf` y `nextSeat` en rules.ts).
     * Por eso el ORDEN importa y no se puede reordenar por comodidad. */
    players: v.optional(v.array(player)),
    /* El asiento al que le toca. Número, no "player1": con cuatro sillas un
       nombre fijo no alcanza. */
    seat: v.optional(v.number()),

    /* ---- la forma vieja, de dos campos ----
     * Quedan declarados y en `optional` por una sola razón: las salas que ya
     * están en la base los tienen, y un schema que no las valide hace fallar
     * el deploy entero. No se escriben más — todas las mutaciones guardan
     * `players` — y las lecturas los aceptan como respaldo mientras vivan.
     * Las salas duran 30 minutos, así que media hora después del despliegue
     * estos tres se pueden borrar sin que nadie lo note. */
    player1: v.optional(player),
    player2: v.optional(player),
    turn: v.optional(v.string()),

    status: v.string(),
    /* Para cuántos se abrió la mesa. Se elige al crear la sala y decide
       cuándo arranca sola: en cuanto se sientan `size` jugadores.

       Optional y con respaldo en MIN_PLAYERS por las salas de antes, que no
       lo traen — y ese respaldo es exactamente el comportamiento viejo, una
       mesa de dos que arranca con el segundo. Así un cliente que todavía no
       sabe pedir el tamaño sigue creando y jugando duelos igual que ayer. */
    size: v.optional(v.number()),
    /* ►► Hacia dónde va la ronda: 1 a tu derecha, −1 a tu izquierda. ◄◄
       Lo da vuelta la carta de media vuelta. Optional porque las salas
       abiertas antes de esa carta no lo traen, y ahí `sentidoDe` lo lee
       como el de siempre. Es de la SALA y no del jugador: la dirección es
       una sola para toda la mesa. */
    sentido: v.optional(v.number()),
    /* Se sortea al crear la sala y viaja con ella: los dos jugadores tienen
       que ver las mismas casillas en los mismos lugares. Optional porque
       las salas anteriores al tablero no lo tienen. */
    board: v.optional(v.array(v.string())),
    /* La mano de arranque de la sala, sorteada una vez y copiada a todos.
       Viaja con la sala por la misma razón que `board`: es una tirada que
       tiene que salir igual para los que se sienten a esta mesa.

       Guardarla —en vez de copiarle la mano al primer asiento cuando entra
       alguien— es lo único que funciona con esta sala, que sigue aceptando
       gente DESPUÉS de arrancar: para el tercero que llega, la mano del
       asiento 0 ya no es la de arranque, tiene cartas jugadas y ganadas.
       Optional porque las salas abiertas antes de esto no la tienen; ahí se
       reparte suelto, como se hacía. */
    openingHand: v.optional(v.array(card)),
    /* Quién ganó, dicho por el backend. Deducirlo comparando puntajes del
       lado del cliente falla justo en el abandono, donde el que se queda
       puede tener menos.
       Ahora es el ASIENTO. La unión con string es para las salas viejas, que
       lo guardaron como "player1" / "player2"; se lee con `winnerSeat()`. */
    winner: v.optional(v.union(v.number(), v.string())),
    endedByAbandon: v.optional(v.boolean()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    // Para que el cron de limpieza no recorra la tabla entera.
    .index("by_expiresAt", ["expiresAt"]),

  /* ►► LO QUE DEJAN LOS QUE PROBARON EL JUEGO. ◄◄
   *
   * Es la única tabla que NO es de una partida. Todo lo demás acá vive
   * treinta minutos y se borra solo; esto se guarda para leerlo después, que
   * es justamente para lo que sirve.
   *
   * ►► Sólo la calificación es obligatoria. ◄◄
   *
   * Y no es una preferencia de estilo: es lo que decide cuánta gente
   * responde. Un formulario donde todo es obligatorio se abandona a la
   * mitad, y el que abandona no deja NADA — ni siquiera la estrella que ya
   * había tocado. Con un solo campo pedido, quien tiene diez segundos deja
   * un número y quien tiene ganas escribe tres párrafos, y las dos cosas
   * sirven.
   *
   * Por eso el nombre y el correo van optional aunque los pida el
   * formulario: pedirle el correo a alguien que sólo quería decir "estuvo
   * bueno" es cambiar una respuesta por un dato de contacto que además no
   * necesitamos.
   *
   * ►► El schema NO valida rangos ni largos. ◄◄
   *
   * Convex valida FORMA —que `rating` sea un número—, no contenido: acepta
   * un 47, un −3 y un comentario de diez megas sin chistar. Eso se controla
   * en la mutación que escriba acá, que todavía no existe. Dicho de otra
   * forma: esta tabla queda lista para guardar, pero hasta que haya una
   * mutación con sus topes no se guarda nada.
   */
  feedback: defineTable({
    /* Apodo. Optional Y capaz de ser null: optional cubre a quien no manda
       el campo, null a quien lo manda vacío. Sin la unión, un formulario
       que envía `name: null` en vez de omitirlo es rechazado en tiempo de
       ejecución — el mismo tipo de error que rompió `createRoom` con
       `beerStacks` y que no agarra ni el build ni un typecheck. */
    name: v.optional(v.union(v.null(), v.string())),
    /* Para responderle a quien quiera respuesta. Es un dato personal y es
       lo único de esta tabla que lo es: si algún día esto se muestra en
       algún lado, este campo se queda afuera. */
    email: v.optional(v.union(v.null(), v.string())),

    /* La calificación general, y el único campo pedido de verdad.
       Va como número —no como "bueno"/"malo"— para poder promediarlo. */
    rating: v.number(),

    /* Las tres preguntas abiertas, con el nombre de lo que preguntan y no
       `campo1`/`campo2`: dentro de seis meses, leyendo la base sin el
       formulario al lado, `gusto` se entiende y `campo1` no. */
    gusto: v.optional(v.union(v.null(), v.string())),
    mejoraria: v.optional(v.union(v.null(), v.string())),
    comentario: v.optional(v.union(v.null(), v.string())),
    /* Lo que se rompió, separado de `comentario` a propósito: un bug y una
       opinión se leen en momentos distintos y por gente distinta. Mezclados
       en un campo, para encontrar los reportes hay que leerlos todos. */
    bug: v.optional(v.union(v.null(), v.string())),

    /* ►► Si ganó o perdió, y es el campo que da sentido al resto. ◄◄
     *
     * Sin esto, un 2 de calificación es ilegible: no se sabe si dice "el
     * juego es malo" o "acabo de perder". Con esto se puede mirar la nota
     * media de los que ganaron contra la de los que perdieron, y recién ahí
     * se sabe si una nota baja habla del juego o del resultado. */
    gano: v.optional(v.union(v.null(), v.boolean())),
    /* Si volvería a jugar. Es la pregunta más barata que existe para un
       demo —una sola respuesta de sí o no— y la que mejor predice si esto
       le interesó a alguien de verdad: se puede puntuar bien algo que no se
       piensa volver a abrir. */
    volveria: v.optional(v.union(v.null(), v.boolean())),
    /* Cuánto duró la partida, en segundos. Una nota baja de alguien que
       jugó cuarenta minutos no dice lo mismo que la de alguien que se fue a
       los dos. */
    duracionSeg: v.optional(v.number()),

    /* ►► Contexto que el formulario no pregunta. ◄◄
     *
     * "Los controles se traban" es un reporte inservible sin saber en qué
     * mesa jugó y con qué versión. Preguntárselo al jugador sería sumar
     * campos a un formulario que ya tiene seis; el cliente lo sabe y lo
     * puede mandar solo.
     *
     * Optional los tres: un formulario que se abra desde fuera de una
     * partida no tiene ninguno de estos datos y tiene que poder enviar
     * igual. */
    sessionId: v.optional(v.string()),
    // De cuántos era la mesa donde jugó: 2, 3 o 4.
    mesa: v.optional(v.number()),
    // Qué versión del juego probó. Sin esto, un bug arreglado hace un mes
    // vuelve a leerse como un bug abierto.
    version: v.optional(v.string()),

    createdAt: v.number(),
  })
    /* Para leerlas de la más nueva a la más vieja sin recorrer la tabla
       entera. Es la única forma en que se van a leer. */
    .index("by_createdAt", ["createdAt"]),

  gameEvents: defineTable({
    roomId: v.string(),
    sessionId: v.string(),
    action: v.string(),
    payload: v.any(),
    timestamp: v.number(),
  }).index("by_roomId", ["roomId"]),
});
