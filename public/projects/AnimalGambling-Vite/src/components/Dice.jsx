import { useEffect, useRef, useState } from "react";
import { DADO, ms } from "../theme";

/* Rotaciones que dejan cada cara mirando al frente. Salen del tema porque
   son números, no CSS: cuando el dado se rehaga en React Native van a
   servir igual. */
const CARAS = Object.fromEntries(
  Object.entries(DADO.rotaciones).map(([n, [x, y]]) => [n, { x, y }])
);

/* La cara se revela un poco antes de que el giro termine, para que el
   corte caiga todavía dentro del movimiento. Las dos duraciones salen del
   mismo catálogo, así que la diferencia entre ellas es una decisión y no
   un descuido. */
export const DICE_ROLL_MS = ms("dado.esperaTirada");
const GIRO_MINIMO_MS = ms("dado.giroMinimo");

const PIPS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };

function Cara({ n }) {
  return (
    <div className={`dice-face face-${n}`}>
      {Array.from({ length: PIPS[n] }, (_, i) => (
        <div className="pip" key={i} />
      ))}
    </div>
  );
}

function Cubo({ valor, girando, muerto }) {
  const rot = CARAS[valor] ?? CARAS[6];
  return (
    <div
      className={`dice-3d${girando ? " rolling" : ""}${muerto ? " dead" : ""}`}
      style={girando ? undefined : { transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}
    >
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <Cara n={n} key={n} />
      ))}
    </div>
  );
}

/* `tirada` es null cuando no hay nada en el aire. `dobles` decide si se ve
   el segundo dado: se muestra al jugar la carta, no al tirar, porque ver
   aparecer el segundo es la única confirmación de que la carta hizo algo. */
export default function Dice({ tirada, esperando, dobles, onSettle, onRoll, puedeTirar }) {
  const [girando, setGirando] = useState(false);
  const [caras, setCaras] = useState([6]);
  const settle = useRef(onSettle);
  settle.current = onSettle;

  /* Cuándo empezó a girar. En online el dado arranca al apretar y el
     resultado llega después, así que el giro que ya ocurrió durante la
     espera cuenta: sin descontarlo, el jugador pagaba la latencia de la red
     Y ADEMÁS los 650ms enteros de animación. */
  const desde = useRef(0);

  /* Gira desde el toque, sin esperar al servidor. Antes el dado no se movía
     hasta que llegaba la respuesta, y ese hueco sin nada en pantalla es lo
     que se sentía como que el juego iba lento. */
  useEffect(() => {
    if (!esperando) return;
    desde.current = Date.now();
    setGirando(true);
  }, [esperando]);

  useEffect(() => {
    if (!tirada) return;
    setGirando(true);
    if (!desde.current) desde.current = Date.now();

    const yaGiro = Date.now() - desde.current;
    const resta = Math.max(GIRO_MINIMO_MS, DICE_ROLL_MS - yaGiro);

    const t = setTimeout(() => {
      setGirando(false);
      desde.current = 0;
      setCaras(tirada.dice);
      settle.current?.(tirada);
    }, resta);

    return () => clearTimeout(t);
  }, [tirada]);

  const cuantos = dobles || (tirada?.dice.length ?? caras.length) > 1 ? 2 : 1;

  /* Tocar el dado también tira: es el gesto que la mesa sugiere, y en el
     teléfono queda más a mano que el botón de abajo. Mientras gira no
     acepta toques, o una segunda tirada pisaría a la que está en el aire. */
  const tirable = puedeTirar && !girando;

  return (
    <div
      className={`dice-pair${cuantos > 1 ? " double" : ""}${tirable ? " tirable" : ""}`}
      onClick={tirable ? onRoll : undefined}
      role={tirable ? "button" : undefined}
      tabIndex={tirable ? 0 : undefined}
      aria-label={tirable ? "Tirar el dado" : undefined}
      onKeyDown={(e) => {
        if (!tirable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRoll();
        }
      }}
    >
      {Array.from({ length: cuantos }, (_, i) => (
        <Cubo
          key={i}
          valor={caras[i] ?? 6}
          girando={girando}
          /* Con dos dados el que salió 1 no suma: se apaga para que la
             cuenta se entienda mirando la mesa. */
          muerto={!girando && cuantos > 1 && caras[i] === 1}
        />
      ))}
    </div>
  );
}
