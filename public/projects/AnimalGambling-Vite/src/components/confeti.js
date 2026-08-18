/* Los papelitos, con los colores de las fichas de la casa. Es una lista y
   no un número al azar para que el reparto de colores sea siempre el mismo:
   con `Math.random()` en el pintado, cada re-render los cambiaría de color a
   mitad del vuelo.

   Vive en su propio módulo porque lo usan DOS: la casilla de meta —que dice
   dónde pasó— y el peleador que dio la vuelta —que dice quién fue—. Los dos
   cuentan el mismo hecho y tienen que verse iguales; con una copia por
   componente, el día que se toque un color quedan de distinto color y
   dejan de leerse como lo mismo. */
export const CONFETI_PAPELES = [
  "gold", "red", "bone", "gold", "blue",
  "red", "gold", "bone", "red", "gold", "blue", "bone",
];
