// Teste de integrare pentru "Contul meu" prin API: profilul, schimbarea parolei, schimbarea emailului.
// Ruleaza cu: npm run test:integrare (pe baza rentify_test).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pornesteAplicatia, Browser, creeazaUtilizator, unic } = require('./ajutor');
// Serviciul de tokenuri si accesorii, construiti de containerul DI - exact ca in aplicatie (laboratorul 10).
const { container } = require('../../infrastructura/container');

const scop = container.createScope();
const tokenuri = scop.resolve('tokenuri');
const { hashParola } = require('../../servicii/parole');

const utilizatori = scop.resolve('utilizatorAccessor');

let aplicatie;
before(async () => { aplicatie = await pornesteAplicatia(); });
after(async () => { await aplicatie.opreste(); });

// Un utilizator nou, deja conectat intr-un "browser".
async function conectat(rol = 'chirias') {
  const cont = await creeazaUtilizator(rol);
  const b = new Browser(aplicatie.url);
  await b.conecteaza(cont.email, cont.parola);
  return { cont, b };
}

test('profilul: se vede fara parola; validarea e aceeasi ca la pagina; datele se salveaza', async () => {
  const { cont, b } = await conectat('proprietar');
  const p = await b.get('/api/cont');
  assert.equal(p.status, 200);
  assert.equal(p.date.email, cont.email);
  assert.equal(p.date.rol, 'proprietar');
  assert.ok(!('parola_hash' in p.date) && !('parola' in p.date));

  const fara = await b.cere('PUT', '/api/cont', { prenume: 'Ion', nume: 'Pop', telefon: '', oras: '' });
  assert.equal(fara.status, 400);
  assert.ok(fara.date.erori.telefon, 'proprietarul trebuie sa aiba telefon');

  const bun = await b.cere('PUT', '/api/cont', { prenume: 'Ion', nume: 'Pop', telefon: '0744 555 666', oras: 'Iasi' });
  assert.equal(bun.status, 200);
  assert.equal(bun.date.prenume, 'Ion');
  assert.equal(bun.date.telefon, '0744555666'); // salvat in forma 07xxxxxxxx
  assert.equal(bun.date.email, cont.email); // emailul NU se schimba de aici
});

test('parola: verificarile (parola curenta, aceeasi parola, confirmare), apoi schimbarea', async () => {
  const { cont, b } = await conectat();
  const cere = (corp) => b.post('/api/cont/parola', corp);
  assert.ok((await cere({ parola_curenta: 'gresita', parola_noua: 'ParolaNoua123', confirmare: 'ParolaNoua123' })).date.erori.parola_curenta);
  assert.ok((await cere({ parola_curenta: cont.parola, parola_noua: cont.parola, confirmare: cont.parola })).date.erori.parola_noua);
  assert.ok((await cere({ parola_curenta: cont.parola, parola_noua: 'ParolaNoua123', confirmare: 'Alta123456' })).date.erori.confirmare);

  const r = await cere({ parola_curenta: cont.parola, parola_noua: 'ParolaNoua123', confirmare: 'ParolaNoua123' });
  assert.equal(r.status, 200);
  assert.ok(r.date.csrfToken, 'sesiune noua -> token CSRF nou');
});

test('dupa schimbarea parolei: celelalte sesiuni se inchid, sesiunea curenta ramane (cu tokenul nou)', async () => {
  const { cont, b } = await conectat();
  const altDispozitiv = new Browser(aplicatie.url);
  await altDispozitiv.conecteaza(cont.email, cont.parola);

  const r = await b.post('/api/cont/parola', { parola_curenta: cont.parola, parola_noua: 'ParolaNoua123', confirmare: 'ParolaNoua123' });
  b.csrf = r.date.csrfToken;

  assert.equal((await altDispozitiv.get('/api/auth/eu')).status, 401); // scos afara
  assert.equal((await b.get('/api/auth/eu')).status, 200); // aici ramane conectat
  assert.equal((await b.cere('PUT', '/api/cont', { prenume: 'Ana', nume: 'Test', telefon: '', oras: '' })).status, 200); // tokenul nou merge
  assert.equal((await new Browser(aplicatie.url).conecteaza(cont.email, cont.parola)).status, 401); // parola veche nu
  assert.equal((await new Browser(aplicatie.url).conecteaza(cont.email, 'ParolaNoua123')).status, 200);
});

test('parola temporara de la admin: restul API-ului e blocat, dar schimbarea parolei merge', async () => {
  const cont = await creeazaUtilizator('chirias');
  await utilizatori.seteazaParola(cont.id, await hashParola('Temporara123'), { temporara: true }); // ca adminul
  const b = new Browser(aplicatie.url);
  await b.conecteaza(cont.email, 'Temporara123');

  const blocat = await b.get('/api/cont');
  assert.equal(blocat.status, 403);
  assert.equal(blocat.date.schimba_parola, true);

  const r = await b.post('/api/cont/parola', { parola_curenta: 'Temporara123', parola_noua: 'ParolaMea123', confirmare: 'ParolaMea123' });
  assert.equal(r.status, 200);
  b.csrf = r.date.csrfToken;
  assert.equal((await b.get('/api/cont')).status, 200); // deblocat
});

test('emailul: verificari, link pe adresa noua, confirmare o singura data, login cu adresa noua', async () => {
  const { cont, b } = await conectat();
  const alt = await creeazaUtilizator('chirias');
  const nou = `schimbat.${unic()}@test.rentify`;

  assert.ok((await b.post('/api/cont/email', { email: nou, parola_curenta: 'gresita' })).date.erori.parola_curenta);
  assert.ok((await b.post('/api/cont/email', { email: cont.email, parola_curenta: cont.parola })).date.erori.email); // aceeasi
  assert.ok((await b.post('/api/cont/email', { email: alt.email, parola_curenta: cont.parola })).date.erori.email); // folosita

  const cerere = await b.post('/api/cont/email', { email: nou, parola_curenta: cont.parola });
  assert.equal(cerere.status, 202);
  assert.equal((await b.get('/api/cont')).date.email, cont.email); // inca neschimbat: abia dupa confirmare

  const token = await tokenuri.creeaza(cont.id, 'schimbare_email', nou); // linkul din email
  const anonim = new Browser(aplicatie.url); // confirmarea merge si fara sa fii conectat (deschizi emailul pe telefon)
  const confirmat = await anonim.post('/api/cont/email/confirmare', { token });
  assert.equal(confirmat.status, 200);
  assert.equal(confirmat.date.email, nou);
  assert.equal((await anonim.post('/api/cont/email/confirmare', { token })).status, 400); // o singura data

  assert.equal((await b.get('/api/cont')).date.email, nou);
  assert.equal((await new Browser(aplicatie.url).conecteaza(nou, cont.parola)).status, 200);
});
