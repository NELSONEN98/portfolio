import { useEffect, useState } from "react";

/* Crear sala o entrar a una. Va antes de elegir personaje: el que crea
   necesita el código para pasárselo a alguien, y recién cuando el otro
   entra tiene sentido ponerse a elegir gato. */

const COPIADO_MS = 1800;

const CopyGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

const CheckGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

/* navigator.clipboard sólo existe en contexto seguro. Abierto por file:// o
   por http a secas ni siquiera está definido, y ahí un await pelado tira
   TypeError en vez de rechazar la promesa. El respaldo con textarea es
   viejo, pero funciona donde el otro no llega.
   Devuelve si copió de verdad: cantar "copiado" cuando no se copió nada es
   peor que no decir nada, porque el jugador se va convencido de que tiene
   el código en el portapapeles. */
async function alPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const caja = document.createElement("textarea");
    caja.value = texto;
    caja.setAttribute("readonly", "");
    caja.style.position = "fixed";
    caja.style.opacity = "0";
    document.body.appendChild(caja);
    caja.select();
    let listo = false;
    try {
      listo = document.execCommand("copy");
    } catch {
      /* execCommand no existe o está bloqueado: `listo` ya vale false. */
    }
    document.body.removeChild(caja);
    return listo;
  }
}

export default function RoomChoiceScreen({
  codigo,        // el de la sala creada, mientras se espera
  onCreate,
  onJoin,
  onCancel,
  onBack,
}) {
  const [entrada, setEntrada] = useState("");
  const [copiado, setCopiado] = useState(false);
  const esperando = Boolean(codigo);

  /* El visto se apaga solo: si se quedara fijo dejaría de significar
     "acabo de copiar" y pasaría a ser parte del dibujo del botón. */
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), COPIADO_MS);
    return () => clearTimeout(t);
  }, [copiado]);

  const copiar = async () => setCopiado(await alPortapapeles(codigo));

  return (
    <section className="screen room-choice-screen active">
      <div className="room-choice-header">
        <h2>DUELO ONLINE</h2>
      </div>

      {!esperando && (
        <div className="room-choice-content">
          <div className="room-choice-option">
            <button className="btn-nav" onClick={onCreate}>+ CREAR SALA</button>
            <p>Genera un código y comparte con tu rival</p>
          </div>

          {/* El campo va arriba del botón porque ése es el orden en que se
              usa: primero se pega el código y después se entra. Con el
              botón adelante, la acción aparecía antes que su requisito. */}
          <div className="room-choice-option">
            <input
              type="text"
              value={entrada}
              placeholder="Pega el código aquí"
              onChange={(e) => setEntrada(e.target.value.toUpperCase().trim())}
              onKeyDown={(e) => e.key === "Enter" && onJoin(entrada)}
            />
            <button className="btn-nav secondary" onClick={() => onJoin(entrada)}>
              UNIRSE A SALA
            </button>
          </div>
        </div>
      )}

      {esperando && (
        <div className="room-waiting" style={{ display: "flex" }}>
          {/* El código entero es el área de clic, no sólo el botón chico:
              es lo que el jugador ya está mirando y lo que su dedo apunta.
              El botón al lado queda como la señal de que esto se copia —
              un texto que se puede tocar no se anuncia solo. */}
          <div className="room-code">
            <span className="room-code-label">CÓDIGO</span>
            <div className="room-code-box">
              <button
                type="button"
                className="room-code-value"
                onClick={copiar}
                title="Copiar código"
              >
                {codigo}
              </button>
              <button
                type="button"
                className={`room-code-copy${copiado ? " ok" : ""}`}
                onClick={copiar}
                aria-label="Copiar código"
              >
                {copiado ? <CheckGlyph /> : <CopyGlyph />}
              </button>
            </div>
            <span
              className={`room-code-hint${copiado ? " ok" : ""}`}
              aria-live="polite"
            >
              {copiado ? "¡COPIADO!" : "Clic para copiar"}
            </span>
          </div>
          <p>Esperando al otro jugador...</p>
          <button className="btn-nav" onClick={onCancel}>Cancelar</button>
        </div>
      )}

      {/* Último en el orden de tabulación: primero las dos formas de
          entrar, y recién después la salida. */}
      <button className="btn-nav room-choice-back" onClick={onBack}>
        ‹ Volver al menú
      </button>
    </section>
  );
}
