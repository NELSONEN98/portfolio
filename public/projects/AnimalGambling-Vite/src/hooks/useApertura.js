import { useEffect, useState } from "react";
import { ms } from "../theme";

const ENTRADA_MS = ms("apertura.entrada");
const META_MS = ms("apertura.meta");
const CARTA_MS = ms("apertura.carta");
const ESCALON_MS = ms("apertura.escalon");
const RESPIRO_MS = ms("apertura.respiro");

/* ►► La apertura de la partida. ◄◄
 *
 * Cuatro pasos, y cada uno explica el siguiente:
 *
 *   entrada   la mesa sola, un respiro antes de que vuele nada
 *   reparto   las cartas salen del mazo hacia cada jugador
 *   mano      las cartas llegaron: aparece el abanico
 *   listo     aparece el dado, y CON él el cartel de la meta
 *   jugando   el cartel ya se leyó y se va; queda la mesa
 *
 * Es el orden de una mesa de verdad: se reparte, y recién entonces alguien
 * toca el dado. Todo junto, el jugador ve una pantalla llena de cosas sin
 * saber cuál mirar primero.
 *
 * ►► El cartel de la meta cambió de punta. ◄◄
 *
 * Estaba en el primer paso, solo en pantalla y antes del reparto: 900ms en
 * los que todavía no hay nada que mirar, así que se leía como parte de la
 * carga y no como una regla. Y se iba JUSTO cuando entraba el dado, o sea
 * en el momento en que el jugador por fin miraba la mesa.
 *
 * Ahora entra con el dado —cuando ya hay una partida delante y la frase
 * significa algo— y se va sola unos segundos después, que es lo que tarda
 * en leerse. El paso de entrada se queda igual: dejó de sostener el cartel,
 * pero sigue siendo el respiro que evita que las cartas vuelen encima de
 * una mesa que todavía se está pintando.
 *
 * ►► `mano` existe por una razón concreta. ◄◄
 * Sin ese paso, el abanico aparecía durante el reparto y las cartas volaban
 * hacia una mano que ya estaba puesta — el reparto quedaba como una
 * decoración encima de algo que ya había pasado. Ahora el abanico entra
 * exactamente cuando la última carta aterriza.
 *
 * ►► Y por eso la mano y el dado no se ocultan: no se montan. ◄◄
 * Tenerlos ahí con opacidad cero es la misma mentira más barata.
 *
 * `cuantas` es el total de cartas a repartir —la mano inicial por jugador—
 * y decide cuánto dura el paso del medio: con dos jugadores son seis, con
 * cuatro son doce y la apertura se estira sola.
 */
export function useApertura(cuantas, activa = true) {
  /* Arranca en "listo" cuando no corresponde animar. El caso real es entrar
     a una partida ya empezada: en online la pantalla se monta igual al
     reconectar, y repartir de nuevo unas cartas que el jugador ya tiene
     sería contar una mentira sobre el estado de la mesa. */
  const [fase, setFase] = useState(activa ? "entrada" : "jugando");

  useEffect(() => {
    if (!activa) return;

    const repartoMs = CARTA_MS + Math.max(0, cuantas - 1) * ESCALON_MS;
    const hastaListo = ENTRADA_MS + repartoMs + RESPIRO_MS;
    const t = [
      setTimeout(() => setFase("reparto"), ENTRADA_MS),
      setTimeout(() => setFase("mano"), ENTRADA_MS + repartoMs),
      setTimeout(() => setFase("listo"), hastaListo),
      /* Y una más: el cartel de la meta se apaga solo. Va como fase y no
         como un `setTimeout` suelto en la pantalla para que el orden entero
         de la apertura siga viviendo en un lugar. */
      setTimeout(() => setFase("jugando"), hastaListo + META_MS),
    ];
    return () => t.forEach(clearTimeout);
  }, [activa, cuantas]);

  return {
    fase,
    /* Se exponen como banderas y no comparando la fase afuera: así el orden
       de los pasos vive sólo acá, y la pantalla no tiene que saber cuál
       viene antes que cuál para dibujarse. */
    /* El cartel de la meta: sólo en el paso donde entra el dado. Antes era
       `fase !== "listo"` —o sea, todo el rato MENOS ese— que es exactamente
       al revés de donde sirve. */
    muestraMeta: fase === "listo",
    reparte: fase === "reparto",
    muestraMano: fase === "mano" || fase === "listo" || fase === "jugando",
    muestraDado: fase === "listo" || fase === "jugando",
  };
}
