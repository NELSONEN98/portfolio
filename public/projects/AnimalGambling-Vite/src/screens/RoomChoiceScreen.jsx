import { useState } from "react";

/* Crear sala o entrar a una. Va antes de elegir personaje: el que crea
   necesita el código para pasárselo a alguien, y recién cuando el otro
   entra tiene sentido ponerse a elegir gato. */
export default function RoomChoiceScreen({
  codigo,        // el de la sala creada, mientras se espera
  onCreate,
  onJoin,
  onCancel,
  onBack,
}) {
  const [entrada, setEntrada] = useState("");
  const esperando = Boolean(codigo);

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

          <div className="room-choice-option">
            <button className="btn-nav" onClick={() => onJoin(entrada)}>
              UNIRSE A SALA
            </button>
            <input
              type="text"
              value={entrada}
              placeholder="Pega el código aquí"
              onChange={(e) => setEntrada(e.target.value.toUpperCase().trim())}
              onKeyDown={(e) => e.key === "Enter" && onJoin(entrada)}
            />
          </div>
        </div>
      )}

      {esperando && (
        <div className="room-waiting" style={{ display: "flex" }}>
          <div className="room-code">
            Código: <span>{codigo}</span>
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
