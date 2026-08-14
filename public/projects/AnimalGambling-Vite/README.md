# Gambling Katz

Juego de dados por turnos, para 2 a 4 jugadores, local o en línea. Gatos de
callejón apostando sobre una mesa de billar: se tira, se acumula, y el que
se planta tarde pierde todo lo del turno.

Stack: **React 19 + Vite 8**, **Convex** para el online, **Three.js +
cannon-es** para el dado 3D con física.

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint
```

---

## Lo primero que hay que entender: las reglas viven en un solo archivo

`convex/rules.ts` es la **única fuente de verdad**, y la importan los dos
motores:

```
convex/rules.ts ──┬── src/hooks/useGame.js   (partida local, en el navegador)
                  └── convex/rooms.ts        (partida online, en el servidor)
```

Ahí está todo lo que decide el juego: el tablero, el reparto de cartas, la
resolución de un ataque (`applyCard`), los topes de mano, la tirada.

**No dupliques una regla en los motores.** Ya pasó: el golpe estuvo
implementado en uno y no en el otro, y local y online jugaron distinto
durante días sin que nada fallara — ni el build, ni el lint, ni los tipos.
Un `else if` copiado en dos lados no da error, da dos juegos.

Si una regla tiene que cambiar, cambia en `rules.ts` y los dos motores la
heredan. Lo único que queda en cada motor es a quién le pertenecen los
puntos, porque el robo transfiere y el golpe sólo borra.

### Los números, por si sirven de mapa

| | |
|---|---|
| Meta | 100 puntos |
| Tablero | 12 × 10 → 40 casillas de perímetro |
| Casillas | 5 penitencias (−6), 7 bonus, salida siempre limpia |
| Mano | 5 jugables + 3 defensas, en bolsillos separados |
| Reparto de bonus | golpe 35% · defensa 35% · robar 17% · dos dados 9% · maldición 4% |
| Robo | −3 (70%) o −6 (30%) |
| Golpe | −2, o rompe un escudo. **La defensa no lo tapa** |
| Maldición | 2 turnos con el dado tope en 4 |
| Jugadores | 2 a 4, ataque direccional hacia la derecha |

Golpe y defensa están empatados a propósito: el golpe rompe escudos de a
uno, así que si la defensa saliera más seguido la muralla se repondría más
rápido de lo que se puede tirar abajo y nunca caería.

---

## Publicar: hay cuatro copias del código y ninguna te avisa

Esto es lo que más tiempo hizo perder en este proyecto, así que va primero.

El mismo código vive en **cuatro lugares** que se desincronizan en silencio:

```
1. la fuente            este repo
2. el bundle estático   ../AnimalGambling/     ← npm run publish:game
3. Convex dev           intent-badger-334      ← npx convex dev
4. Convex prod          quixotic-squid-855     ← npx convex deploy
```

Cuando se desfasan, **el juego no falla: se comporta como una versión
vieja**. Una carta no aparece, una regla no se aplica, y uno se pone a
buscar un bug que no existe.

### Cuál corre según lo que tocaste

| Tocaste | Comando |
|---|---|
| Sólo `src/` | `npm run publish:game` |
| `convex/` (incluido `rules.ts`) | `npm run publish:game` **y** `npx convex deploy` |

`rules.ts` está en `convex/`, así que **cualquier cambio de reglas necesita
los dos**. En una partida online el navegador no sortea nada: las cartas
las reparte el servidor.

### La trampa del deploy

`npx convex deploy` **no es automático**. Tu entorno local apunta a *dev*
(`CONVEX_DEPLOYMENT=intent-badger-334`), pero el juego publicado habla
siempre con *prod* — la URL está fija en `src/convex.js`. Entonces el CLI
se frena y pregunta:

```
Do you want to push your code to your prod deployment quixotic-squid-855 now?
```

Hay que contestar **`y`**. No existe flag `--yes`, así que no se puede
correr desatendido. Y correr `npx convex dev` **no publica**: manda todo a
dev y prod se queda como estaba.

Verificá siempre la última línea:

```
✔ Deployed Convex functions to https://quixotic-squid-855.convex.cloud
```

Si nombra `intent-badger-334`, se fue a dev y no sirvió.

### Diagnóstico en diez segundos

Antes de leer una sola línea de lógica cuando algo "no aparece":

```bash
# ¿está en el bundle publicado?
grep -c "punch" ../AnimalGambling/index-*.js

# ¿a qué deployment apunta y qué falta subir? (no toca nada)
npx convex deploy --dry-run -v
```

Si el grep da 0, no hay bug. Falta publicar.

### Un orden que importa

Deployar el servidor sin publicar el cliente deja al jugador recibiendo
cartas que su versión no sabe dibujar — sin ícono y sin nombre. Es peor
que no tener la carta. Van juntos, siempre.

---

## Estructura

```
convex/
  rules.ts        reglas compartidas — el archivo importante
  rooms.ts        motor online: mutations, adaptadores de forma legacy
  schema.ts       validación de la tabla de salas
  crons.ts        limpia salas vencidas cada 10 min (viven 30)

src/
  App.jsx         orquesta pantallas, carteles y avisos
  convex.js       cliente de Convex — la URL de prod está acá
  hooks/
    useGame.js       motor local
    useOnlineRoom.js sondeo del servidor + normalizador de forma
    useRouter.js     rutas por hash
  screens/        Title, Menu, RoomChoice, Select, Versus, GameOver
  components/     Board, Hand, Dice, Fighter, cartas, iconos
  dice3d/         escena.js — Three.js, luces y sombras del dado
  theme/          tokens, motion — el CSS y el 3D leen de acá
  style.css       todo el estilo, con presupuesto de alto por variables

scripts/publish.js  copia dist/ sobre ../AnimalGambling
```

### Detalles que no se deducen mirando

- **`useOnlineRoom.js` normaliza la forma del servidor al entrar.** El
  esquema migró de `player1`/`player2` a un array de jugadores, y el
  normalizador deja que el cliente nuevo funcione contra las dos formas.
  Sin eso, un cliente adelantado al servidor deja el online colgado en
  "esperando al jugador".
- **`vite.config.js` usa `base: './'` y `assetsDir: '.'`.** El juego se
  sirve desde `/projects/animalgambling/`, no desde la raíz, y el CSS pide
  los dibujos con rutas relativas a sí mismo. Con la configuración por
  defecto todo da 404.
- **`scripts/publish.js` no puede ser el `outDir` de Vite.** Al lado del
  juego viven `piskels/` y `md-guides/`, y un `emptyOutDir` se los
  llevaría puestos. El script copia, borra los bundles con hash viejos y
  limpia assets huérfanos — cuando los frames pasaron de png a webp
  sobrevivieron 44 png que nadie pidió.
- **Los tipos de `convex/` no los ve `vite build`.** Es código de
  servidor: se compila aparte. Un import faltante en `rooms.ts` pasa el
  build entero sin una sola queja.

  `npx convex deploy` tiene un paso de typecheck, pero corre en modo
  `try`: si TypeScript no está instalado **lo saltea en silencio**. Y acá
  no está — no figura en `devDependencies`. O sea que hoy esa red no
  existe. Para tenerla:

  Tampoco hay `tsconfig.json`, así que la forma que funciona es pasarle
  los archivos directo:

  ```bash
  npm i -D typescript
  npx tsc --noEmit --skipLibCheck convex/*.ts
  ```

---

## Publicar, completo

```bash
npm run lint
npm run publish:game        # build + copia a ../AnimalGambling
npx convex deploy           # SÓLO si tocaste convex/ — y contestá "y"
git add -A && git commit && git push
```

El bundle publicado se commitea: el portfolio lo sirve como archivo
estático desde `public/`, así que si no está en git, no está en el sitio.
