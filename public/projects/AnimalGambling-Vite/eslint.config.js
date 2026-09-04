import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      /* `__VERSION__` lo inyecta `vite.config.js` al compilar: no existe en
         el navegador ni en el editor, así que sin declararlo acá el linter
         lo lee como una variable inventada. `readonly` porque nadie debe
         asignarle nada — el valor lo pone el build. */
      globals: { ...globals.browser, __VERSION__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
