// Teste pentru afisarea utilizatorilor in admin: rolul, starea, limita de proprietati din plan.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const UtilizatorViewModel = require('../models/UtilizatorViewModel');

const entitate = (date = {}) => ({
  id: 2, nume: 'Popescu', prenume: 'Maria', email: 'maria@rentify.test', stare: 'activ',
  rol: { nume: 'proprietar' }, _count: { proprietate: 2 }, ...date,
});
// abonament curent cu planul Basic (cel mult 1 proprietate)
const abonamentBasic = {
  id: 1, utilizator_id: 2, plan_id: 1, perioada: 'lunar', pret: 250, data_inceput: new Date('2026-11-01'), data_sfarsit: new Date('2026-11-30'),
  stare: 'activ', plan_abonament: { nume: 'Basic', limita_plan: [{ cheie: 'max_proprietati', valoare: 1 }] }, plata_abonament: [],
};

test('numele, rolul si starea se afiseaza frumos', () => {
  const u = new UtilizatorViewModel(entitate({ stare: 'blocat' }));
  assert.equal(u.numeComplet, 'Maria Popescu');
  assert.equal(u.rolAfisat, 'Proprietar');
  assert.equal(u.stareAfisata, 'Blocat');
  assert.equal(u.esteBlocat, true);
});

test('proprietarul peste limita planului e semnalat', () => {
  const s = new UtilizatorViewModel(entitate(), abonamentBasic).situatieProprietati;
  assert.equal(s.text, '2 / 1');
  assert.equal(s.depaseste, true);
});

test('fara abonament, limita de proprietati e 0; chiriasul nu are limita de proprietati', () => {
  const faraPlan = new UtilizatorViewModel(entitate()).situatieProprietati;
  assert.equal(faraPlan.maxim, 0);
  assert.equal(faraPlan.faraPlan, true);
  assert.equal(faraPlan.depaseste, true);
  assert.equal(faraPlan.text, '2 / fără plan');
  assert.equal(new UtilizatorViewModel(entitate({ rol: { nume: 'chirias' } })).situatieProprietati, null);
});

test('adminul nu se poate bloca singur si nu poate bloca alti admini', () => {
  assert.equal(new UtilizatorViewModel(entitate()).poateFiAdministratDe(1), true);
  assert.equal(new UtilizatorViewModel(entitate({ id: 1, rol: { nume: 'admin' } })).poateFiAdministratDe(1), false);
  assert.equal(new UtilizatorViewModel(entitate({ id: 5, rol: { nume: 'admin' } })).poateFiAdministratDe(1), false);
});
