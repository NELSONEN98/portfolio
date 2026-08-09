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

export const SQUARE_ICON = {
  [SQUARE.PENALTY]: SkullIcon,
  [SQUARE.BONUS]: StarIcon,
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


export const CARD_ICON = {
  [CARD.STEAL]: RatIcon,
  [CARD.DEFENSE]: ShieldIcon,
  [CARD.CURSE]: PotionIcon,
  [CARD.DOUBLE]: TwoDiceIcon,
};
