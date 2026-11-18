// Teste pentru protectia CSRF a API-ului (middleware/csrf.js): cine trece si cine e oprit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verificaTokenApi, tokenValid } = require('../middleware/csrf');

const TOKEN = 'a'.repeat(64);

// O cerere falsa, cu doar ce citeste middleware-ul. Implicit vine dintr-un browser cu cookie de sesiune.
function cerere({ metoda = 'POST', antete = {}, body = {}, tokenSesiune = TOKEN, cuCookie = true } = {}) {
  const toate = { ...(cuCookie ? { cookie: 'alt=1; rentify.sid=s%3Aabc' } : {}), ...antete };
  const mici = Object.fromEntries(Object.entries(toate).map(([k, v]) => [k.toLowerCase(), v]));
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

test('fara cookie de sesiune (ex. Postman fara cheie) -> trece; autentificarea raspunde mai departe cu 401', () => {
  assert.equal(ruleaza(cerere({ cuCookie: false })), 'trece');
  // un cookie cu nume asemanator nu e cel de sesiune
  assert.equal(ruleaza(cerere({ cuCookie: false, antete: { cookie: 'xrentify.sid=1' } })), 'trece');
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
