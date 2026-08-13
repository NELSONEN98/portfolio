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

/* SQUARE_ICON no está acá sino más abajo, junto a CARD_ICON: necesita a
   DeathNoteIcon, que se declara después. Un `const` se puede nombrar antes
   sólo dentro de una función que corra más tarde; en el cuerpo del módulo,
   como es este caso, tira ReferenceError al cargar. Y eso NO lo detecta el
   build: es un error de ejecución, así que se ve recién con la pantalla en
   blanco. */



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

/* La maldición deja de ser una poción y pasa a ser una calavera con alas
   sobre una lápida. La poción se leía como algo que se toma —un premio— y
   la maldición se la ponés a OTRO. */
export const DeathNoteIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="m294.3 53.6-81.2.24-79.5 70.56 18.3 70.5L201 187l-25.8 74.7 38.7-22.4 11 35.9 30.2-37.1 30.2 38.8 18.5-38.5 31.7 21.1-25.4-71.9 46.4 6.1 18.9-67.1c-27.1-24.3-54.1-48.7-81.1-73zm-88.8 61.2c13.3-.1 28.3 9 35.9 27l-61.9 9.3c-3.9-18.1 11-35.7 26-36.3zm104.5 0c15.1.1 28.1 12.1 26 36.3l-62-9.3c7.7-18 22.7-27.1 36-27zm-54.5 38.5 25.6 56.7h-47.9zM93.26 288.5 51.3 317.7l207.3 72.7L466 317.3l-41-28.8c-54.7 9.2-120.6-14.4-150.7 31.8h-31.4c-41-45.7-104.5-25.2-149.64-31.8zM29 329.8l-6.17 17.6 190.67 66.7v17.8h91.6v-18.7c62.3-21.8 125.5-43.9 188.1-65.8l-6.2-17.6-205.7 71.9 4.1 11.5h-54.8l4.1-11.5c-68.6-24-137.15-48-205.7-71.9z" />
  </Svg>
);

/* El pescado muerto del robo. Reemplaza a la rata desde que la carta dejó
   de ser sólo "robar": ahora es también la munición que se gasta contra la
   defensa del otro, y un pescado tirado dice DAÑO —algo que quedó por el
   camino— mientras que la rata decía ladrón. El número al lado sigue
   contando cuánto, que es el otro dato que hay que leer de un golpe.
   Conserva la grilla de 512 del archivo, igual que el resto de los dibujos
   grandes, y sin `fill` propio para que tome el color de la carta. */
export const FishCorpseIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M435.125 19.72c-2.52.003-5.002.024-7.47.06-66.318 1.013-117.573 12.795-180.874 39.376-35.44 52.333-24.53 139.625 5.5 202.063 15.218 31.635 35.318 56.506 53.657 67 9.17 5.245 17.488 7.007 25.22 5.53 7.73-1.477 15.614-6.244 23.656-16.813l.375-.5.437-.437c39.966-40.123 69.86-81.484 91.344-124.03l-13.72-33.376-26.156 52-20.53-40.75-40.22 74-18.47-30.344-49.187 46.156 49.938-91.187 18.844 31.03 26.28-87.313 28.656 38.75 30.563-73.78 33 71.093c15.2-41.172 23.373-83.366 25.967-126.5-20.24-1.287-39.178-2.06-56.812-2.03zM300.44 63.17a38.648 55.07 27.484 0 1 23.156 69.732 38.648 55.07 27.484 0 1-68.672-35.476A38.648 55.07 27.484 0 1 300.44 63.17zM93.564 122.406c28.366 36.35 50.67 75.307 69.562 115.72-10.936 12.19-21.54 24.897-31.72 37.905-18.43-22.897-46.54-42.48-90.75-58.155 27.937 28.82 50.546 56.503 70.314 85.438a838.712 838.712 0 0 0-22.157 32.437c-13.103-12.897-31.868-23.74-59.688-31.97 17.43 19.285 31.776 37.524 44.97 55.564-8.043 13.375-15.393 26.5-21.97 39.156-8.645-3.69-19.512-6.08-33.344-8.313 8.2 8.02 16.466 16.23 25.126 24.688-14.698 30.534-24.126 57.313-26.5 76.25 10.822-19.19 24.69-40.377 40.844-62.406a972.77 972.77 0 0 0 26.188 24.03c-3.135-18.866-7.292-31.496-13.938-40.344a933.95 933.95 0 0 1 21.875-27.312c10.99 15.793 21.803 31.7 33.72 48.25-4.94-24.664-8.18-47.663-17.032-67.813a985.887 985.887 0 0 1 24.406-26.78c13.917 23.576 26.725 48.49 39.593 75.875-4.698-35.502-8.05-68.197-18.72-97.28a879.647 879.647 0 0 1 30.47-28.908c14.92 37.328 27.988 75.47 41.125 113.563-1.928-46.754-2.054-94.115-12.844-137.906 4.92-4.03 9.854-8.007 14.812-11.844-7.81-19.14-14.064-39.805-18-60.906a511.066 511.066 0 0 0-18.47 17.156c-18.918-33.25-49.116-62.76-97.874-86.094z" />
  </Svg>
);

/* El puno del golpe. Conserva la grilla de 512 de su archivo, igual que el
   pescado: rehecho en 24 perderia los nudillos, que es lo que lo hace un
   puno y no una mancha. Sin fill propio, para que tome el color de la
   carta. */
export const PunchIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M198.844 64.75c-.985 0-1.974.03-2.97.094-15.915 1.015-32.046 11.534-37.78 26.937-34.072 91.532-51.085 128.865-61.5 222.876 14.633 13.49 31.63 26.45 50.25 38.125l66.406-196.467 17.688 5.968L163.28 362.5c19.51 10.877 40.43 20.234 62 27.28l75.407-201.53 17.5 6.53-74.937 200.282c19.454 5.096 39.205 8.2 58.78 8.875L381.345 225.5l17.094 7.594-75.875 170.656c21.82-1.237 43.205-5.768 63.437-14.28 43.317-53.844 72.633-109.784 84.5-172.69 5.092-26.992-14.762-53.124-54.22-54.81l-6.155-.282-2.188-5.75c-8.45-22.388-19.75-30.093-31.5-32.47-11.75-2.376-25.267 1.535-35.468 7.376l-13.064 7.47-.906-15c-.99-16.396-10.343-29.597-24.313-35.626-13.97-6.03-33.064-5.232-54.812 9.906l-10.438 7.25-3.812-12.125c-6.517-20.766-20.007-27.985-34.78-27.97zM103.28 188.344C71.143 233.448 47.728 299.56 51.407 359.656c27.54 21.84 54.61 33.693 80.063 35.438 14.155.97 27.94-1.085 41.405-6.438-35.445-17.235-67.36-39.533-92.594-63.53l-3.343-3.157.5-4.595c5.794-54.638 13.946-91.5 25.844-129.03z" />
  </Svg>
);

export const SQUARE_ICON = {
  [SQUARE.PENALTY]: SkullIcon,
  [SQUARE.BONUS]: QuestionIcon,
  /* El bonus convertido por la maldición lleva el dibujo de la carta que lo
     convirtió, no la calavera de la penitencia. Con la calavera se leería
     como una casilla de castigo más y no habría forma de entender de dónde
     salió; con este, el jugador ata lo que ve en el camino con la carta que
     acaba de recibir. */
  [SQUARE.TURN_LOSS]: DeathNoteIcon,
};

export const CARD_ICON = {
  [CARD.STEAL]: FishCorpseIcon,
  [CARD.DEFENSE]: ShieldIcon,
  [CARD.CURSE]: DeathNoteIcon,
  [CARD.DOUBLE]: TwoDiceIcon,
  [CARD.PUNCH]: PunchIcon,
};
