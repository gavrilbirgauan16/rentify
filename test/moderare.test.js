// Teste pentru moderarea anunturilor: cand ajunge un anunt "In asteptare", cand ramane aprobat, limita, motivul.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../servicii/moderare');

// Un anunt asa cum vine din baza de date (Decimal-urile ca text, data ca Date).
const dinBaza = {
  proprietate_id: 1, tip: 'inchiriere', titlu: 'Garsoniera', descriere: null, pret: '1000.00', pret_o_persoana: null,
  moneda: 'RON', garantie: null, disponibil_de_la: new Date('2026-12-01T00:00:00Z'), locuri_libere: null,
};
// Acelasi anunt, asa cum il trimite formularul (catreEntitate): numere, null-uri, aceeasi data.
const dinFormular = {
  proprietate_id: 1, tip: 'inchiriere', titlu: 'Garsoniera', descriere: null, pret: 1000, pret_o_persoana: null,
  moneda: 'RON', garantie: null, disponibil_de_la: new Date('2026-12-01'), locuri_libere: null, stare: 'activ', promovat: false,
};

test('acelasi continut in alta forma (1000.00 vs 1000, Date) nu conteaza ca schimbare', () => {
  assert.equal(M.continutSchimbat(dinBaza, dinFormular), false);
});

test('orice schimbare de continut (sau de imagini) conteaza', () => {
  assert.equal(M.continutSchimbat(dinBaza, { ...dinFormular, pret: 999 }), true);
  assert.equal(M.continutSchimbat(dinBaza, { ...dinFormular, titlu: 'Garsoniera ' }), false); // spatiile de la capete nu conteaza
  assert.equal(M.continutSchimbat(dinBaza, { ...dinFormular, descriere: 'Text nou' }), true);
  assert.equal(M.continutSchimbat(dinBaza, { ...dinFormular, proprietate_id: 2 }), true);
  assert.equal(M.continutSchimbat(dinBaza, dinFormular, true), true); // poze adaugate / sterse
  assert.equal(M.continutSchimbat(dinBaza, { ...dinFormular, stare: 'inactiv', promovat: true }), false); // nu sunt continut
});

test('amprenta continutului: aceeasi pentru acelasi continut, alta la orice schimbare (text, pret, poze)', () => {
  const a = M.amprentaContinut(dinBaza, [3, 1]);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(M.amprentaContinut(dinFormular, [1, 3]), a); // alta forma, aceeasi valoare; ordinea pozelor nu conteaza
  assert.notEqual(M.amprentaContinut({ ...dinBaza, pret: '999.00' }, [1, 3]), a);
  assert.notEqual(M.amprentaContinut({ ...dinBaza, descriere: 'Nou' }, [1, 3]), a);
  assert.notEqual(M.amprentaContinut(dinBaza, [1, 3, 7]), a); // poza adaugata
  assert.notEqual(M.amprentaContinut(dinBaza, [1]), a); // poza stearsa
});

test('proprietarul cere "Publica": fara aprobare sau cu continut schimbat -> In asteptare', () => {
  assert.deepEqual(M.stareLaSalvare({ ceruta: 'activ', aprobat: false, schimbat: false }), { stare: 'in_asteptare', pastreazaAprobarea: false });
  assert.deepEqual(M.stareLaSalvare({ ceruta: 'activ', aprobat: true, schimbat: true }), { stare: 'in_asteptare', pastreazaAprobarea: false });
});

test('anunt aprobat, salvat fara schimbari de continut -> ramane Activ (nu se reaproba degeaba)', () => {
  assert.deepEqual(M.stareLaSalvare({ ceruta: 'activ', aprobat: true, schimbat: false }), { stare: 'activ', pastreazaAprobarea: true });
});

test('Ciorna / Inactiv raman cum le cere; o schimbare de continut sterge oricum aprobarea', () => {
  assert.deepEqual(M.stareLaSalvare({ ceruta: 'inactiv', aprobat: true, schimbat: false }), { stare: 'inactiv', pastreazaAprobarea: true });
  assert.deepEqual(M.stareLaSalvare({ ceruta: 'ciorna', aprobat: true, schimbat: true }), { stare: 'ciorna', pastreazaAprobarea: false });
});

test('butonul Activeaza: direct activ doar cu aprobare valabila', () => {
  assert.equal(M.stareLaActivare(true), 'activ');
  assert.equal(M.stareLaActivare(false), 'in_asteptare');
});

test('limita: Activ si In asteptare ocupa loc; se verifica doar la intrarea intr-o astfel de stare', () => {
  assert.equal(M.verificaLimita('in_asteptare', 'ciorna'), true);
  assert.equal(M.verificaLimita('activ', 'inactiv'), true);
  assert.equal(M.verificaLimita('activ', 'in_asteptare'), false); // aprobarea nu ocupa un loc nou
  assert.equal(M.verificaLimita('in_asteptare', 'activ'), false); // editat dupa aprobare: tot un singur loc
  assert.equal(M.verificaLimita('ciorna', null), false);
  assert.equal(M.verificaLimita('in_asteptare', 'respins'), true); // retrimis dupa respingere
});

test('motivul respingerii: obligatoriu, 5-300 de caractere, fara spatii in plus', () => {
  assert.ok(M.valideazaMotiv('').eroare);
  assert.ok(M.valideazaMotiv('nu').eroare);
  assert.ok(M.valideazaMotiv('x'.repeat(301)).eroare);
  assert.deepEqual(M.valideazaMotiv('  Lipsesc   pozele  '), { motiv: 'Lipsesc pozele', eroare: null });
});
