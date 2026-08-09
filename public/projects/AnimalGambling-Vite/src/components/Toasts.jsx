/* Los avisos. Sólo pintan: cuándo aparecen y cuándo se van lo decide
   useToasts, que no toca el DOM y por eso viaja a React Native. */
export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toast-layer" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast${t.tipo === "error" ? " error" : ""}`}
          onClick={() => onDismiss(t.id)}
        >
          {t.mensaje}
        </div>
      ))}
    </div>
  );
}
