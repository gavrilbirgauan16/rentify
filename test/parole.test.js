// Teste automate pentru salvarea parolelor. Rulare: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashParola, verificaParola, verificaReguliParola } = require('../servicii/parole');

test('parola corecta trece, parola gresita nu', async () => {
  const salvat = await hashParola('ParolaMea123');
  assert.equal(await verificaParola('ParolaMea123', salvat), true);
  assert.equal(await verificaParola('parolamea123', salvat), false);
});

test('parola nu apare in clar in ce se salveaza', async () => {
  const salvat = await hashParola('ParolaMea123');
  assert.ok(salvat.startsWith('scrypt$'));
  assert.ok(!salvat.includes('ParolaMea123'));
});

test('aceeasi parola de doua ori da amprente diferite (datorita sarii)', async () => {
  assert.notEqual(await hashParola('ParolaMea123'), await hashParola('ParolaMea123'));
});

test('amprentele vechi sau stricate nu permit conectarea', async () => {
  assert.equal(await verificaParola('orice', 'hash_de_test'), false);
  assert.equal(await verificaParola('orice', ''), false);
  assert.equal(await verificaParola('orice', null), false);
});

test('regula de lungime minima', () => {
  assert.ok(verificaReguliParola('scurta'));
  assert.equal(verificaReguliParola('suficientdelunga'), null);
});