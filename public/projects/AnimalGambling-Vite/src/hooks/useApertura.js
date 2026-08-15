import { useEffect, useState } from "react";
import { ms } from "../theme";

const REGLAS_MS = ms("apertura.reglas");
const CARTA_MS = ms("apertura.carta");
const ESCALON_MS = ms("apertura.escalon");
const RESPIRO_MS = ms("apertura.respiro");

/* ►► La apertura de la partida. ◄◄
 *
 * Cuatro pasos, y cada uno explica el siguiente:
 *
 *   reglas    "PRIMERO EN LLEGAR A 100", solo en pantalla
 *   reparto   las cartas salen del mazo hacia cada jugador
 *   mano      las cartas llegaron: aparece el abanico
 *   listo     aparece el dado con su bocanada y se va el cartel
 *
 * Es el orden de una mesa de verdad: se dice a qué se juega, se reparte, y
 * recién entonces alguien toca el dado. Todo junto, el jugador ve una
 * pantalla llena de cosas sin saber cuál mirar primero.
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
  const [fase, setFase] = useState(activa ? "reglas" : "listo");

  useEffect(() => {
    if (!activa) return;

    const repartoMs = CARTA_MS + Math.max(0, cuantas - 1) * ESCALON_MS;
    const t = [
      setTimeout(() => setFase("reparto"), REGLAS_MS),
      setTimeout(() => setFase("mano"), REGLAS_MS + repartoMs),
      setTimeout(() => setFase("listo"), REGLAS_MS + repartoMs + RESPIRO_MS),
    ];
    return () => t.forEach(clearTimeout);
  }, [activa, cuantas]);

  return {
    fase,
    /* Se exponen como banderas y no comparando la fase afuera: así el orden
       de los pasos vive sólo acá, y la pantalla no tiene que saber cuál
       viene antes que cuál para dibujarse. */
    muestraReglas: fase !== "listo",
    reparte: fase === "reparto",
    muestraMano: fase === "mano" || fase === "listo",
    muestraDado: fase === "listo",
  };
}
