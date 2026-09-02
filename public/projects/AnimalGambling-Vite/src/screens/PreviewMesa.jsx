import { useEffect, useMemo, useState } from "react";

import VersusScreen from "./VersusScreen";
import { newPlayers } from "../hooks/useGame";
import { ROSTER } from "../roster";
import { makeBoard, GOAL, A_LA_DERECHA } from "../../convex/rules";

/* ►► LA MESA DE MENTIRA, PARA MIRAR EL RESPONSIVE. ◄◄
 *
 * Revisar cómo queda la mesa de cuatro en un teléfono costaba cuatro
 * navegadores: crear la sala, pasar el código tres veces, que los cuatro
 * eligieran gato. Y al terminar de mirar, si había que cambiar un número del
 * CSS, todo otra vez. Eso no es una molestia, es la razón por la que un
 * detalle de la vista de cuatro se revisa una vez y no diez.
 *
 * Esta pantalla monta la MISMA `VersusScreen` que juega la gente, con
 * jugadores inventados. No es una maqueta parecida: es el componente de
 * verdad con el CSS de verdad, así que lo que se ve acá es exactamente lo
 * que se ve jugando. Una maqueta aparte se habría desincronizado el primer
 * día.
 *
 * ►► `online` va en `true` aunque no haya red. ◄◄
 *
 * No es una mentira caprichosa: `online` es lo que decide que las cartas de
 * los rivales se dibujen —en la mesa local las manos ajenas están ocultas—
 * y esas cartas son justamente una de las cosas que hay que mirar. Acá
 * "online" significa "cada uno ve su propia pantalla", que es la situación
 * que se está previsualizando.
 *
 * ►► No se juega, se mira. ◄◄
 *
 * Los botones no hacen nada a propósito. Meterle el motor del juego sería
 * mantener una segunda partida en paralelo, con sus turnos y sus reglas, y
 * el día que las reglas cambien esto se rompe sin que nadie lo note. Lo que
 * hace falta para revisar una vista es poder poner la mesa en cualquier
 * ESTADO —cuatro jugadores, marcador de dos cifras, personaje molido— y eso
 * son cinco perillas, no un motor.
 */

/* Los estados que de verdad rompen la vista, no todos los posibles.
   El marcador en dos cifras está acá porque un "0" mide la mitad que un
   "50" y la meta son 50: probar con una sola cifra miente sobre el ancho. */
const PUNTAJES = [0, 7, 50];

export default function PreviewMesa({ inicial = 4 }) {
  const [cuantos, setCuantos] = useState(Math.min(4, Math.max(2, inicial)));
  const [miLado, setMiLado] = useState(cuantos - 1);
  const [puntaje, setPuntaje] = useState(50);
  const [etapa, setEtapa] = useState(0);
  const [turno, setTurno] = useState(true);

  /* El tablero se sortea UNA vez y no en cada pintado: con `useMemo` sin
     dependencias las casillas rojas se quedan quietas mientras se toquetean
     las perillas, y se puede comparar antes y después de un cambio de CSS
     mirando el mismo tablero. */
  const board = useMemo(() => makeBoard(Math.random), []);

  const players = useMemo(() => {
    const base = newPlayers(ROSTER.slice(0, cuantos));
    return base.map((p) => ({ ...p, score: puntaje, current: puntaje ? 4 : 0 }));
  }, [cuantos, puntaje]);

  /* Mi asiento no puede quedar fuera de la mesa al bajar de cuatro a dos. */
  const lado = Math.min(miLado, cuantos - 1);

  /* Los golpes que pide `VersusScreen` para calcular la etapa de daño: la
     cuenta es golpes/2, así que se multiplica por dos para pedir la etapa
     que se quiere ver. */
  const golpes = useMemo(() => {
    const g = {};
    for (let i = 0; i < cuantos; i++) g[i] = etapa * 2;
    return g;
  }, [cuantos, etapa]);

  /* La medida de la ventana, en vivo. Es el dato que más falta hace mirando
     responsive: sin él hay que adivinar en qué punto de qué consulta cayó lo
     que se está viendo, y ese es justo el error que se paga caro. */
  const [medida, setMedida] = useState(() =>
    typeof window === "undefined" ? "" : `${window.innerWidth}×${window.innerHeight}`
  );
  useEffect(() => {
    const alCambiar = () => setMedida(`${window.innerWidth}×${window.innerHeight}`);
    window.addEventListener("resize", alCambiar);
    window.addEventListener("orientationchange", alCambiar);
    return () => {
      window.removeEventListener("resize", alCambiar);
      window.removeEventListener("orientationchange", alCambiar);
    };
  }, []);

  const boton = (activo) => ({
    background: activo ? "#f0b429" : "rgba(255,255,255,0.12)",
    color: activo ? "#1a1a1a" : "#eee",
    border: "none",
    borderRadius: "0.4rem",
    padding: "0.35rem 0.6rem",
    font: "inherit",
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <>
      {/* ►► El mismo envoltorio que usa la app, y no es decoración. ◄◄
       *
       * Primero monté la `VersusScreen` desnuda y la página desbordaba 324px
       * de ancho y 332 de alto — con ningún elemento saliéndose, que es la
       * pista de que lo que falta es el contenedor y no que algo sobre. El
       * `.table` es el que fija el alto de la pantalla y recorta; sin él la
       * mesa se dibuja suelta en un documento que crece.
       *
       * O sea que una previsualización sin este `div` habría mentido
       * exactamente sobre lo único que vino a mostrar: si algo entra o no
       * entra. `on-versus` fijo porque acá siempre se está en la mesa. */}
      <div className="table on-versus">
        <div className="smoke">
          <div className="smoke-wisp" />
          <div className="smoke-wisp" />
          <div className="smoke-wisp" />
        </div>

        <VersusScreen
          board={board}
          players={players}
          active={turno ? lado : (lado + 1) % cuantos}
          playing
          rolling={false}
          goal={GOAL}
          online
          miLado={lado}
          sentido={A_LA_DERECHA}
          golpes={golpes}
          emotes={{}}
        />
      </div>

      {/* La barra de perillas. Va con estilos en línea y no en `style.css`
          a propósito: es andamiaje de desarrollo, y mezclarlo con las reglas
          del juego sería dejar peso muerto en la hoja que sí se publica. */}
      <div
        style={{
          /* Anclada a los DOS bordes en vez de centrada con `translateX`.
             Centrada, si el contenido supera el ancho de la pantalla se
             desborda por los dos lados y aparece scroll horizontal: medido,
             18px en un teléfono. Y una herramienta para revisar responsive
             que ella misma desborda no sirve — no se sabría si el desborde
             es del juego o del andamio. Anclada, el ancho lo fija la
             pantalla y el contenido se acomoda adentro. */
          position: "fixed",
          left: "0.3rem",
          right: "0.3rem",
          bottom: "0.4rem",
          zIndex: 9999,
          display: "flex",
          gap: "0.4rem",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          boxSizing: "border-box",
          padding: "0.4rem 0.5rem",
          borderRadius: "0.6rem",
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(4px)",
          color: "#eee",
          font: "600 12px/1.2 system-ui, sans-serif",
        }}
      >
        <span style={{ opacity: 0.6 }}>mesa</span>
        {[2, 3, 4].map((n) => (
          <button key={n} style={boton(cuantos === n)} onClick={() => { setCuantos(n); setMiLado(n - 1); }}>
            {n}
          </button>
        ))}

        <span style={{ opacity: 0.6 }}>yo</span>
        {Array.from({ length: cuantos }, (_, i) => (
          <button key={i} style={boton(lado === i)} onClick={() => setMiLado(i)}>
            {i + 1}
          </button>
        ))}

        <span style={{ opacity: 0.6 }}>puntaje</span>
        {PUNTAJES.map((p) => (
          <button key={p} style={boton(puntaje === p)} onClick={() => setPuntaje(p)}>
            {p}
          </button>
        ))}

        <span style={{ opacity: 0.6 }}>daño</span>
        {[0, 1, 2, 3].map((e) => (
          <button key={e} style={boton(etapa === e)} onClick={() => setEtapa(e)}>
            {e}
          </button>
        ))}

        <button style={boton(turno)} onClick={() => setTurno((t) => !t)}>
          {turno ? "mi turno" : "turno ajeno"}
        </button>

        <span style={{ opacity: 0.45 }}>{medida}</span>
      </div>
    </>
  );
}
