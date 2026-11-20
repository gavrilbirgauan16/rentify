// Teste pentru regula numarului de imagini ale unui anunt (comuna pentru admin, proprietar si API).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { eroareImagini, MAX_IMAGINI } = require('../middleware/incarcareImagini');

test('in limita: nicio eroare', () => {
  assert.equal(eroareImagini({ numarNoi: 2, numarRamase: 3 }), null);
  assert.equal(eroareImagini({ numarNoi: MAX_IMAGINI, numarRamase: 0 }), null);
});

test('peste limita (poze existente + noi): eroare', () => {
  assert.match(eroareImagini({ numarNoi: 2, numarRamase: MAX_IMAGINI - 1 }), new RegExp(`cel mult ${MAX_IMAGINI}`));
});

test('eroarea de la incarcare (fisier prea mare, tip gresit) are prioritate', () => {
  assert.equal(eroareImagini({ eroareIncarcare: 'O imagine poate avea cel mult 5 MB.', numarNoi: 9 }), 'O imagine poate avea cel mult 5 MB.');
});

test('formular cu alte erori si poze alese: pozele trebuie alese din nou', () => {
  assert.match(eroareImagini({ numarNoi: 1, alteErori: true }), /alege din nou/);
  assert.equal(eroareImagini({ numarNoi: 0, alteErori: true }), null); // fara poze noi, nimic de spus
});
