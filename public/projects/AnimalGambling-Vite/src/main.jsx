import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import PreviewMesa from "./screens/PreviewMesa";
/* Ruta completa a propósito: es el único import de todo el proyecto que
   depende del navegador, y se pide por su nombre para que se vea. */
import { aplicarTema } from "./theme/applyTheme";
import "./style.css";

/* El tema se aplica antes de montar y no dentro de un efecto: los tiempos
   de las animaciones llegan como variables CSS, y si llegaran después del
   primer pintado, la primera animación de la sesión correría sin duración
   —o sea, instantánea— y se vería como un salto. */
aplicarTema();

/* ►► `?preview` abre la mesa de mentira en vez del juego. ◄◄
 *
 * Es la única bifurcación de todo el arranque, y vive ACÁ y no adentro de
 * `App` por una razón concreta: así `App` no se entera de que existe. Metida
 * adentro habría que colarla entre sus guardias de ruta y sus efectos, y una
 * pantalla de andamiaje no puede poder romper la pantalla de verdad.
 *
 * Se lee de la query y no del hash porque el hash es del router de `App`,
 * que compara contra su lista de rutas y no reconocería nada pegado ahí. Es
 * el mismo motivo por el que el código de sala viaja en `?sala=`.
 *
 * `?preview` sola abre la mesa de cuatro, que es la que cuesta armar a mano;
 * `?preview=2` y `?preview=3` abren las otras. Y como el componente ya trae
 * las perillas, con abrirla una vez alcanza para verlas las tres.
 *
 * No se protege detrás de `import.meta.env.DEV`: hace falta justamente en el
 * juego PUBLICADO, que es donde se lo mira desde un teléfono de verdad. Sin
 * la query no se carga nada distinto. */
const preview = new URLSearchParams(location.search).get("preview");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {preview === null ? <App /> : <PreviewMesa inicial={Number(preview) || 4} />}
  </StrictMode>
);
