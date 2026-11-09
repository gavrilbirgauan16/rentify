// Teste automate pentru ProprietateViewModel. Rulare: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ProprietateViewModel = require('../models/ProprietateViewModel');

const formularBun = () => ({
  denumire: 'Apartament centru', tip: 'apartament', judet: 'Suceava', oras: 'Suceava',
  nr_camere: '2', max_locatari: '3', stare: 'liber', proprietar_id: '2',
});

test('un formular corect nu are erori', () => {
  assert.deepEqual(ProprietateViewModel.dinFormular(formularBun()).valideaza(), {});
});

test('numarul de camere si de locatari trebuie sa fie intregi de la 1 in sus', () => {
  for (const gresit of ['0', '-1', '1.5', 'doi', '']) {
    const erori = ProprietateViewModel.dinFormular({ ...formularBun(), nr_camere: gresit, max_locatari: gresit }).valideaza();
    assert.ok(erori.nr_camere, `nr_camere="${gresit}" ar trebui respins`);
    assert.ok(erori.max_locatari);
  }
});

test('suprafata e optionala, dar daca exista trebuie sa fie pozitiva', () => {
  assert.equal(ProprietateViewModel.dinFormular(formularBun()).catreEntitate().suprafata_mp, null);
  assert.ok(ProprietateViewModel.dinFormular({ ...formularBun(), suprafata_mp: '-3' }).valideaza().suprafata_mp);
  assert.equal(ProprietateViewModel.dinFormular({ ...formularBun(), suprafata_mp: '54.5' }).catreEntitate().suprafata_mp, 54.5);
});

test('balconul: checkbox bifat = true, nebifat = false', () => {
  assert.equal(ProprietateViewModel.dinFormular({ ...formularBun(), are_balcon: 'on' }).are_balcon, true);
  assert.equal(ProprietateViewModel.dinFormular(formularBun()).are_balcon, false);
});

test('starea are eticheta si culoarea potrivite', () => {
  const p = new ProprietateViewModel({ stare: 'inactiv', tip: 'casa' });
  assert.equal(p.stareAfisata, 'Inactiv');
  assert.equal(p.culoareStare, 'secondary');
  assert.equal(p.tipAfisat, 'Casă');
});