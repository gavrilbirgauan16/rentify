// Teste de integrare pentru API-ul conturilor: inregistrare, confirmarea emailului, parola uitata, resetare.
// Ruleaza cu: npm run test:integrare (pe baza rentify_test).
// Linkurile din emailuri nu pot fi citite de teste (emailurile apar doar in consola), asa ca testul cere un link
// nou pentru utilizator, exact ca la "retrimite linkul" (linkul nou il inlocuieste pe cel vechi).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pornesteAplicatia, Browser, creeazaUtilizator, unic } = require('./ajutor');
const UtilizatorAccessor = require('../../src/NivelAccesDate/UtilizatorAccessor');
// Serviciul de tokenuri, construit de containerul DI - exact ca in aplicatie (laboratorul 10).
const { container } = require('../../infrastructura/container');

const tokenuri = container.createScope().resolve('tokenuri');

const utilizatori = new UtilizatorAccessor();

let aplicatie;
before(async () => { aplicatie = await pornesteAplicatia(); });
after(async () => { await aplicatie.opreste(); });

const browser = () => new Browser(aplicatie.url).pregateste();

const dateCont = (email, rol = 'chirias') => ({
  rol, prenume: 'Ana', nume: 'Test', email, telefon: '0722 333 444', oras: 'Suceava',
  parola: 'ParolaBuna123', confirmare: 'ParolaBuna123', termeni: true,
});

test('inregistrarea: datele gresite -> 400 cu erorile pe campuri; un cont de admin nu se poate crea', async () => {
  const email = `admin.${unic()}@test.rentify`;
  const b = await browser();
  const r = await b.post('/api/auth/inregistrare', { ...dateCont(email), rol: 'admin', termeni: false });
  assert.equal(r.status, 400);
  assert.ok(r.date.erori.rol);
  assert.ok(r.date.erori.termeni);
  assert.equal(await utilizatori.getByEmail(email), null); // aceeasi adresa: nu s-a creat niciun cont
});

test('cont nou -> nu se poate conecta inainte de confirmare -> confirmare -> login, cu planul Gratuit', async () => {
  const email = `nou.${unic()}@test.rentify`;
  const b = await browser();
  const r = await b.post('/api/auth/inregistrare', dateCont(email));
  assert.equal(r.status, 202);

  const u = await utilizatori.getByEmail(email);
  assert.ok(u, 'contul a fost creat');
  assert.equal(u.email_verificat, false);
  const inainte = await b.conecteaza(email, 'ParolaBuna123');
  assert.equal(inainte.status, 403);
  assert.equal(inainte.date.neconfirmat, true);

  const token = await tokenuri.creeaza(u.id, 'confirmare_email');
  assert.equal((await b.post('/api/auth/confirmare', { token })).status, 200);
  assert.equal((await b.post('/api/auth/confirmare', { token })).status, 400); // linkul merge o singura data

  assert.equal((await b.conecteaza(email, 'ParolaBuna123')).status, 200);
  const contactari = await b.get('/api/contactari');
  assert.equal(contactari.date.plan, 'Gratuit'); // planul gratuit primit automat la confirmare
});

test('aceeasi adresa inregistrata de doua ori: acelasi raspuns, un singur cont', async () => {
  const email = `dublu.${unic()}@test.rentify`;
  const b = await browser();
  const prima = await b.post('/api/auth/inregistrare', dateCont(email));
  const aDoua = await b.post('/api/auth/inregistrare', { ...dateCont(email), prenume: 'Altcineva' });
  assert.equal(aDoua.status, prima.status);
  assert.deepEqual(aDoua.date, prima.date); // din raspuns nu se afla ca adresa era deja folosita
  const u = await utilizatori.getByEmail(email);
  assert.equal(u.prenume, 'Ana'); // contul NU a fost suprascris de a doua inregistrare
});

test('retrimiterea si parola uitata: acelasi raspuns pentru o adresa existenta si una inexistenta', async () => {
  const existent = await creeazaUtilizator('chirias');
  const b = await browser();
  for (const adresa of ['/api/auth/confirmare/retrimite', '/api/auth/parola-uitata']) {
    const cuCont = await b.post(adresa, { email: existent.email });
    const faraCont = await b.post(adresa, { email: `nimeni.${unic()}@test.rentify` });
    assert.equal(cuCont.status, 202);
    assert.deepEqual(cuCont.date, faraCont.date);
  }
});

test('resetarea parolei: verificarea linkului, parole diferite, apoi parola noua; sesiunile vechi se inchid', async () => {
  const cont = await creeazaUtilizator('chirias');
  const conectat = new Browser(aplicatie.url);
  await conectat.conecteaza(cont.email, cont.parola);
  assert.equal((await conectat.get('/api/auth/eu')).status, 200);

  const token = await tokenuri.creeaza(cont.id, 'resetare_parola');
  const b = await browser();
  const verificare = await b.get(`/api/auth/resetare/${token}`);
  assert.equal(verificare.status, 200);
  assert.equal(verificare.date.email, cont.email);

  const diferite = await b.post('/api/auth/resetare', { token, parola_noua: 'ParolaNoua123', confirmare: 'AltaParola123' });
  assert.equal(diferite.status, 400);
  assert.ok(diferite.date.erori.confirmare);
  assert.equal((await b.get(`/api/auth/resetare/${token}`)).status, 200); // o greseala nu "consuma" linkul

  assert.equal((await b.post('/api/auth/resetare', { token, parola_noua: 'ParolaNoua123', confirmare: 'ParolaNoua123' })).status, 200);
  assert.equal((await b.post('/api/auth/resetare', { token, parola_noua: 'AltaNoua1234', confirmare: 'AltaNoua1234' })).status, 400); // o singura data

  assert.equal((await conectat.get('/api/auth/eu')).status, 401); // sesiunea veche a fost inchisa
  assert.equal((await new Browser(aplicatie.url).conecteaza(cont.email, cont.parola)).status, 401); // parola veche nu mai merge
  assert.equal((await new Browser(aplicatie.url).conecteaza(cont.email, 'ParolaNoua123')).status, 200);
});
