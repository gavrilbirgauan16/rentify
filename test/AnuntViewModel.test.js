// Teste automate pentru AnuntViewModel (validari, transformari, afisare). Rulare: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const AnuntViewModel = require('../models/AnuntViewModel');

// Un formular completat corect, pe care il stricam putin in fiecare test.
const formularBun = () => ({
  proprietate_id: '2', tip: 'inchiriere', titlu: 'Garsonieră lângă USV', pret: '900', moneda: 'RON', stare: 'activ',
});

test('un formular corect nu are erori', () => {
  assert.deepEqual(AnuntViewModel.dinFormular(formularBun()).valideaza(), {});
});

test('campurile obligatorii lipsa dau erori pe campurile potrivite', () => {
  const erori = AnuntViewModel.dinFormular({ ...formularBun(), proprietate_id: '', titlu: '   ', pret: '' }).valideaza();
  assert.ok(erori.proprietate_id);
  assert.ok(erori.titlu, 'un titlu doar din spatii nu e valid');
  assert.ok(erori.pret);
});

test('pretul trebuie sa fie pozitiv', () => {
  assert.ok(AnuntViewModel.dinFormular({ ...formularBun(), pret: '0' }).valideaza().pret);
  assert.ok(AnuntViewModel.dinFormular({ ...formularBun(), pret: '-5' }).valideaza().pret);
  assert.ok(AnuntViewModel.dinFormular({ ...formularBun(), pret: 'abc' }).valideaza().pret);
});

test('valori inventate (trimise din F12) sunt respinse', () => {
  const erori = AnuntViewModel.dinFormular({ ...formularBun(), tip: 'hacker', stare: 'sters', moneda: 'USD' }).valideaza();
  assert.ok(erori.tip);
  assert.ok(erori.stare);
  assert.ok(erori.moneda);
});

test('locurile libere trebuie sa fie numar intreg, 0 sau mai mare', () => {
  assert.ok(AnuntViewModel.dinFormular({ ...formularBun(), locuri_libere: '1.5' }).valideaza().locuri_libere);
  assert.ok(AnuntViewModel.dinFormular({ ...formularBun(), locuri_libere: '-1' }).valideaza().locuri_libere);
  assert.equal(AnuntViewModel.dinFormular({ ...formularBun(), locuri_libere: '0' }).valideaza().locuri_libere, undefined);
});

test('campurile optionale goale se salveaza ca null', () => {
  const date = AnuntViewModel.dinFormular(formularBun()).catreEntitate();
  assert.equal(date.garantie, null);
  assert.equal(date.disponibil_de_la, null);
  assert.equal(date.locuri_libere, null);
  assert.equal(date.descriere, null);
  assert.equal(date.pret, 900);
  assert.equal(date.proprietate_id, 2);
});

test('checkbox-ul "promovat" bifat trimite "on"', () => {
  assert.equal(AnuntViewModel.dinFormular({ ...formularBun(), promovat: 'on' }).promovat, true);
  assert.equal(AnuntViewModel.dinFormular(formularBun()).promovat, false);
});

test('pretul si data se afiseaza in format romanesc', () => {
  const a = new AnuntViewModel({ pret: '1250.5', moneda: 'RON', disponibil_de_la: '2026-11-15' });
  assert.equal(a.pretAfisat, '1.250,50 RON');
  assert.equal(a.disponibilAfisat, '15.11.2026');
  assert.equal(new AnuntViewModel({ pret: '1' }).disponibilAfisat, 'imediat');
});

test('telefonul: link in format international, afisare grupata', () => {
  const a = new AnuntViewModel({ proprietar_telefon: '0712 345 678' });
  assert.equal(a.telefonLink, 'tel:+40712345678');
  assert.equal(a.telefonAfisat, '0712 345 678');
  assert.equal(new AnuntViewModel({ proprietar_telefon: '+40 712-345-678' }).telefonLink, 'tel:+40712345678');
  assert.equal(new AnuntViewModel({ proprietar_telefon: '' }).areTelefon, false);
});

test('dinEntitate combina datele din anunt, proprietate si proprietar', () => {
  const a = AnuntViewModel.dinEntitate({
    id: 1, proprietate_id: 2, tip: 'vanzare', titlu: 'Casă', descriere: null, pret: 95000, moneda: 'EUR',
    garantie: null, disponibil_de_la: null, locuri_libere: null, stare: 'activ', promovat: false,
    proprietate: { denumire: 'Vila Aron', oras: 'Cajvana', stare: 'inactiv', utilizator: { nume: 'Popescu', prenume: 'Maria', telefon: '0700000002' } },
  }, [{ id: 7, cale: '/uploads/anunturi/x.jpg', nume_fisier: 'x.jpg' }]);
  assert.equal(a.proprietar_nume, 'Maria Popescu');
  assert.equal(a.proprietate_oras, 'Cajvana');
  assert.equal(a.proprietateInactiva, true);
  assert.equal(a.primaImagine, '/uploads/anunturi/x.jpg');
  assert.equal(a.tipAfisat, 'Vânzare');
});

test('pretul se imparte egal intre chiriasi, iar o persoana poate avea pret redus', () => {
  const a = new AnuntViewModel({ tip: 'inchiriere', pret: '1200', pret_o_persoana: '900', moneda: 'RON', proprietate_max_locatari: 3 });
  const p = a.preturiPePersoane;
  assert.equal(p.length, 3);
  assert.deepEqual(p.map((r) => r.pePersoana), ['900,00 RON', '600,00 RON', '400,00 RON']);
  assert.equal(p[0].redus, true);
  assert.equal(p[1].total, '1.200,00 RON');
  assert.equal(a.pretMinimPePersoana, '400,00 RON');
});

test('fara reducere, o persoana plateste pretul intreg', () => {
  const a = new AnuntViewModel({ tip: 'inchiriere', pret: '1000', moneda: 'RON', proprietate_max_locatari: 2 });
  assert.equal(a.preturiPePersoane[0].pePersoana, '1.000,00 RON');
  assert.equal(a.areReducereOPersoana, false);
});

test('la vanzare nu exista impartire pe persoane', () => {
  assert.deepEqual(new AnuntViewModel({ tip: 'vanzare', pret: '95000', moneda: 'EUR' }).preturiPePersoane, []);
});

test('pretul pentru o persoana: optional, pozitiv, mai mic decat pretul intreg, doar la inchiriere', () => {
  const cu = (pret_o_persoana, tip = 'inchiriere') => AnuntViewModel.dinFormular({ ...formularBun(), pret: '1200', tip, pret_o_persoana }).valideaza().pret_o_persoana;
  assert.equal(cu(''), undefined);
  assert.equal(cu('900'), undefined);
  assert.ok(cu('1200'), 'egal cu pretul intreg nu e reducere');
  assert.ok(cu('1500'));
  assert.ok(cu('0'));
  assert.ok(cu('900', 'vanzare'));
  assert.equal(AnuntViewModel.dinFormular({ ...formularBun(), pret_o_persoana: '' }).catreEntitate().pret_o_persoana, null);
});
