// Teste pentru filtrele si paginarea comune din admin.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../servicii/filtre');

const DEF = {
  q: { tip: 'text' },
  stare: { tip: 'enum', valori: ['activ', 'inactiv'] },
  proprietar: { tip: 'id' },
  camere_min: { tip: 'intreg', min: 1 },
  pret_max: { tip: 'numar' },
  de_la: { tip: 'data' },
  sort: { tip: 'enum', valori: ['noi', 'pret'], implicit: 'noi' },
};

test('valorile gresite sau inventate sunt ignorate, nu dau eroare', () => {
  const f = F.citesteFiltre({ q: '  casa ', stare: 'hacker', proprietar: '-3', camere_min: '0', pret_max: 'abc', de_la: '2026-13-45', pagina: 'x' }, DEF);
  assert.deepEqual(f, { q: 'casa', stare: '', proprietar: '', camere_min: '', pret_max: '', de_la: '', sort: 'noi', pagina: 1 });
});

test('valorile corecte sunt pastrate, cu tipul potrivit', () => {
  const f = F.citesteFiltre({ stare: 'activ', proprietar: '7', camere_min: '2', pret_max: '1500,5', de_la: '2026-11-01', sort: 'pret', pagina: '3' }, DEF);
  assert.equal(f.proprietar, 7);
  assert.equal(f.camere_min, 2);
  assert.equal(f.pret_max, 1500.5);
  assert.equal(f.sort, 'pret');
  assert.equal(f.pagina, 3);
  assert.equal(F.areFiltre(f, DEF), true);
  assert.equal(F.areFiltre(F.citesteFiltre({ sort: 'pret' }, DEF), DEF), false); // sortarea nu e filtru
});

test('paginarea nu iese din limite', () => {
  assert.deepEqual(F.paginare(45, 2, 20), { total: 45, pagina: 2, totalPagini: 3, pePagina: 20, skip: 20, take: 20, de: 21, pana: 40 });
  assert.equal(F.paginare(45, 99, 20).pagina, 3);
  assert.equal(F.paginare(0, 1, 20).de, 0);
  assert.deepEqual(F.paginareLista([1, 2, 3, 4, 5], 2, 2).randuri, [3, 4]);
});

test('adresele pastreaza filtrele, fara valori goale sau implicite', () => {
  const f = F.citesteFiltre({ q: 'ion popescu', stare: 'activ', pagina: '2' }, DEF);
  assert.equal(F.adresa('/admin/x', f, DEF), '/admin/x?q=ion+popescu&stare=activ');
  assert.equal(F.adresa('/admin/x', f, DEF, { pagina: 3 }), '/admin/x?q=ion+popescu&stare=activ&pagina=3');
  assert.equal(F.adresa('/admin/x', f, DEF, { stare: '' }), '/admin/x?q=ion+popescu');
});

test('cautarea in campuri legate (ex. proprietate.oras)', () => {
  assert.deepEqual(F.contineText(['titlu', 'proprietate.oras'], 'sv'), [
    { titlu: { contains: 'sv', mode: 'insensitive' } },
    { proprietate: { oras: { contains: 'sv', mode: 'insensitive' } } },
  ]);
});
