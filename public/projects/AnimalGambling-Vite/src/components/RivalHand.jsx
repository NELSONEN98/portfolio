/* La mano del rival: sólo los reversos, chicos, al lado de su personaje.
 *
 * Se muestra la cantidad y nada más. El servidor manda la mano completa
 * —hace falta para resolver las jugadas—, así que dibujar las caras sería
 * regalar información que el rival no tendría por qué ver.
 *
 * Se apilan con mucho solape: lo único que importa es de un vistazo cuántas
 * cartas le quedan, no contarlas de a una.
 */
export default function RivalHand({ cantidad = 0, lado }) {
  if (!cantidad) return null;

  return (
    <div className={`rival-hand lado-${lado + 1}`} aria-label={`Cartas del rival: ${cantidad}`}>
      {/* Una por carta hasta el tope de la mano: el abanico ya dice cuántas
          son por su ancho, sin necesidad de un número al lado. */}
      {Array.from({ length: Math.min(cantidad, 5) }, (_, i) => (
        <span className="rival-card" key={i} style={{ "--i": i }} />
      ))}
    </div>
  );
}
