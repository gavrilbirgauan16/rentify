// Teste de integrare pentru API-ul proprietarului: proprietatile lui (si, mai jos, anunturile lui).
// Ruleaza cu: npm run test:integrare (pe baza rentify_test). Un proprietar nou are planul Gratuit: 1 proprietate, 1 anunt.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pornesteAplicatia, Browser, creeazaUtilizator, creeazaProprietate, creeazaAnunt } = require('./ajutor');
const AnuntAccessor = require('../../src/NivelAccesDate/AnuntAccessor');

const anunturi = new AnuntAccessor();

let aplicatie;
before(async () => { aplicatie = await pornesteAplicatia(); });
after(async () => { await aplicatie.opreste(); });

async function conectat(rol = 'proprietar') {
  const cont = await creeazaUtilizator(rol);
  const b = new Browser(aplicatie.url);
  await b.conecteaza(cont.email, cont.parola);
  return { cont, b };
}

const proprietateNoua = (extra = {}) => ({
  denumire: 'Garsoniera centru', tip: 'garsoniera', judet: 'Suceava', oras: 'Suceava', zona: 'Centru',
  nr_camere: 1, suprafata_mp: 32.5, max_locatari: 2, are_balcon: true, stare: 'liber', ...extra,
});

// ===== Proprietatile =====

test('adaugarea: 201 pentru prima; planul Gratuit (1 proprietate) blocheaza a doua cu 403', async () => {
  const { b } = await conectat();
  const prima = await b.post('/api/proprietar/proprietati', proprietateNoua());
  assert.equal(prima.status, 201);
  assert.equal(prima.date.are_balcon, true);
  assert.equal(prima.date.suprafata_mp, 32.5);

  const aDoua = await b.post('/api/proprietar/proprietati', proprietateNoua({ denumire: 'A doua' }));
  assert.equal(aDoua.status, 403);
  assert.match(aDoua.date.eroare, /Gratuit/);

  const lista = await b.get('/api/proprietar/proprietati');
  assert.equal(lista.date.proprietati.length, 1);
  assert.deepEqual(lista.date.limita, { plan: 'Gratuit', folosite: 1, maxim: 1, poate_adauga: false });
});

test('proprietarul vine din sesiune: un proprietar_id trimis in cerere e ignorat', async () => {
  const { b } = await conectat();
  const altul = await creeazaUtilizator('proprietar');
  const r = await b.post('/api/proprietar/proprietati', proprietateNoua({ proprietar_id: altul.id }));
  assert.equal(r.status, 201);
  const a = new Browser(aplicatie.url);
  await a.conecteaza(altul.email, altul.parola);
  assert.equal((await a.get('/api/proprietar/proprietati')).date.proprietati.length, 0); // nu i-a "daruit-o" celuilalt
  assert.equal((await b.get(`/api/proprietar/proprietati/${r.date.id}`)).status, 200); // e a celui conectat
});

test('validarea: date lipsa sau starea "inactiv" din formular -> 400', async () => {
  const { b } = await conectat();
  const r = await b.post('/api/proprietar/proprietati', proprietateNoua({ denumire: '', oras: '', stare: 'inactiv' }));
  assert.equal(r.status, 400);
  assert.ok(r.date.erori.denumire && r.date.erori.oras && r.date.erori.stare);
});

test('IDOR: alt proprietar nu poate vedea, modifica sau dezactiva proprietatea mea (404)', async () => {
  const { b } = await conectat();
  const mea = (await b.post('/api/proprietar/proprietati', proprietateNoua())).date;
  const { b: strain } = await conectat();
  assert.equal((await strain.get(`/api/proprietar/proprietati/${mea.id}`)).status, 404);
  assert.equal((await strain.cere('PUT', `/api/proprietar/proprietati/${mea.id}`, proprietateNoua({ denumire: 'Furata' }))).status, 404);
  assert.equal((await strain.post(`/api/proprietar/proprietati/${mea.id}/dezactiveaza`)).status, 404);
  assert.equal((await b.get(`/api/proprietar/proprietati/${mea.id}`)).date.denumire, 'Garsoniera centru'); // neatinsa
});

test('dezactivarea scoate si anunturile; reactivarea NU le reactiveaza; limita blocheaza reactivarea', async () => {
  const { cont, b } = await conectat();
  const p = await creeazaProprietate(cont.id);
  const anunt = await creeazaAnunt(p.id);

  const dez = await b.post(`/api/proprietar/proprietati/${p.id}/dezactiveaza`);
  assert.equal(dez.status, 200);
  assert.equal(dez.date.anunturi_dezactivate, 1);
  assert.equal((await anunturi.getById(anunt.id)).stare, 'inactiv');

  // Cu prima proprietate inactiva, planul Gratuit permite una noua...
  assert.equal((await b.post('/api/proprietar/proprietati', proprietateNoua())).status, 201);
  // ...dar acum reactivarea primei ar depasi limita
  assert.equal((await b.post(`/api/proprietar/proprietati/${p.id}/activeaza`)).status, 403);
});

test('reactivarea (cand planul permite): proprietatea revine, anunturile ei raman inactive', async () => {
  const { cont, b } = await conectat();
  const p = await creeazaProprietate(cont.id);
  const anunt = await creeazaAnunt(p.id);
  await b.post(`/api/proprietar/proprietati/${p.id}/dezactiveaza`);
  const act = await b.post(`/api/proprietar/proprietati/${p.id}/activeaza`);
  assert.equal(act.status, 200);
  assert.equal(act.date.proprietate.stare, 'liber');
  assert.equal((await anunturi.getById(anunt.id)).stare, 'inactiv'); // le activeaza el, cu limita verificata
});

test('un chirias nu are acces la proprietati (403)', async () => {
  const { b } = await conectat('chirias');
  assert.equal((await b.get('/api/proprietar/proprietati')).status, 403);
});
