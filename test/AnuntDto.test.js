// Teste pentru modelele API (DTO) si mapper-ul automat (laboratorul 7, Ex. 2).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { catreDto, catreListaDto, dinBody } = require('../models/api/AnuntDto');

const entitate = {
  id: 7, titlu: 'Garsonieră', descriere: null, tip: 'inchiriere', stare: 'activ',
  pret: '1200.00', pret_o_persoana: '900.00', moneda: 'RON', garantie: null,
  disponibil_de_la: new Date('2026-12-01T00:00:00Z'), locuri_libere: null, promovat: false,
  creat_la: new Date('2026-11-09T10:00:00Z'), proprietate_id: 3,
  proprietate: { id: 3, denumire: 'Ap. centru', oras: 'Suceava', stare: 'liber', max_locatari: 3,
    utilizator: { nume: 'Popescu', prenume: 'Maria', telefon: '0712345678' } },
};

test('DTO-ul aduna date din 3 tabele si transforma tipurile', () => {
  const dto = catreDto(entitate, [{ cale: '/uploads/anunturi/a.jpg' }]);
  assert.equal(dto.pret, 1200);
  assert.equal(dto.tip_afisat, 'Închiriere');
  assert.equal(dto.disponibil_de_la, '2026-12-01');
  assert.equal(dto.proprietar, 'Maria Popescu');
  assert.deepEqual(dto.proprietate, { id: 3, denumire: 'Ap. centru', oras: 'Suceava', max_locatari: 3 });
  assert.deepEqual(dto.imagini, ['/uploads/anunturi/a.jpg']);
});

test('DTO-ul NU expune date interne sau personale', () => {
  const text = JSON.stringify(catreDto(entitate));
  assert.ok(!text.includes('0712345678'), 'telefonul nu trebuie sa apara');
  assert.ok(!('proprietate_id' in catreDto(entitate)));
});

test('pretul pe persoane: 1 persoana pretul redus, apoi impartit egal', () => {
  const p = catreDto(entitate).preturi_pe_persoane;
  assert.deepEqual(p.map((x) => x.pe_persoana), [900, 600, 400]);
  assert.deepEqual(catreDto({ ...entitate, tip: 'vanzare' }).preturi_pe_persoane, []);
});

test('lista: fiecare anunt primeste doar imaginile lui', () => {
  const lista = catreListaDto([entitate, { ...entitate, id: 8 }], [{ entitate_id: 8, cale: '/b.jpg' }]);
  assert.deepEqual(lista.map((a) => a.imagini.length), [0, 1]);
});

test('intrarea JSON devine forma pe care o valideaza ViewModel-ul', () => {
  const f = dinBody({ titlu: 'X', pret: 450, promovat: true, proprietate_id: 2 });
  assert.equal(f.pret, '450');
  assert.equal(f.proprietate_id, '2');
  assert.equal(f.promovat, 'on');
  assert.equal(f.garantie, '');
  assert.equal(dinBody({ promovat: 'true' }).promovat, ''); // doar true (boolean) inseamna promovat
});