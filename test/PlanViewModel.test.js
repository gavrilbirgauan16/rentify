// Teste automate pentru PlanViewModel (planurile de abonament). Rulare: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const PlanViewModel = require('../models/PlanViewModel');

const formularBun = () => ({ nume: 'Plus', pret_lunar: '20', pret_anual: '200', activ: 'on' });

test('un plan corect nu are erori', () => {
  assert.deepEqual(PlanViewModel.dinFormular(formularBun(), 'chirias').valideaza(), {});
});

test('plata anuala nu poate costa mai mult decat 12 luni', () => {
  assert.ok(PlanViewModel.dinFormular({ ...formularBun(), pret_anual: '241' }, 'chirias').valideaza().pret_anual);
  assert.equal(PlanViewModel.dinFormular({ ...formularBun(), pret_anual: '240' }, 'chirias').valideaza().pret_anual, undefined);
});

test('preturile negative sau lipsa sunt respinse', () => {
  const erori = PlanViewModel.dinFormular({ ...formularBun(), pret_lunar: '-1', pret_anual: '' }, 'chirias').valideaza();
  assert.ok(erori.pret_lunar);
  assert.ok(erori.pret_anual);
});

test('limita goala = nelimitat (fara rand in limita_plan); limita trebuie sa fie numar intreg', () => {
  const nelimitat = PlanViewModel.dinFormular({ ...formularBun(), limita_max_proprietati: '' }, 'proprietar');
  assert.deepEqual(nelimitat.catreLimite(), []);
  assert.ok(PlanViewModel.dinFormular({ ...formularBun(), limita_max_proprietati: '0' }, 'proprietar').valideaza().limita_max_proprietati);
  assert.ok(PlanViewModel.dinFormular({ ...formularBun(), limita_max_proprietati: '2.5' }, 'proprietar').valideaza().limita_max_proprietati);
  assert.deepEqual(PlanViewModel.dinFormular({ ...formularBun(), limita_max_proprietati: '3' }, 'proprietar').catreLimite(), [{ cheie: 'max_proprietati', valoare: 3 }]);
});

test('beneficiile chiriasului: bifat = 1, nebifat = 0', () => {
  const p = PlanViewModel.dinFormular({ ...formularBun(), limita_sesizari: 'on' }, 'chirias');
  const limite = Object.fromEntries(p.catreLimite().map((l) => [l.cheie, l.valoare]));
  assert.equal(limite.sesizari, 1);
  assert.equal(limite.raport_pdf, 0);
  assert.equal(limite.max_contactari_luna, undefined, 'gol = nelimitat');
});

test('un plan inactiv nu poate fi recomandat', () => {
  assert.ok(PlanViewModel.dinFormular({ ...formularBun(), activ: undefined, recomandat: 'on' }, 'chirias').valideaza().recomandat);
});

test('cardul: pret, economie si ce include', () => {
  const p = PlanViewModel.dinEntitate({
    id: 2, nume: 'Standard', descriere: null, pret_lunar: 450, pret_anual: 4500, activ: true, recomandat: true,
    rol: { nume: 'proprietar' }, limita_plan: [{ cheie: 'max_proprietati', valoare: 3 }], _count: { abonament: 4 },
  });
  assert.equal(p.pretLunarAfisat, '450 lei');
  assert.equal(p.economieAnuala, '900 lei');
  assert.equal(p.abonati, 4);
  assert.ok(p.caracteristici.some((c) => c.text === 'Până la 3 proprietăți, cu anunțurile lor' && c.inclus));
  const gratuit = new PlanViewModel({ rol: 'chirias', pret_lunar: '0', pret_anual: '0', limite: { max_contactari_luna: '5', sesizari: '0' } });
  assert.equal(gratuit.esteGratuit, true);
  assert.ok(gratuit.caracteristici.some((c) => c.text === 'Sesizări pentru apartament sau bloc' && !c.inclus));
});