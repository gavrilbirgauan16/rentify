// Teste pentru limitele din planuri.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const limite = require('../servicii/limite');

const cuLimite = (randuri) => ({ plan_abonament: { limita_plan: randuri } });

test('limita lipsa = nelimitat, fara abonament = 0', () => {
  assert.equal(limite.limita(cuLimite([{ cheie: 'max_proprietati', valoare: 3 }]), 'max_proprietati'), 3);
  assert.equal(limite.limita(cuLimite([]), 'max_proprietati'), null);
  assert.equal(limite.limita(null, 'max_proprietati'), 0);
});

test('situatia fata de limita', () => {
  assert.equal(limite.situatie(4, 3).depaseste, true);
  assert.equal(limite.situatie(3, 3).depaseste, false);
  assert.equal(limite.situatie(10, null).text, '10 / nelimitat');
});
