// ESLint: verifica automat codul de greseli frecvente (variabile nefolosite, nume scrise gresit,
// cod care nu se executa niciodata...). Ruleaza cu:  npm run lint
const js = require('@eslint/js');
const globals = require('globals');
const reactHooks = require('eslint-plugin-react-hooks');
// Pachetul e scris ca modul ES: din CommonJS (require) il primim sub ".default"
const reactRefresh = require('eslint-plugin-react-refresh').default;

module.exports = [
  // Ce NU se verifica: pachetele instalate, fisierele generate si imaginile incarcate
  { ignores: ['node_modules/', 'uploads/', 'backups/', 'src/generated/', 'public/vendor/', 'client/dist/'] },

  // Regulile recomandate de ESLint, pentru tot codul de server (Node.js, CommonJS)
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Parametrul "next" din middleware-urile de erori trebuie sa existe chiar daca nu e folosit
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^(next|_)' }],
      eqeqeq: ['error', 'always'],           // === in loc de == (fara conversii ascunse)
      'no-var': 'error',                     // let / const in loc de var
      'prefer-const': 'error',               // const cand valoarea nu se mai schimba
    },
  },

  // Scripturile din browser (public/js) ruleaza in pagina, nu in Node
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },

  // Interfata React (client/): module ES (import / export), JSX, ruleaza in browser.
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Regulile hook-urilor React (useState, useEffect...): ordinea apelurilor, dependintele efectelor
  { files: ['client/src/**/*.{js,jsx}'], ...reactHooks.configs.flat['recommended-latest'] },
  // Reincarcarea rapida (Vite): un fisier cu o componenta sa exporte doar componente
  { files: ['client/src/**/*.jsx'], ...reactRefresh.configs.vite },
  // Configurarea Vite ruleaza in Node, nu in browser
  { files: ['client/vite.config.js'], languageOptions: { globals: { ...globals.node } } },
];