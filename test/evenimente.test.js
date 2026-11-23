// Comunicarea decuplata prin evenimente (bonusul din grila): magistrala (servicii/evenimente.js),
// consumatorii (servicii/consumatori/) si abonarea lor in container. Fara baza de date si fara emailuri reale.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Evenimente = require('../servicii/evenimente');
const posta = require('../servicii/email');
const emailModerare = require('../servicii/consumatori/emailModerare');
const jurnalModerare = require('../servicii/consumatori/jurnalModerare');
const { container } = require('../infrastructura/container');

const EVENIMENT = {
  anunt: { id: 12, titlu: 'Garsonieră centru' },
  proprietar: { email: 'ana@exemplu.ro', prenume: 'Ana', nume: 'Pop' },
  admin: { id: 3 },
  motiv: 'Pozele nu sunt clare.',
};

test('un eveniment publicat ajunge la TOTI consumatorii, cu aceleasi date', async () => {
  const ev = new Evenimente();
  const primite = [];
  ev.aboneaza('test', 'unu', async (date) => { primite.push(['unu', date]); });
  ev.aboneaza('test', 'doi', async (date) => { primite.push(['doi', date]); });
  const rezultate = await ev.publica('test', { id: 1 });
  assert.deepEqual(primite.map(([n]) => n).sort(), ['doi', 'unu']);
  assert.ok(primite.every(([, d]) => d.id === 1));
  assert.deepEqual(rezultate, [{ consumator: 'unu', ok: true }, { consumator: 'doi', ok: true }]);
});

test('un consumator care esueaza NU ii opreste pe ceilalti si NU ajunge la cel care publica', async (t) => {
  t.mock.method(console, 'error', () => {}); // eroarea se noteaza in consola; aici n-o afisam
  const ev = new Evenimente();
  let alDoilea = false;
  ev.aboneaza('test', 'email', async () => { throw new Error('SMTP indisponibil'); });
  ev.aboneaza('test', 'jurnal', async () => { alDoilea = true; });
  const rezultate = await ev.publica('test', {});
  assert.equal(alDoilea, true);
  assert.equal(rezultate[0].ok, false);
  assert.match(rezultate[0].eroare.message, /SMTP/);
  assert.deepEqual(rezultate[1], { consumator: 'jurnal', ok: true });
});

test('publica asteapta consumatorii asincroni sa termine', async () => {
  const ev = new Evenimente();
  let terminat = false;
  ev.aboneaza('test', 'lent', async () => { await new Promise((r) => setTimeout(r, 20)); terminat = true; });
  await ev.publica('test', {});
  assert.equal(terminat, true);
});

test('un eveniment fara consumatori nu e o eroare', async () => {
  assert.deepEqual(await new Evenimente().publica('nimeni.nu.asculta', {}), []);
});

test('in aplicatie, aprobarea si respingerea au cate 2 consumatori independenti', () => {
  const ev = container.resolve('evenimente');
  for (const nume of [Evenimente.ANUNT_APROBAT, Evenimente.ANUNT_RESPINS]) {
    assert.deepEqual(ev.consumatori(nume).sort(), ['email-proprietar', 'jurnal-admin']);
  }
  assert.equal(ev, container.createScope().resolve('evenimente'), 'Singleton: aceeasi magistrala pentru toate cererile');
});

test('consumatorul de email: trimite proprietarului decizia (aprobat / respins cu motiv)', async (t) => {
  const trimise = [];
  t.mock.method(posta, 'trimite', async (mesaj) => { trimise.push(mesaj); return true; });
  await emailModerare.la[Evenimente.ANUNT_APROBAT](EVENIMENT);
  await emailModerare.la[Evenimente.ANUNT_RESPINS](EVENIMENT);
  await emailModerare.la[Evenimente.ANUNT_APROBAT]({ ...EVENIMENT, proprietar: null }); // fara adresa: nu trimite
  assert.equal(trimise.length, 2);
  assert.equal(trimise[0].catre, 'ana@exemplu.ro');
  assert.match(trimise[0].text, /Garsonieră centru.*aprobat/);
  assert.match(trimise[1].text, /Pozele nu sunt clare/);
});

test('consumatorul de jurnal: scrie actiunea adminului, cu jurnalul din scope-ul primit', async () => {
  const notate = [];
  const scop = { resolve: (nume) => (nume === 'jurnal' ? { noteaza: async (...arg) => { notate.push(arg); } } : null) };
  await jurnalModerare.la[Evenimente.ANUNT_APROBAT](EVENIMENT, scop);
  await jurnalModerare.la[Evenimente.ANUNT_RESPINS](EVENIMENT, scop);
  assert.deepEqual(notate[0], [{ id: 3 }, 'aprobare', 'anunt', 12, 'Garsonieră centru']);
  assert.deepEqual(notate[1], [{ id: 3 }, 'respingere', 'anunt', 12, 'Garsonieră centru – motiv: Pozele nu sunt clare.']);
});

test('alerta de securitate: schimbarea parolei are consumatorul de email, cu textul potrivit', async (t) => {
  const emailSecuritate = require('../servicii/consumatori/emailSecuritate');
  assert.deepEqual(container.resolve('evenimente').consumatori(Evenimente.PAROLA_SCHIMBATA), ['email-alerta-securitate']);
  const trimise = [];
  t.mock.method(posta, 'trimite', async (mesaj) => { trimise.push(mesaj); return true; });
  const cand = new Date('2026-11-24T16:30:00Z'); // 18:30 ora Romaniei
  await emailSecuritate.la[Evenimente.PAROLA_SCHIMBATA]({ utilizator: { email: 'ana@exemplu.ro', prenume: 'Ana' }, cum: 'resetare', cand });
  await emailSecuritate.la[Evenimente.PAROLA_SCHIMBATA]({ utilizator: null, cum: 'schimbare', cand }); // fara adresa: nimic
  assert.equal(trimise.length, 1);
  assert.equal(trimise[0].catre, 'ana@exemplu.ro');
  assert.match(trimise[0].subiect, /parola/i);
  assert.match(trimise[0].text, /prin linkul de resetare/);
  assert.match(trimise[0].text, /24 noiembrie 2026.*18:30/);
  assert.match(trimise[0].text, /\/parola-uitata/);
});
