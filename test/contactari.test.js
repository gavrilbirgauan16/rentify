// Teste pentru limita de contactari (dezvaluirea telefonului proprietarului).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decide } = require('../servicii/contactari');

test('planul Gratuit (5 pe luna): prima cerere consuma o contactare', () => {
  assert.deepEqual(decide({ dejaContactat: false, folosite: 0, maxim: 5 }), { permis: true, consuma: true, ramase: 4 });
});

test('acelasi anunt din nou in aceeasi luna: nu mai consuma', () => {
  assert.deepEqual(decide({ dejaContactat: true, folosite: 3, maxim: 5 }), { permis: true, consuma: false, ramase: 2 });
});

test('limita atinsa: un anunt NOU e refuzat, dar unul deja contactat se vede in continuare', () => {
  assert.deepEqual(decide({ dejaContactat: false, folosite: 5, maxim: 5 }), { permis: false, consuma: false, ramase: 0 });
  assert.equal(decide({ dejaContactat: true, folosite: 5, maxim: 5 }).permis, true);
});

test('ultima contactare a lunii: permisa, raman 0', () => {
  assert.deepEqual(decide({ dejaContactat: false, folosite: 4, maxim: 5 }), { permis: true, consuma: true, ramase: 0 });
});

test('fara abonament (limita 0): refuzat; plan nelimitat: mereu permis', () => {
  assert.equal(decide({ dejaContactat: false, folosite: 0, maxim: 0 }).permis, false);
  assert.deepEqual(decide({ dejaContactat: false, folosite: 999, maxim: null }), { permis: true, consuma: true, ramase: null });
});
