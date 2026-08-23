/* Dónde se sienta cada uno EN LA PANTALLA.
 *
 * Vive acá y no en las reglas porque al servidor no le importa: para él un
 * asiento es un índice en un array y nada más. Esto es la otra mitad —a qué
 * lugar del dibujo va ese índice— y es de la vista.
 *
 * ►► Reemplaza al `flip`. ◄◄
 *
 * El `flip` era una clase en la pantalla que intercambiaba las dos celdas
 * para que el jugador se viera siempre abajo. Funcionaba porque con dos
 * asientos "el otro" es uno solo y el intercambio es su propia inversa. Con
 * tres o cuatro eso deja de ser cierto: no hay un intercambio, hay una
 * ROTACIÓN, y una rotación no se escribe con un puñado de reglas de CSS que
 * se pisan entre sí — se escribe una vez, acá, y el CSS sólo dibuja celdas
 * numeradas sin saber quién cae en cada una.
 *
 * ►► El anillo: el turno sube por tu derecha. ◄◄
 *
 * Las celdas están numeradas por posición, no por asiento:
 *
 *     mesa de 2        mesa de 3          mesa de 4
 *    ┌─────────┐    ┌────┐ ┌────┐     ┌────┐ ┌────┐
 *    │    1    │    │  1 │ │  2 │     │  1 │ │  2 │
 *    └─────────┘    └────┘ └────┘     └────┘ └────┘
 *       mesa            mesa               mesa
 *    ┌─────────┐       ┌────┐         ┌────┐ ┌────┐
 *    │    2    │       │  3 │         │  3 │ │  4 │
 *    └─────────┘       └────┘         └────┘ └────┘
 *
 * Dos reglas, y entre las dos no dejan ninguna libertad:
 *
 *  1. Tu asiento cae SIEMPRE en la última celda — abajo, y con cuatro abajo
 *     a la derecha. Que estés siempre en el mismo rincón vale más que
 *     cualquier otra cosa: pasar de una mesa a otra no debería obligarte a
 *     buscarte.
 *  2. El turno sale de vos SUBIENDO POR TU DERECHA, cruza el techo hacia la
 *     izquierda, baja por el otro costado y vuelve a entrarte por la fila de
 *     abajo. Con cuatro: vos → arriba-der → arriba-izq → abajo-izq → vos.
 *
 * ►► Por qué ese sentido y no el contrario. ◄◄
 *
 * Porque es el que hace verdadero lo que las reglas ya decían. `targetOf`
 * viene diciendo desde siempre que le pegás "al de tu derecha", y eso sólo
 * se sostiene si la ronda gira hacia tu derecha. Sentado abajo a la derecha
 * y mirando hacia la mesa, tu derecha apunta hacia ARRIBA por el borde
 * derecho — no hacia el costado, porque de ese lado ya no hay mesa, hay
 * borde de pantalla.
 *
 * En pantalla eso se ve como un giro antihorario, y ahí está la trampa que
 * costó dos intentos: "antihorario" suena a izquierda, pero desde el asiento
 * de abajo es exactamente lo contrario. Las agujas de un reloj, vistas desde
 * las seis, se alejan hacia la izquierda.
 *
 * ►► Lo que este orden regala. ◄◄
 *
 * Cada salto es entre celdas PEGADAS: ni una diagonal en toda la vuelta. Y
 * por lo tanto tu víctima queda justo encima tuyo y tu atacante justo a tu
 * izquierda, los dos tocándote. La dirección del ataque se lee de la
 * disposición sin tener que dibujar nada; la mira roja sólo lo confirma.
 *
 * ►► Y cuando llegue la carta que da vuelta el juego. ◄◄
 *
 * Invertir el sentido toca DOS funciones y ninguna más: `nextSeat` en las
 * reglas —de donde sale también `targetOf`— y este anillo, que hay que
 * recorrer al revés. Nada más del proyecto sabe hacia dónde gira la mesa, y
 * conviene que siga siendo así.
 */

/* Qué celda le toca a cada distancia desde tu asiento. El índice es la distancia desde tu asiento: 0 sos vos, 1 el que juega
   después, y así. El valor es la celda, base cero.

   Leída en orden, cada fila de estas ES el recorrido visible de la ronda:
   con cuatro, de tu celda (3, abajo-der) a la 1 (arriba-der), de ahí a la 0
   (arriba-izq), a la 2 (abajo-izq), y de vuelta a vos. */
const ANILLO = {
  2: [1, 0],
  3: [2, 1, 0],
  4: [3, 1, 0, 2],
};

/* Cuántas celdas tiene la fila de arriba en cada mesa. Lo usa el vuelo de
   las cartas para saber si la carta sube o baja, que es la única otra cosa
   que depende de la disposición. */
const ARRIBA = { 2: 1, 3: 2, 4: 2 };

/* En qué celda se dibuja un asiento, mirando la mesa desde `miLado`.
 *
 * En local `miLado` es 0 y no se mueve: los cuatro se quedan donde están y
 * de quién es el turno lo dice el abanico, no la disposición. Hacer girar la
 * mesa en cada turno con todos mirando la misma pantalla sería marear a los
 * cuatro para orientar a uno.
 *
 * ►► Y eso sienta al asiento 0 adelante, también en local. ◄◄
 *
 * Es un cambio visible en el duelo local, que hasta ahora dibujaba al
 * jugador 1 ARRIBA y al 2 abajo. Ahora los dos modos se ven igual: el
 * primer asiento al frente, los demás enfrentados. Podría haberse
 * conservado el orden viejo pasando otro `miLado` sólo para la mesa de dos,
 * y sería exactamente la clase de excepción que este archivo existe para no
 * tener: una mesa que se acomoda distinto que las otras dos por razones que
 * no se pueden deducir mirándola.
 *
 * El anillo no depende de esto. Sea quien sea el que se siente adelante, el
 * objetivo de cada uno cae en una celda contigua a la suya — es una
 * propiedad de la rotación, no de dónde arranca.
 */
export function celdaDe(asiento, miLado, total) {
  const anillo = ANILLO[total] ?? ANILLO[2];
  const vueltas = anillo.length;
  return anillo[((asiento - miLado) % vueltas + vueltas) % vueltas];
}

/* Si esa celda está en la fila de arriba. Es lo único que necesita saber la
   carta que vuela: sale del que la tira y aterriza en el que la recibe, así
   que sube cuando el destino está arriba y baja cuando está abajo. */
export function celdaArriba(celda, total) {
  return celda < (ARRIBA[total] ?? 1);
}
