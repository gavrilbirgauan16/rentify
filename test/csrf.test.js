// Teste pentru protectia CSRF a API-ului (middleware/csrf.js): cine trece si cine e oprit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verificaTokenApi, tokenValid } = require('../middleware/csrf');

const TOKEN = 'a'.repeat(64);

// O cerere falsa, cu doar ce citeste middleware-ul.
function cerere({ metoda = 'POST', antete = {}, body = {}, tokenSesiune = TOKEN } = {}) {
  const mici = Object.fromEntries(Object.entries(antete).map(([k, v]) => [k.toLowerCase(), v]));
  return { method: metoda, body, session: { csrfToken: tokenSesiune }, get: (nume) => mici[nume.toLowerCase()] };
}

// Ruleaza middleware-ul si spune ce s-a intamplat: a lasat cererea mai departe sau a raspuns cu un cod.
function ruleaza(req) {
  let rezultat = null;
  const res = { status(cod) { rezultat = cod; return this; }, json() { return this; } };
  verificaTokenApi(req, res, () => { rezultat = 'trece'; });
  return rezultat;
}

test('citirile (GET) trec fara token', () => {
  assert.equal(ruleaza(cerere({ metoda: 'GET' })), 'trece');
});

test('programele cu cheie API trec (nu folosesc cookie-uri); cheia o verifica alt middleware', () => {
  assert.equal(ruleaza(cerere({ antete: { 'x-api-key': 'orice' } })), 'trece');
});

test('din browser: fara token -> 403; token gresit -> 403; token corect -> trece', () => {
  assert.equal(ruleaza(cerere()), 403);
  assert.equal(ruleaza(cerere({ antete: { 'x-csrf-token': 'b'.repeat(64) } })), 403);
  assert.equal(ruleaza(cerere({ antete: { 'x-csrf-token': TOKEN } })), 'trece');
});

test('fara token in sesiune (sesiune noua) nimic nu trece, nici un token "gol"', () => {
  assert.equal(ruleaza(cerere({ antete: { 'x-csrf-token': '' }, tokenSesiune: undefined })), 403);
});

test('formularele HTML trimit tokenul in campul _csrf; React in antet', () => {
  assert.equal(tokenValid(cerere({ body: { _csrf: TOKEN } })), true);
  assert.equal(tokenValid(cerere({ antete: { 'x-csrf-token': TOKEN } })), true);
  assert.equal(tokenValid(cerere({ body: { _csrf: 'scurt' } })), false); // lungime diferita: refuzat fara eroare
});
