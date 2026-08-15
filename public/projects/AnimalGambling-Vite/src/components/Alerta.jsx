/* El cartel grande del medio. Lo alimenta `useAlerta`.
 *
 * No lleva estado ni temporizador: los tiene el hook. Acá sólo se dibuja, y
 * ésa es la razón de que estén separados — la pantalla puede cambiar debajo
 * sin que el aviso se corte, y el día que esto sea React Native se reescribe
 * este archivo y el hook queda igual.
 *
 * `role="status"` y no `alert`: el lector de pantalla lo anuncia cuando
 * termina lo que está diciendo, en vez de interrumpir. Un cartel que dura
 * un segundo y medio no justifica cortarle la palabra a nadie.
 */
export default function Alerta({ alerta }) {
  if (!alerta) return null;

  return (
    <div
      key={alerta.key}
      className={`alerta ${alerta.tono ?? "mala"}`}
      role="status"
    >
      {alerta.texto}
    </div>
  );
}
