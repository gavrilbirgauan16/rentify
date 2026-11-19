// Teste pentru middleware-urile API de autentificare si rol (raspund cu JSON 401 / 403, nu cu redirect).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cereAutentificareApi, cereRolApi } = require('../middleware/autentificare');

// Ruleaza un middleware cu un utilizator (sau null) si spune ce s-a intamplat.
function ruleaza(middleware, utilizator) {
  let rezultat = null;
  const res = { locals: { utilizator }, status(cod) { rezultat = cod; return this; }, json() { return this; } };
  middleware({}, res, () => { rezultat = 'trece'; });
  return rezultat;
}

const chirias = { id: 4, rol: 'chirias', schimbaParola: false };

test('neconectat -> 401; conectat -> trece', () => {
  assert.equal(ruleaza(cereAutentificareApi, null), 401);
  assert.equal(ruleaza(cereAutentificareApi, chirias), 'trece');
});

test('parola temporara de la admin: blocat (403) pana o schimba', () => {
  assert.equal(ruleaza(cereAutentificareApi, { ...chirias, schimbaParola: true }), 403);
});

test('rolul gresit -> 403; rolul cerut -> trece', () => {
  assert.equal(ruleaza(cereRolApi('chirias'), { ...chirias, rol: 'proprietar' }), 403);
  assert.equal(ruleaza(cereRolApi('chirias'), chirias), 'trece');
  assert.equal(ruleaza(cereRolApi('admin', 'proprietar'), { ...chirias, rol: 'admin' }), 'trece');
});
