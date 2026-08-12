import { CARD, SQUARE } from "../../convex/rules";

/* Íconos como JSX y no como cadenas de HTML.
 *
 * Con innerHTML funcionaban igual en la web, pero React Native no tiene
 * innerHTML: los dibuja react-native-svg, que consume justamente esto.
 * Escritos así, el día de la migración se cambia el import de <svg> a
 * <Svg> y los paths quedan como están.
 *
 * Todas son siluetas macizas, sin línea fina: a tamaño de casilla un
 * dibujo con detalle se convierte en una mancha. Los huecos —los ojos de
 * la calavera, las burbujas de la poción— son del mismo path con
 * fillRule evenodd, no formas encima, así el ícono nunca se desarma.
 */

const Svg = ({ children, ...props }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const SkullIcon = () => (
  <Svg>
    <path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 0-8 8c0 2.5 1.2 4.7 3 6.1V19a1 1 0 0 0 1 1h1.5v-2H11v2h2v-2h1.5v2H16a1 1 0 0 0 1-1v-2.9c1.8-1.4 3-3.6 3-6.1a8 8 0 0 0-8-8Zm-3.2 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6.4 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12 13.6l1.1 2.2h-2.2Z"
    />
  </Svg>
);

export const StarIcon = () => (
  <Svg>
    <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 5.9 20.6l1.3-6.8-5-4.7 6.8-.8z" />
  </Svg>
);

export const ShieldIcon = () => (
  <Svg>
    <path d="M12 2 4 5v6.5c0 4.6 3.4 8.9 8 10.5 4.6-1.6 8-5.9 8-10.5V5z" />
  </Svg>
);

export const PotionIcon = () => (
  <Svg>
    <path
      fillRule="evenodd"
      d="M9 2h6v2h-1v3.6l4.7 8.1A3 3 0 0 1 16.1 20H7.9a3 3 0 0 1-2.6-4.3L10 7.6V4H9zm1.6 10a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm3.1 3a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z"
    />
  </Svg>
);

export const TwoDiceIcon = () => (
  <Svg>
    <path
      fillRule="evenodd"
      d="M3 4h9v9H3zm2.6 2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm3.8 3.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4ZM12 11h9v9h-9zm2.6 2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm3.8 3.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"
    />
  </Svg>
);

/* El signo de pregunta del bonus. Va como <text> y no como path: un "?"
   dibujado a mano a 24px se convierte en un garabato, y el glifo de la
   tipografía del juego ya está cargado y resuelto para cualquier tamaño.
   Sin `fill` propio — lo hereda de `.square svg`, igual que el resto.
   Es además el mismo signo que lleva el mazo de bonus sobre el fieltro: la
   casilla y el montón del que sale la carta ahora dicen lo mismo. */
export const QuestionIcon = () => (
  <Svg>
    <text
      x="12"
      y="18"
      textAnchor="middle"
      fontSize="18"
      fontFamily="var(--display), sans-serif"
      fontWeight="700"
    >
      ?
    </text>
  </Svg>
);

export const SQUARE_ICON = {
  [SQUARE.PENALTY]: SkullIcon,
  [SQUARE.BONUS]: QuestionIcon,
};

/* La rata del robo. Conserva su grilla original de 512 en vez de rehacerse
   en los 24 del resto: a esa escala se le perderían la cola y las patas,
   que es lo que la hace reconocible de un vistazo. El `fill` fijo del
   archivo se saca para que herede el color de la carta, igual que los
   demás íconos. */
export const RatIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M433.5 31.6c-8.5 0-15.1 6.58-15.1 14.81s6.6 14.81 15.1 14.81 15.1-6.58 15.1-14.81S442 31.6 433.5 31.6zM267 59.05c6.6 15.84 17.1 18.03 31.1 24.77-11.2 20.98-23.2 51.08-43.5 59.28-64.7 26.1-98.7 58.3-112.3 98.7-13.1 39-7 87.2 13.3 145.4 61.8 4.9 127.3 9.2 159.4 2.8-1.3-4.4-5.8-7.5-8.6-9-28.5-9.8-45.2-10.9-71.5-12l1.1-9.6c2.2-19.6.4-44.3-7.7-61.3-4.1-8.5-9.5-14.9-16.5-18.8-7-3.9-15.8-5.7-28.4-3.3l-3.2-17.8c13.5-2.4 29.4-.6 40.4 5.4 10.9 6.1 18.7 15.8 23.9 26.7 9.1 18.9 11.1 41.6 9.9 61.8 10 .6 18.9 1.6 26.8 2.9 19.2-30.7 37-60.4 39.5-90.7-13.8-4-32.4-10.7-34.3-24.4-2.7-19.6 3.6-45 19.3-55.5-1 27.8-4.3 43.9-2.3 49.7 5.8 10.9 30.3 15.2 40.1 17.4v.1c17.4 4.8 31.9 7 34.8 25.6 18.2-29.5-14.4-45-36.2-54.5l-.1-5.8c-.3-23.5 5.5-39.4 13.5-53.1 8-13.6 17.7-25 26.9-43.2v-.1c-9.4-1.3-19.4-.1-27.1 1.3 5.7-19.9 23.2-23.73 38.6-16.1 5.9-8.3 13.4-18.83 24.9-29.96-12.7-9.39-19.9-20.4-18.1-33.92-28-3.4-57.4-4.45-78.6 9.84l-4-3.72c-15.7-17.87-60.9-12.3-51.1 11.11zm67.9-4.17c4 7.92 14.9 12.95 29.2 13.88-8 6.49-20.7 11.42-30.3 5.24-7.3-4.71-3.7-13.07 1.1-19.12zM129.4 364.6c-14.6 3.2-38.77 7-49.63 16-8.5 7.4-15.03 19.8-16.19 31.4-1.17 11.6 1.99 21.6 12.85 28.8C120 469.7 165 466.4 205.4 454.9c40.4-11.6 75.4-32.6 119.4-22.8 8.4 2.5 15.7 6.5 14.5 15.9-.4 2.8-1.5 4.8-2.7 6.5-9.7 10.8-30.9 17.7-33.6 21.5-6.4 9.2 34.2 2.8 45-7.6 4.2-4.2 8.1-13 8.9-21.3.8-8.3-1.3-15.3-4.9-18.3-11.2-9.6-24.1-15.1-39.8-15.1-15.7-.1-34 1.7-53.5 6.5-39.1 9.6-83.6 27.5-127.4 18.6-17-3.4-27.4-6.8-33.77-14.9-3.22-4-4.39-10.6-2.48-15.4 7.45-15.2 28.15-17.8 40.95-20.5-2.4-7.2-4.6-16.4-6.6-23.4z" />
  </Svg>
);


/* Los dos íconos de la botonera del versus. Reemplazan a las palabras
   "TIRAR DADO" y "PLANTARSE": los botones se aprietan decenas de veces por
   partida y para entonces ya nadie lee el rótulo, mira la forma. Conservan
   la grilla de 512 de su archivo original por el mismo motivo que la rata
   —rehacerlos en 24 les comería el detalle— y sin `fill` propio, para que
   tomen el color del botón. */
export const DadoIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M255.76 44.764c-6.176 0-12.353 1.384-17.137 4.152L85.87 137.276c-9.57 5.536-9.57 14.29 0 19.826l152.753 88.36c9.57 5.536 24.703 5.536 34.272 0l152.753-88.36c9.57-5.535 9.57-14.29 0-19.825l-152.753-88.36c-4.785-2.77-10.96-4.153-17.135-4.153zm.926 82.855a31.953 18.96 0 0 1 22.127 32.362 31.953 18.96 0 1 1-45.188-26.812 31.953 18.96 0 0 1 23.06-5.55zM75.67 173.84c-5.753-.155-9.664 4.336-9.664 12.28v157.696c0 11.052 7.57 24.163 17.14 29.69l146.93 84.848c9.57 5.526 17.14 1.156 17.14-9.895V290.76c0-11.052-7.57-24.16-17.14-29.688l-146.93-84.847c-2.69-1.555-5.225-2.327-7.476-2.387zm360.773.002c-2.25.06-4.783.83-7.474 2.385l-146.935 84.847c-9.57 5.527-17.14 18.638-17.14 29.69v157.7c0 11.05 7.57 15.418 17.14 9.89L428.97 373.51c9.57-5.527 17.137-18.636 17.137-29.688v-157.7c0-7.942-3.91-12.432-9.664-12.278zM89.297 195.77a31.236 18.008 58.094 0 1 33.818 41.183 31.236 18.008 58.094 1 1-45-25.98 31.236 18.008 58.094 0 1 11.182-15.203zm221.52 64.664A18.008 31.236 31.906 0 1 322 275.637a18.008 31.236 31.906 0 1-45 25.98 18.008 31.236 31.906 0 1 33.818-41.183zM145.296 289.1a31.236 18.008 58.094 0 1 33.818 41.183 31.236 18.008 58.094 0 1-45-25.98 31.236 18.008 58.094 0 1 11.182-15.203zm277.523 29.38A18.008 31.236 31.906 0 1 434 333.684a18.008 31.236 31.906 0 1-45 25.98 18.008 31.236 31.906 0 1 33.818-41.184zm-221.52 64.663a31.236 18.008 58.094 0 1 33.817 41.183 31.236 18.008 58.094 1 1-45-25.98 31.236 18.008 58.094 0 1 11.182-15.203z" />
  </Svg>
);

export const HaltIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M389.917 128.73v100.836h-22.802v-158.5a17.11 17.11 0 0 0-17.11-17.11h-11.863a17.11 17.11 0 0 0-17.11 17.11v158.5h-22.698V46.993a17.11 17.11 0 0 0-17.11-17.11h-11.863a17.11 17.11 0 0 0-17.11 17.11v182.573H229.5V77.33a17.11 17.11 0 0 0-17.108-17.11h-11.864a17.11 17.11 0 0 0-17.11 17.11v263.873l-63.858-51.14a23.385 23.385 0 0 0-30.743 1.32l-5.567 5.31a23.385 23.385 0 0 0-2.01 31.678l102.19 125.647a72.028 72.028 0 0 0 57.092 28.1h60.85A134.637 134.637 0 0 0 436 347.5V128.73a17.11 17.11 0 0 0-17.11-17.108h-11.864a17.11 17.11 0 0 0-17.11 17.11z" />
  </Svg>
);

/* El escudo de las defensas que llevás guardadas. Va aparte del ShieldIcon
   de la carta —que se dibuja chico dentro del abanico— porque acá se ve
   grande al lado del marcador y aguanta el detalle del dibujo original. */
export const HeartShieldIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M256 32c-64 48-128 64-224 96 0 128 160 320 224 368 64-48 224-240 224-368-96-32-160-48-224-96zm0 34.75 5.4 4.05c49.7 37.3 99.6 49.9 176.7 75.6l6.2 2v6.5c0 55-33.1 119.7-72 176.4-38.9 56.8-83.6 105-110.9 125.5l-5.4 4.1-5.4-4.1c-27.3-20.5-72-68.7-110.9-125.5-38.9-56.7-72-121.4-72-176.4v-6.5l6.15-2C150.9 120.7 200.9 108 250.6 70.8l5.4-4.05zm0 22.18c-49.4 35.37-99.8 49.17-170.05 72.37 2.58 46.7 32.35 107 68.65 159.9 35.3 51.5 76.6 96.3 101.4 116.8 24.8-20.5 66.1-65.3 101.4-116.8 36.3-52.9 66.1-113.2 68.6-159.9-70.3-23.2-120.6-37-170-72.37zm-45.5 54.97c19.7.5 38.1 14.4 45.5 48.1 18-86.3 110-42.5 110 22.5-1 63.9-92 107.7-110 162.1-19-54.4-108-98.2-110-162.1 0-39.6 33.8-71.3 64.5-70.6z" />
  </Svg>
);

/* El puño del golpe. Conserva la grilla de 512 de su archivo, igual que la
   rata: rehecho en 24 perdería los nudillos, que es lo que lo hace un puño
   y no una mancha. Sin `fill` propio, para que tome el color de la carta.
   El <rect> transparente del original se descarta: era el lienzo del editor
   y acá sólo agrandaría la caja del dibujo. */
export const PunchIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M198.844 64.75c-.985 0-1.974.03-2.97.094-15.915 1.015-32.046 11.534-37.78 26.937-34.072 91.532-51.085 128.865-61.5 222.876 14.633 13.49 31.63 26.45 50.25 38.125l66.406-196.467 17.688 5.968L163.28 362.5c19.51 10.877 40.43 20.234 62 27.28l75.407-201.53 17.5 6.53-74.937 200.282c19.454 5.096 39.205 8.2 58.78 8.875L381.345 225.5l17.094 7.594-75.875 170.656c21.82-1.237 43.205-5.768 63.437-14.28 43.317-53.844 72.633-109.784 84.5-172.69 5.092-26.992-14.762-53.124-54.22-54.81l-6.155-.282-2.188-5.75c-8.45-22.388-19.75-30.093-31.5-32.47-11.75-2.376-25.267 1.535-35.468 7.376l-13.064 7.47-.906-15c-.99-16.396-10.343-29.597-24.313-35.626-13.97-6.03-33.064-5.232-54.812 9.906l-10.438 7.25-3.812-12.125c-6.517-20.766-20.007-27.985-34.78-27.97zM103.28 188.344C71.143 233.448 47.728 299.56 51.407 359.656c27.54 21.84 54.61 33.693 80.063 35.438 14.155.97 27.94-1.085 41.405-6.438-35.445-17.235-67.36-39.533-92.594-63.53l-3.343-3.157.5-4.595c5.794-54.638 13.946-91.5 25.844-129.03z" />
  </Svg>
);

/* La maldición deja de ser una poción y pasa a ser una calavera con alas
   sobre una lápida. La poción se leía como algo que se toma —un premio— y
   la maldición se la ponés a OTRO. */
export const DeathNoteIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="m294.3 53.6-81.2.24-79.5 70.56 18.3 70.5L201 187l-25.8 74.7 38.7-22.4 11 35.9 30.2-37.1 30.2 38.8 18.5-38.5 31.7 21.1-25.4-71.9 46.4 6.1 18.9-67.1c-27.1-24.3-54.1-48.7-81.1-73zm-88.8 61.2c13.3-.1 28.3 9 35.9 27l-61.9 9.3c-3.9-18.1 11-35.7 26-36.3zm104.5 0c15.1.1 28.1 12.1 26 36.3l-62-9.3c7.7-18 22.7-27.1 36-27zm-54.5 38.5 25.6 56.7h-47.9zM93.26 288.5 51.3 317.7l207.3 72.7L466 317.3l-41-28.8c-54.7 9.2-120.6-14.4-150.7 31.8h-31.4c-41-45.7-104.5-25.2-149.64-31.8zM29 329.8l-6.17 17.6 190.67 66.7v17.8h91.6v-18.7c62.3-21.8 125.5-43.9 188.1-65.8l-6.2-17.6-205.7 71.9 4.1 11.5h-54.8l4.1-11.5c-68.6-24-137.15-48-205.7-71.9z" />
  </Svg>
);

export const CARD_ICON = {
  [CARD.STEAL]: RatIcon,
  [CARD.DEFENSE]: ShieldIcon,
  [CARD.CURSE]: DeathNoteIcon,
  [CARD.DOUBLE]: TwoDiceIcon,
  [CARD.PUNCH]: PunchIcon,
};
