// Teste pentru calculele abonamentelor: datele de sfarsit, starea calculata si validarea platilor.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { valideazaPlata } = require('../models/AbonamentViewModel');
const D = require('../servicii/date');

test('sfarsitul perioadei: o luna / un an minus o zi, cu luni scurte', () => {
  assert.equal(D.sfarsitPerioada('2026-11-01', 'lunar'), '2026-11-30');
  assert.equal(D.sfarsitPerioada('2026-11-09', 'anual'), '2027-11-08');
  assert.equal(D.sfarsitPerioada('2026-01-31', 'lunar'), '2026-02-27'); // 31 ian + 1 luna = 28 feb, minus o zi
  assert.equal(D.sfarsitPerioada('2026-12-15', 'lunar'), '2027-01-14'); // trece in anul urmator
});

test('datele imposibile sunt respinse', () => {
  assert.equal(D.eDataValida('2026-02-30'), false);
  assert.equal(D.eDataValida('2028-02-29'), true);
  assert.equal(D.eDataValida('09.11.2026'), false);
});

const abonament = (date) => new AbonamentViewModel({ pret: 450, data_inceput: '2026-11-01', data_sfarsit: '2026-11-30', ...date });

test('starea se calculeaza din date si plati', () => {
  const azi = '2026-11-15';
  assert.equal(abonament().stareCod(azi), 'neplatit');
  assert.equal(abonament({ plati: [{ suma: 450, stare: 'reusita' }] }).stareCod(azi), 'platit');
  assert.equal(abonament({ plati: [{ suma: 450, stare: 'esuata' }] }).stareCod(azi), 'neplatit'); // plata esuata nu conteaza
  assert.equal(abonament({ pret: 0 }).stareCod(azi), 'platit'); // planul gratuit e mereu "platit"
  assert.equal(abonament().stareCod('2026-12-01'), 'expirat');
  assert.equal(abonament().stareCod('2026-10-20'), 'programat');
  assert.equal(abonament({ stare: 'anulat' }).stareCod(azi), 'anulat');
});

test('restul de plata se calculeaza in bani, fara erori de zecimale', () => {
  const a = abonament({ pret: 0.3, plati: [{ suma: 0.1, stare: 'reusita' }, { suma: 0.2, stare: 'reusita' }] });
  assert.equal(a.restDePlata, 0);
  assert.equal(a.estePlatit, true);
});

test('plata: suma pozitiva, cel mult restul, metoda cunoscuta', () => {
  const a = abonament({ plati: [{ suma: 200, stare: 'reusita' }] }); // rest 250
  assert.deepEqual(valideazaPlata({ suma: '250', metoda: 'transfer' }, a).erori, {});
  assert.ok(valideazaPlata({ suma: '250,01', metoda: 'card' }, a).erori.suma);
  assert.ok(valideazaPlata({ suma: '0', metoda: 'card' }, a).erori.suma);
  assert.ok(valideazaPlata({ suma: '10.555', metoda: 'card' }, a).erori.suma);
  assert.ok(valideazaPlata({ suma: '10', metoda: 'bitcoin' }, a).erori.metoda);
});

test('formularul: pretul si sfarsitul vin din plan, nu din ce scrie adminul', () => {
  const m = AbonamentViewModel.dinFormular({ utilizator_id: '2', plan_id: '3', perioada: 'anual', data_inceput: D.azi(), pret: '1' });
  assert.deepEqual(m.valideaza(), {});
  m.completeazaDinPlan({ pret_lunar: 450, pret_anual: 4500 });
  assert.equal(m.pret, 4500);
  assert.equal(m.data_sfarsit, D.sfarsitPerioada(D.azi(), 'anual'));
});

test('inceputul zilei in Romania, iarna (UTC+2) si vara (UTC+3)', () => {
  assert.equal(D.inceputZiRomania('2026-11-10').toISOString(), '2026-11-09T22:00:00.000Z');
  assert.equal(D.inceputZiRomania('2026-07-10').toISOString(), '2026-07-09T21:00:00.000Z');
});
