// Teste pentru datele de cont (inregistrare si profil) si pentru tokenurile din emailuri.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ContViewModel = require('../models/ContViewModel');
const tokenuri = require('../servicii/tokenuri');

const bun = { rol: 'proprietar', prenume: 'Ana', nume: 'Popescu', email: '  Ana.Pop@Gmail.COM ', telefon: '+40 712 345 678', parola: 'parola-buna-1', confirmare: 'parola-buna-1', termeni: 'on' };

test('inregistrare corecta: fara erori, email cu litere mici, telefon in forma 07...', () => {
  const m = ContViewModel.dinInregistrare(bun);
  assert.deepEqual(m.valideazaInregistrare(), {});
  assert.equal(m.email, 'ana.pop@gmail.com');
  assert.equal(m.catreDate().telefon, '0712345678');
});

test('campurile gresite primesc fiecare eroarea lui', () => {
  const e = ContViewModel.dinInregistrare({ rol: 'admin', prenume: 'A', nume: '123', email: 'nu-e-email', telefon: '12345', parola: 'scurt', confirmare: 'x' }).valideazaInregistrare();
  assert.deepEqual(Object.keys(e).sort(), ['email', 'nume', 'parola', 'prenume', 'rol', 'telefon', 'termeni']);
});

test('nimeni nu se poate inregistra singur ca admin', () => {
  assert.ok(ContViewModel.dinInregistrare({ ...bun, rol: 'admin' }).valideazaInregistrare().rol);
});

test('proprietarul trebuie sa aiba telefon, chiriasul nu', () => {
  assert.ok(ContViewModel.dinInregistrare({ ...bun, telefon: '' }).valideazaInregistrare().telefon);
  assert.equal(ContViewModel.dinInregistrare({ ...bun, rol: 'chirias', telefon: '' }).valideazaInregistrare().telefon, undefined);
});

test('parolele trebuie sa se potriveasca si termenii acceptati', () => {
  assert.ok(ContViewModel.dinInregistrare({ ...bun, confirmare: 'alta-parola' }).valideazaInregistrare().confirmare);
  assert.ok(ContViewModel.dinInregistrare({ ...bun, termeni: undefined }).valideazaInregistrare().termeni);
});

test('telefoane: forme acceptate si respinse', () => {
  assert.equal(ContViewModel.normalizeazaTelefon('0712.345.678'), '0712345678');
  assert.equal(ContViewModel.normalizeazaTelefon('0040 230 123 456'), '0230123456');
  assert.equal(ContViewModel.normalizeazaTelefon(''), '');
  assert.equal(ContViewModel.normalizeazaTelefon('0812345678'), null);
});

test('tokenurile: amprenta e mereu aceeasi pentru acelasi token, iar formele inventate sunt respinse', () => {
  assert.equal(tokenuri.amprenta('abc'), tokenuri.amprenta('abc'));
  assert.equal(tokenuri.amprenta('abc').length, 64);
  assert.equal(tokenuri.formaValida('a'.repeat(43)), true);
  assert.equal(tokenuri.formaValida('../../etc/passwd'), false);
  assert.equal(tokenuri.VALABILITATE_MINUTE.resetare_parola, 60);
});
