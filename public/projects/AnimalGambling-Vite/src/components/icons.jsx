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
   dibujado a mano a 24px se convierte en un garabato, y un glifo de fuente
   ya está resuelto para cualquier tamaño.
   Sin `fill` propio — lo hereda de `.square svg`, igual que el resto.
   Es además el mismo signo que lleva el mazo de bonus sobre el fieltro: la
   casilla y el montón del que sale la carta dicen lo mismo.

   ►► En `--glifo` y no en `--display`. ◄◄
   Estaba en Bungee, que es la tipografía del juego, y a tamaño de casilla
   el signo no se reconocía: Bungee cierra el ojo del "?" hasta volverlo una
   mancha, y separado del resto de una palabra no queda nada que ayude a
   identificarlo. Una grotesca en negrita mantiene el gancho abierto y bien
   despegado del punto. El porqué largo está en `--glifo`, en el CSS.

   Y va más grande: 18 sobre 24 dejaba casi un tercio del recuadro vacío
   arriba, altura que el signo puede usar sin tocar el borde de la casilla. */
export const QuestionIcon = () => (
  <Svg>
    <text
      x="12"
      y="18.5"
      textAnchor="middle"
      fontSize="22"
      fontFamily="var(--glifo)"
      fontWeight="800"
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

/* La jarra de cerveza. Conserva la grilla de 512 de su archivo, igual que
   el pescado y el puno: rehecha en 24 perderia el asa y la espuma, que es
   lo unico que la distingue de un vaso cualquiera. Sin fill propio, para
   que tome el color de la carta. */
export const BeerSteinIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M252.094 19.438c-18.092-.063-35.548 9.82-43.125 28.437v9.688l-11.376-2.5c-14.316-3.17-25.792-1.15-33.375 3.843-7.585 4.994-12.174 12.898-12.345 25.438-.13 9.54 1.93 15.82 4.813 20 2.882 4.18 6.673 6.672 11.906 8.062 10.465 2.78 26.67-.357 41.094-8.75l5.968-3.47 5.063 4.658c8.405 7.744 14.51 11.07 20.56 12.25 6.052 1.18 13.046.318 23.44-2.875l9.842-3.032 2.063 10.093c2.695 13.158 14.91 23.407 29.125 23.407 13.237 0 23.67-9.028 27.313-21.468l2.218-7.532 7.783.843c8.855.99 19.41-4.045 25-10.343l6-6.75 6.968 5.782c18.61 15.487 35.46 16.96 47.283 11.468 11.82-5.494 20.18-18.602 19.25-38.782-.88-18.827-10.97-30.448-25.5-35.812-14.532-5.364-33.76-3.61-51.282 8.218l-7.436 5.032-5.344-7.25c-7.038-9.585-17.09-15.485-26.72-17-9.628-1.516-18.487.928-25.374 8.406l-7.406 8.03-6.78-8.56c-10.443-13.165-25.214-19.482-39.626-19.532zM65.22 119.968C37.8 203.65 25.784 289.07 28.812 376.19c39.55 17.23 81.422 18.105 123.437 18a956.588 956.588 0 0 0 6.594-34.22c-32.102 1.678-64.094 2.52-94.313-9.124-2.33-66.88 6.917-121.622 28-187.03 27.318 6.5 55.01 8.61 83.25 7.467-.07-11.715-.387-22.556-1.03-32.31-37.168-1.726-73.593-8.642-109.53-19zm148 2.97c-6.57 3.29-13.37 5.82-20.19 7.406 3.092 33.456 1.947 78.392-2.186 127.094-4.777 56.28-13.866 116.5-26.438 166.718H434.25c-9.932-52.565-18.812-111.61-23.594-166.72-3.87-44.618-5.233-86.115-2.03-119.717-10.777-1.282-22.047-5.642-32.938-13.22-7.498 5.988-16.954 10.145-27.25 10.75-7.46 16.247-23.42 28.125-42.688 28.125-19.644 0-36.84-11.86-44.344-28.938-8.26 1.885-15.993 2.507-23.72 1-8.57-1.67-16.468-6.014-24.467-12.5zm-78.376 319.906L116.22 491.25h358.686l-21.72-48.406h-318.34z" />
  </Svg>
);

/* ►► SALTAR: el salto de rana. ◄◄
 *
 * Conserva la grilla de 512 de su archivo —`public/cards/leapfrog.svg`—
 * igual que el puno, el pescado y la copa. Sin fill propio, para que tome
 * el color de la carta.
 *
 * Reemplaza a un dibujo de relleno que habia hecho a mano —dos siluetas y
 * un arco— mientras no habia arte para esta carta. Ese si se borra y no se
 * guarda como la jarra de cerveza: aquella era un dibujo trabajado que dejo
 * de usarse, y esto era un andamio esperando que llegara el bueno.
 *
 * Y el salto de rana dice la mecanica mejor que el arco tachado: saltar no
 * es anular a alguien, es pasarle por encima y seguir. */
export const LeapfrogIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M312.1 21.13c-11.6 0-24.5 9.6-30 26.05-6.5 19.5 1.1 37.61 13.9 41.91 12.8 4.2 29.8-5.6 36.4-25.1 6.5-19.5-1.2-37.59-14-41.87-2-.67-4.1-.99-6.3-.99zM198.4 66.74c-29.5 22.35-47.8 40.16-66.1 63.26-8 11.5 12.3 32.2 26.5 19.2l44.6-43.7 37.7 7.1c-22.6 46.3-37.4 83.3-81.3 113.6-22.9.5-43.2-6.6-63.82-12.6-16.71-4.7-26.86 28.1-10.84 33.5 28.26 11.4 58.66 19.9 92.36 23.8 62.5-49.6 105-83.6 211.6.8 15.4 10 31.2-19.8 26-24.9l-78.2-61.9c-10.1-6.7-33.1-5.6-50.2-7.9 12.4-15.4 18.8-28.7 25.2-42.2 19.4 8.8 47.9 20 58.3 18.3 24.6-18.4 45.6-35.4 64.6-54.41 9.2-11.46-14.7-33.2-23.7-25.08L362 115.5c-10.6-6.3-21.8-11.6-33.6-16.41-11.1 8.21-24.8 11.51-38.1 7.01-12.5-4.2-21.2-14.11-25.5-26.31-21.5-4.99-43.8-9.07-66.4-13.05zm119 212.86c-2.4 0-4.9.1-7.4.5-20.4 2.9-33.1 17.9-31.2 31.2 1.9 13.4 18.3 24.2 38.7 21.3 20.4-2.9 33.1-17.8 31.2-31.2-1.7-11.7-14.4-21.5-31.3-21.8zm-185.5 115c-1.2 29.4 17.7 28.6 62.6 26.4l-44.4 42.1c-9 9.3 13.6 28.4 24.7 23.7l89.9-73c7.4 45.3 8.4 46.4 11.9 58.8 3.8 13.3 28.7 8.8 26.6-1.6-4.6-23.7-9.4-81.7-19.4-123.1-14.4-5.9-20.6-18.7-22.8-34-1-7.1-.1-13.9 2.5-20.2-47.3 4.1-123.2 59.1-131.6 100.9zM257.4 361l4.1 27.6-45-3.7z" />
  </Svg>
);

/* ►► MEDIA VUELTA: la mesa cambia de mano. ◄◄
 *
 * Dos flechas curvas encontradas, girando en sentidos opuestos. No es un
 * circulo con una flecha —eso dice "repetir"— sino dos que se cruzan, que
 * es lo que de verdad pasa: lo que iba para un lado ahora va para el otro. */
/* ►► Los atributos van en un <g>, no en el <svg>, y eso NO es estilo. ◄◄
 *
 * `.card-icon svg { fill: currentColor }` es una declaracion de CSS, y el
 * CSS le gana SIEMPRE a un atributo de presentacion. Con `fill="none"` en
 * el <svg> —que es como estaba— la regla lo pisaba y los cuatro trazos se
 * rellenaban solidos: la carta salia con una mancha blanca en vez de dos
 * flechas. Es el unico icono de trazo del archivo; todos los demas son
 * siluetas rellenas, y por eso ninguno lo sufria.
 *
 * En un <g> el CSS no llega: no hay ninguna regla que apunte ahi, asi que
 * el atributo queda en pie y los <path> heredan de el en vez de heredar del
 * <svg>. Un `fill: none` suelto en el CSS tambien lo arreglaria, pero
 * ataria el dibujo a una regla que vive en otro archivo. */
export const ReverseIcon = () => (
  <Svg viewBox="0 0 24 24">
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 9h11a4 4 0 0 1 0 8h-2" />
      <path d="M7 6L4 9l3 3" />
      <path d="M20 15H9a4 4 0 0 1 0-8h2" />
      <path d="M17 18l3-3-3-3" />
    </g>
  </Svg>
);

/* ►► La copa de martini: lo que ahora invita la casa. ◄◄
 *
 * Reemplaza a la jarra de cerveza en la carta. Conserva la grilla de 512 de
 * su archivo —`public/cards/martini.svg`— igual que el puno, el pescado y
 * la jarra: rehecha en 24 perderia la aceituna y el pie de la copa, que a
 * tamano de carta es lo unico que la separa de un triangulo. Sin fill
 * propio, para que tome el color de la carta.
 *
 * La jarra queda exportada aunque ya no la use nadie: es un dibujo hecho a
 * mano y borrarlo por no estar en uso es tirar trabajo que cuesta rehacer.
 * Si dentro de un tiempo sigue sin llamarla nadie, ahi si. */
export const MartiniIcon = () => (
  <Svg viewBox="0 0 512 512">
    <path d="M382.313 17.156 347 80.594H58.937l13.657 15.53 172.03 195.5v155.063l-118.343 35.438v13.22h255.376v-13.22l-118.344-35.438V291.595l172-195.47 13.657-15.53h-80.595l30.28-54.344-16.342-9.094zM100.25 99.28h236.344l-12.25 21.97a48.11 48.11 0 0 0-17.188-3.188c-17.4 0-32.74 9.283-41.344 23.126H137.125L100.25 99.28zm257.72 0h49.686l-36.875 41.907h-22.31c-2.3-3.7-5.08-7.073-8.25-10.03l17.75-31.876zm-50.814 37.47c16.652 0 29.938 13.33 29.938 30s-13.286 29.97-29.938 29.97-29.97-13.3-29.97-29.97c.002-1.01.062-2.017.158-3 2.26 3.716 6.303 6.22 10.97 6.22 7.112 0 12.905-5.79 12.905-12.907 0-7.118-5.794-12.875-12.908-12.875-.35 0-.688.035-1.03.062 5.276-4.67 12.213-7.5 19.874-7.5z" />
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

/* ►► LOS DIBUJOS DE LAS CARTAS. ◄◄
 *
 * Seis de las ocho cartas tienen dibujo hecho a mano; el martini y la media
 * vuelta siguen con su ícono vectorial hasta que lleguen los suyos.
 *
 * Van en una tabla aparte y NO reemplazando la entrada de `CARD_ICON` porque
 * son dos cosas distintas de dibujar: un ícono es un `<svg>` que toma el
 * color de la carta con `currentColor`, y un dibujo es un `<img>` con sus
 * propios colores. Metiéndolos en la misma tabla, quien la consume tendría
 * que preguntar de qué tipo es cada valor en cada uso.
 *
 * Con dos tablas la pregunta se hace una sola vez, en `CardArt`, y el resto
 * del proyecto pide "el dibujo de esta carta" sin saber de qué está hecho.
 * El día que lleguen los tres que faltan, son tres líneas acá y las
 * entradas de `CARD_ICON` quedan de respaldo.
 */
export const CARD_ART = {
  [CARD.STEAL]: "cards/steal-card-cat.png",
  [CARD.DEFENSE]: "cards/shield-card.png",
  [CARD.CURSE]: "cards/curse-cat.png",
  [CARD.DOUBLE]: "cards/double-dice.png",
  [CARD.PUNCH]: "cards/punch-cat.png",
  [CARD.SKIP]: "cards/jump-card.png",
};

export const CARD_ICON = {
  [CARD.STEAL]: FishCorpseIcon,
  [CARD.DEFENSE]: ShieldIcon,
  [CARD.CURSE]: DeathNoteIcon,
  [CARD.DOUBLE]: TwoDiceIcon,
  [CARD.PUNCH]: PunchIcon,
  [CARD.BEER]: MartiniIcon,
  [CARD.SKIP]: LeapfrogIcon,
  [CARD.REVERSE]: ReverseIcon,
};

/* ►► El dibujo de una carta, sea de lo que sea. ◄◄
 *
 * Un solo lugar donde se decide entre dibujo e ícono. Quien lo usa escribe
 * `<CardArt tipo={carta.type} />` y no se entera de la diferencia — que es
 * justo lo que permite que las tres cartas que todavía no tienen dibujo
 * sigan andando sin un caso especial en cada pantalla.
 *
 * `alt` vacío a propósito: el nombre de la carta ya está escrito debajo, en
 * su franja. Repetirlo acá le haría oír dos veces lo mismo a quien usa un
 * lector de pantalla.
 */
export function CardArt({ tipo }) {
  const dibujo = CARD_ART[tipo];
  if (dibujo) {
    return <img className="card-dibujo" src={dibujo} alt="" draggable="false" />;
  }
  const Icono = CARD_ICON[tipo];
  return Icono ? <Icono /> : null;
}
