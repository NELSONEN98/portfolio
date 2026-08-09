import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
/* Ruta completa a propósito: es el único import de todo el proyecto que
   depende del navegador, y se pide por su nombre para que se vea. */
import { aplicarTema } from "./theme/applyTheme";
import "./style.css";

/* El tema se aplica antes de montar y no dentro de un efecto: los tiempos
   de las animaciones llegan como variables CSS, y si llegaran después del
   primer pintado, la primera animación de la sesión correría sin duración
   —o sea, instantánea— y se vería como un salto. */
aplicarTema();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
