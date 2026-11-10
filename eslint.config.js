// ESLint: verifica automat codul de greseli frecvente (variabile nefolosite, nume scrise gresit,
// cod care nu se executa niciodata...). Ruleaza cu:  npm run lint
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // Ce NU se verifica: pachetele instalate, fisierele generate si imaginile incarcate
  { ignores: ['node_modules/', 'uploads/', 'backups/', 'src/generated/', 'public/vendor/'] },

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
];