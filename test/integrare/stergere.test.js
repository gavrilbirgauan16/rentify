// Teste de integrare pentru stergerea LOGICA a anunturilor (laboratorul 9): un anunt sters nu mai apare nicaieri
// (Get si GetAll), dar ramane in baza de date si poate fi restaurat de admin.
// Ruleaza cu: npm run test:integrare (pe baza rentify_test).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pornesteAplicatia, Browser, creeazaUtilizator, creeazaProprietate, creeazaAnunt } = require('./ajutor');
const context = require('../../src/Repository_CodeFirst/context');

let aplicatie;
before(async () => { aplicatie = await pornesteAplicatia(); });
after(() => aplicatie.opreste());

async function conectat(rol) {
  const cont = await creeazaUtilizator(rol);
  const b = new Browser(aplicatie.url);
  await b.conecteaza(cont.email, cont.parola);
  return { cont, b };
}

// Un proprietar conectat, cu o proprietate (oras unic) si un anunt activ pe ea.
async function proprietarCuAnunt(stare = 'activ') {
  const { cont, b } = await conectat('proprietar');
  const proprietate = await creeazaProprietate(cont.id);
  const anunt = await creeazaAnunt(proprietate.id, { stare });
  return { b, proprietate, anunt };
}

// Cerere cu cheia API (laboratorul 7), ca un program extern (Postman).
const cuCheie = (adresa) => fetch(aplicatie.url + adresa, { headers: { 'x-api-key': process.env.API_KEY } });

const dinBaza = (id) => context.anunt.findUnique({ where: { id } });

test('proprietarul sterge: 204; anuntul ramane in baza (sters_la completat, scos de pe site)', async () => {
  const { b, anunt } = await proprietarCuAnunt();
  const r = await b.delete(`/api/proprietar/anunturi/${anunt.id}`);
  assert.equal(r.status, 204);

  const rand = await dinBaza(anunt.id);
  assert.ok(rand, 'randul nu trebuie sters fizic');
  assert.ok(rand.sters_la instanceof Date);
  assert.equal(rand.stare, 'inactiv'); // era activ: regula anunt_sters_check nu-l lasa pe site
});

test('dupa stergere, pentru proprietar anuntul nu mai exista: lista, Get, PUT, Publica, al doilea DELETE -> 404', async () => {
  const { b, anunt } = await proprietarCuAnunt('ciorna');
  await b.delete(`/api/proprietar/anunturi/${anunt.id}`);

  const lista = await b.get('/api/proprietar/anunturi');
  assert.equal(lista.date.anunturi.some((a) => a.id === anunt.id), false);
  assert.equal((await b.get(`/api/proprietar/anunturi/${anunt.id}`)).status, 404);
  assert.equal((await b.cere('PUT', `/api/proprietar/anunturi/${anunt.id}`, { titlu: 'Inapoi?' })).status, 404);
  assert.equal((await b.post(`/api/proprietar/anunturi/${anunt.id}/publica`)).status, 404);
  assert.equal((await b.delete(`/api/proprietar/anunturi/${anunt.id}`)).status, 404);
});

test('dispare si public: din cautare, din pagina anuntului si din API-ul cu cheie (laboratorul 7)', async () => {
  const { b, proprietate, anunt } = await proprietarCuAnunt();
  const vizitator = new Browser(aplicatie.url);
  const cautare = `/api/anunturi?oras=${encodeURIComponent(proprietate.oras)}`;
  assert.deepEqual((await vizitator.get(cautare)).date.map((a) => a.id), [anunt.id]); // inainte: apare

  await b.delete(`/api/proprietar/anunturi/${anunt.id}`);
  assert.deepEqual((await vizitator.get(cautare)).date, []);
  assert.equal((await vizitator.get(`/api/anunturi/${anunt.id}`)).status, 404);

  assert.equal((await cuCheie(`/api/anunturi/${anunt.id}`)).status, 404); // Get(id) cu cheie
  const toate = await (await cuCheie('/api/anunturi')).json(); // GetAll cu cheie (inclusiv ciorne si inactive)
  assert.equal(toate.some((a) => a.id === anunt.id), false);
});

test('chiriasul: anuntul sters dispare din favorite si nu mai poate fi salvat sau contactat', async () => {
  const { b: proprietar, anunt } = await proprietarCuAnunt();
  const { b: chirias } = await conectat('chirias');
  assert.equal((await chirias.post(`/api/favorite/${anunt.id}`)).status, 201);

  await proprietar.delete(`/api/proprietar/anunturi/${anunt.id}`);
  const favorite = await chirias.get('/api/favorite');
  assert.equal(favorite.date.some((a) => a.id === anunt.id), false);
  assert.equal((await chirias.post(`/api/favorite/${anunt.id}`)).status, 404);
  assert.equal((await chirias.post(`/api/anunturi/${anunt.id}/contact`)).status, 404);
  // randul din "favorit" a ramas (istoric), doar nu se mai vede
  assert.equal(await context.favorit.count({ where: { anunt_id: anunt.id } }), 1);
});

test('stergerea elibereaza locul din plan (Gratuit = 1 anunt publicat)', async () => {
  const { b, proprietate, anunt } = await proprietarCuAnunt();
  const alDoilea = await creeazaAnunt(proprietate.id, { stare: 'ciorna' });
  assert.equal((await b.post(`/api/proprietar/anunturi/${alDoilea.id}/publica`)).status, 403); // planul e plin

  await b.delete(`/api/proprietar/anunturi/${anunt.id}`);
  const r = await b.post(`/api/proprietar/anunturi/${alDoilea.id}/publica`);
  assert.equal(r.status, 200);
  assert.equal(r.date.stare, 'in_asteptare');
});

test('IDOR si roluri: anuntul altuia -> 404 (si ramane neatins); chirias -> 403; neconectat -> 401', async () => {
  const { anunt } = await proprietarCuAnunt();
  const { b: altul } = await conectat('proprietar');
  assert.equal((await altul.delete(`/api/proprietar/anunturi/${anunt.id}`)).status, 404);
  assert.equal((await dinBaza(anunt.id)).sters_la, null);

  const { b: chirias } = await conectat('chirias');
  assert.equal((await chirias.delete(`/api/proprietar/anunturi/${anunt.id}`)).status, 403);
  assert.equal((await new Browser(aplicatie.url).delete(`/api/proprietar/anunturi/${anunt.id}`)).status, 401);
});

test('baza de date refuza un anunt sters care sa fie activ (aparare in adancime: anunt_sters_check)', async () => {
  const { b, anunt } = await proprietarCuAnunt();
  await b.delete(`/api/proprietar/anunturi/${anunt.id}`);
  await assert.rejects(context.anunt.update({ where: { id: anunt.id }, data: { stare: 'activ' } }));
});

test('adminul vede anuntul la "Sterse" si il restaureaza ca ciorna (o singura data), cu nota in jurnal', async () => {
  const { b: proprietar, anunt } = await proprietarCuAnunt();
  await proprietar.delete(`/api/proprietar/anunturi/${anunt.id}`);
  const { cont: contAdmin, b: admin } = await conectat('admin');

  assert.equal((await admin.get('/admin/anunturi')).date.includes(anunt.titlu), false); // lista obisnuita: nu
  assert.equal((await admin.get('/admin/anunturi?sterse=da')).date.includes(anunt.titlu), true); // la "Sterse": da

  await admin.post(`/admin/anunturi/${anunt.id}/restaureaza`);
  const rand = await dinBaza(anunt.id);
  assert.equal(rand.sters_la, null);
  assert.equal(rand.stare, 'ciorna');
  assert.equal(rand.aprobat_la, null); // trebuie aprobat din nou inainte sa reapara pe site
  assert.equal(await context.jurnal_admin.count({ where: { admin_id: contAdmin.id, actiune: 'restaurare', entitate_id: anunt.id } }), 1);

  // Proprietarul il vede din nou (ca ciorna); o a doua restaurare nu mai schimba nimic.
  assert.equal((await proprietar.get(`/api/proprietar/anunturi/${anunt.id}`)).status, 200);
  await admin.post(`/admin/anunturi/${anunt.id}/restaureaza`);
  assert.equal(await context.jurnal_admin.count({ where: { actiune: 'restaurare', entitate_id: anunt.id } }), 1);
});

test('restaurarea e doar pentru admin: proprietarul nu poate apela pagina adminului', async () => {
  const { b, anunt } = await proprietarCuAnunt();
  await b.delete(`/api/proprietar/anunturi/${anunt.id}`);
  await b.post(`/admin/anunturi/${anunt.id}/restaureaza`);
  assert.ok((await dinBaza(anunt.id)).sters_la, 'a ramas sters');
});
