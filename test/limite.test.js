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

test('mai poate adauga? blocheaza exact la limita', () => {
  assert.equal(limite.maiPoate(0, 1), true);   // planul Gratuit, nicio proprietate inca
  assert.equal(limite.maiPoate(1, 1), false);  // a atins limita
  assert.equal(limite.maiPoate(3, 1), false);  // peste limita (ex. dupa un downgrade)
  assert.equal(limite.maiPoate(0, 0), false);  // fara abonament in curs
  assert.equal(limite.maiPoate(99, null), true); // nelimitat
});

test('mesajul de blocare spune exact cate trebuie dezactivate', () => {
  const s = (folosit, maxim, plan = 'Gratuit') => ({ plan, folosit, maxim });
  assert.equal(
    limite.textBlocare(s(1, 1), limite.CUVINTE_PROPRIETATI),
    'Planul tău „Gratuit” permite 1 proprietate activă, iar tu ai 1. Ca să adaugi încă una, dezactivează una sau treci la un plan mai mare.',
  );
  assert.match(limite.textBlocare(s(3, 1), limite.CUVINTE_PROPRIETATI), /dezactivează 3 sau/); // peste limita
  assert.match(limite.textBlocare(s(1, 1), limite.CUVINTE_ANUNTURI), /1 anunț activ.*încă unul, dezactivează unul/);
  assert.match(limite.textBlocare(s(5, 5, 'Standard'), limite.CUVINTE_ANUNTURI), /permite 5 anunțuri active/);
  assert.match(limite.textBlocare(s(0, 0, null), limite.CUVINTE_ANUNTURI), /Nu ai un abonament în curs/);
});

test('situatia fata de limita', () => {
  assert.equal(limite.situatie(4, 3).depaseste, true);
  assert.equal(limite.situatie(3, 3).depaseste, false);
  assert.equal(limite.situatie(10, null).text, '10 / nelimitat');
});
