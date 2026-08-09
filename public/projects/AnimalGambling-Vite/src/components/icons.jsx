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

export const CARD_ICON = {
  [CARD.DEFENSE]: ShieldIcon,
  [CARD.CURSE]: PotionIcon,
  [CARD.DOUBLE]: TwoDiceIcon,
};
