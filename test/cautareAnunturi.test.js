// Teste pentru cautarea publica: filtrele din adresa si conditia pentru baza de date.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../servicii/cautareAnunturi');

test('fara filtre: doar anunturile active, pe proprietati care nu sunt inactive', () => {
  const where = C.conditie(C.citesteCautarea({}));
  assert.equal(where.stare, 'activ');
  assert.deepEqual(where.proprietate, { NOT: { stare: 'inactiv' } });
});

test('starea "activ" nu poate fi ocolita din adresa', () => {
  const where = C.conditie(C.citesteCautarea({ stare: 'ciorna', q: 'x' }));
  assert.equal(where.stare, 'activ'); // "stare" nici nu e un filtru public: se ignora
});

test('filtrele corecte ajung in conditie', () => {
  const where = C.conditie(C.citesteCautarea({ oras: ' Suceava ', tip: 'inchiriere', pret_min: '500', pret_max: '1.500', camere_min: '2', persoane: '3' }));
  assert.deepEqual(where.proprietate.oras, { equals: 'Suceava', mode: 'insensitive' });
  assert.equal(where.tip, 'inchiriere');
  assert.deepEqual(where.pret, { gte: 500, lte: 1500 }); // "1.500" = o mie cinci sute (punctul separa miile)
  assert.deepEqual(where.proprietate.nr_camere, { gte: 2 });
  assert.deepEqual(where.proprietate.max_locatari, { gte: 3 });
});

test('valorile gresite se ignora, nu dau eroare', () => {
  const f = C.citesteCautarea({ tip: 'hacker', pret_max: 'ieftin', camere_min: '0', sort: 'DROP TABLE', pagina: '-3' });
  assert.equal(f.tip, '');
  assert.equal(f.pret_max, '');
  assert.equal(f.camere_min, '');
  assert.equal(f.sort, 'noi');
  assert.equal(f.pagina, 1);
});

test('pretul minim mai mare decat maximul se inverseaza (greseala de tastare)', () => {
  const f = C.citesteCautarea({ pret_min: '2000', pret_max: '800' });
  assert.equal(f.pret_min, 800);
  assert.equal(f.pret_max, 2000);
});

test('cate pe pagina: implicit 12, cel mult 48 (nimeni nu poate cere tot tabelul deodata)', () => {
  assert.equal(C.citesteCautarea({}).pe_pagina, 12);
  assert.equal(C.citesteCautarea({ pe_pagina: '20' }).pe_pagina, 20);
  assert.equal(C.citesteCautarea({ pe_pagina: '100000' }).pe_pagina, 48);
});

test('cautarea dupa text se uita in titlu, descriere, oras si zona', () => {
  const where = C.conditie(C.citesteCautarea({ q: 'centru' }));
  assert.equal(where.OR.length, 4);
  assert.deepEqual(where.OR[2], { proprietate: { oras: { contains: 'centru', mode: 'insensitive' } } });
});
