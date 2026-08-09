import { useEffect, useRef, useState } from "react";

/* Rotaciones que dejan cada cara mirando al frente. */
const CARAS = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

/* La animación dura 0.7s en el CSS (.dice-3d.rolling). La cara se revela
   50ms antes de que termine, para que el corte caiga todavía dentro del
   movimiento. Si cambia una, cambia la otra. */
export const DICE_ROLL_MS = 650;

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
export default function Dice({ tirada, dobles, onSettle, onRoll, puedeTirar }) {
  const [girando, setGirando] = useState(false);
  const [caras, setCaras] = useState([6]);
  const settle = useRef(onSettle);
  settle.current = onSettle;

  useEffect(() => {
    if (!tirada) return;
    setGirando(true);

    const t = setTimeout(() => {
      setGirando(false);
      setCaras(tirada.dice);
      settle.current?.(tirada);
    }, DICE_ROLL_MS);

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
