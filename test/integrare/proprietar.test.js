// Teste de integrare pentru API-ul proprietarului: proprietatile lui (si, mai jos, anunturile lui).
// Ruleaza cu: npm run test:integrare (pe baza rentify_test). Un proprietar nou are planul Gratuit: 1 proprietate, 1 anunt.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pornesteAplicatia, Browser, creeazaUtilizator, creeazaProprietate, creeazaAnunt, pozaPng, pozaFalsa } = require('./ajutor');
const AnuntAccessor = require('../../src/NivelAccesDate/AnuntAccessor');

const anunturi = new AnuntAccessor();

// Pozele se salveaza in acelasi folder ca ale aplicatiei (uploads/anunturi). Retinem ce era la inceput
// si la final stergem DOAR pozele aparute in timpul testelor (sa nu ramana fisiere orfane).
const FOLDER_POZE = path.join(__dirname, '..', '..', 'uploads', 'anunturi');
const pozePeDisc = () => (fs.existsSync(FOLDER_POZE) ? fs.readdirSync(FOLDER_POZE) : []);
let pozeLaInceput;

let aplicatie;
before(async () => { aplicatie = await pornesteAplicatia(); pozeLaInceput = new Set(pozePeDisc()); });
after(async () => {
  for (const f of pozePeDisc()) if (!pozeLaInceput.has(f)) fs.unlinkSync(path.join(FOLDER_POZE, f));
  await aplicatie.opreste();
});

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

// ===== Anunturile proprietarului =====

// O proprietate a proprietarului conectat (prin API) si datele unui anunt pe ea.
async function cuProprietate() {
  const { cont, b } = await conectat();
  const p = (await b.post('/api/proprietar/proprietati', proprietateNoua())).date;
  const anunt = (extra = {}) => ({
    proprietate_id: p.id, tip: 'inchiriere', titlu: 'Garsoniera langa USV', descriere: 'Luminoasa', pret: 1200, moneda: 'RON', stare: 'activ', ...extra,
  });
  return { cont, b, p, anunt };
}

test('anunt nou cu "Publica" -> In asteptare (nu direct pe site); "promovat" trimis e ignorat', async () => {
  const { b, anunt } = await cuProprietate();
  const r = await b.post('/api/proprietar/anunturi', anunt({ promovat: true }));
  assert.equal(r.status, 201);
  assert.equal(r.date.stare, 'in_asteptare');
  assert.equal(r.date.aprobat, false);
  assert.equal(r.date.promovat, false);
});

test('limita planului Gratuit (1 anunt publicat): al doilea "Publica" -> 400, dar ca Ciorna merge', async () => {
  const { b, anunt } = await cuProprietate();
  await b.post('/api/proprietar/anunturi', anunt());
  const alDoilea = await b.post('/api/proprietar/anunturi', anunt({ titlu: 'Al doilea' }));
  assert.equal(alDoilea.status, 400);
  assert.match(alDoilea.date.erori.stare, /Gratuit/);
  const ciorna = await b.post('/api/proprietar/anunturi', anunt({ titlu: 'Ciorna', stare: 'ciorna' }));
  assert.equal(ciorna.status, 201);
  assert.equal(ciorna.date.stare, 'ciorna');
});

test('IDOR: anunt pe proprietatea altuia -> 400; anuntul altuia nu se vede si nu se schimba (404)', async () => {
  const { b, anunt } = await cuProprietate();
  const alMeu = (await b.post('/api/proprietar/anunturi', anunt({ stare: 'ciorna' }))).date;
  const { b: strain, anunt: anuntStrain } = await cuProprietate();

  const peCasaMea = await strain.post('/api/proprietar/anunturi', anuntStrain({ proprietate_id: alMeu.proprietate.id }));
  assert.equal(peCasaMea.status, 400);
  assert.ok(peCasaMea.date.erori.proprietate_id);
  assert.equal((await strain.get(`/api/proprietar/anunturi/${alMeu.id}`)).status, 404);
  assert.equal((await strain.cere('PUT', `/api/proprietar/anunturi/${alMeu.id}`, anuntStrain())).status, 404);
  assert.equal((await strain.post(`/api/proprietar/anunturi/${alMeu.id}/publica`)).status, 404);
  assert.equal((await strain.post(`/api/proprietar/anunturi/${alMeu.id}/retrage`)).status, 404);
});

test('moderarea: aprobat + salvat fara schimbari -> ramane activ; pret schimbat -> inapoi la aprobare', async () => {
  const { b, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt())).date;
  assert.ok(await anunturi.aproba(creat.id)); // adminul il aproba

  const neschimbat = await b.cere('PUT', `/api/proprietar/anunturi/${creat.id}`, anunt());
  assert.equal(neschimbat.status, 200);
  assert.equal(neschimbat.date.stare, 'activ');
  assert.equal(neschimbat.date.aprobat, true);

  const altPret = await b.cere('PUT', `/api/proprietar/anunturi/${creat.id}`, anunt({ pret: 999 }));
  assert.equal(altPret.date.stare, 'in_asteptare');
  assert.equal(altPret.date.aprobat, false);
});

test('retras si republicat fara modificari -> direct activ (aprobarea s-a pastrat)', async () => {
  const { b, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt())).date;
  await anunturi.aproba(creat.id);
  assert.equal((await b.post(`/api/proprietar/anunturi/${creat.id}/retrage`)).date.stare, 'inactiv');
  assert.equal((await b.post(`/api/proprietar/anunturi/${creat.id}/publica`)).date.stare, 'activ');
});

test('pe o proprietate inactiva anuntul nu poate fi publicat (409)', async () => {
  const { b, p, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt({ stare: 'ciorna' }))).date;
  await b.post(`/api/proprietar/proprietati/${p.id}/dezactiveaza`);
  assert.equal((await b.post(`/api/proprietar/anunturi/${creat.id}/publica`)).status, 409);
});

// ===== Pozele anunturilor =====

test('pozele: adaugare (201) si stergere; poza stearsa dispare si de pe disc', async () => {
  const { b, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt({ stare: 'ciorna' }))).date;
  const r = await b.trimiteFisiere(`/api/proprietar/anunturi/${creat.id}/imagini`, [pozaPng('a.png'), pozaPng('b.png')]);
  assert.equal(r.status, 201);
  assert.equal(r.date.imagini.length, 2);
  const [prima] = r.date.imagini;
  const peDisc = path.join(FOLDER_POZE, path.basename(prima.url));
  assert.ok(fs.existsSync(peDisc));

  const sters = await b.delete(`/api/proprietar/anunturi/${creat.id}/imagini/${prima.id}`);
  assert.equal(sters.status, 200);
  assert.equal(sters.date.imagini.length, 1);
  assert.equal(fs.existsSync(peDisc), false);
});

test('pozele sunt verificate dupa continut: un fisier text redenumit .png e refuzat si nu ramane pe disc', async () => {
  const { b, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt({ stare: 'ciorna' }))).date;
  const inainte = pozePeDisc().length;
  const r = await b.trimiteFisiere(`/api/proprietar/anunturi/${creat.id}/imagini`, [pozaFalsa()]);
  assert.equal(r.status, 400);
  assert.ok(r.date.erori.imagini);
  assert.equal(pozePeDisc().length, inainte);
});

test('cel mult 6 poze pe anunt', async () => {
  const { b, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt({ stare: 'ciorna' }))).date;
  await b.trimiteFisiere(`/api/proprietar/anunturi/${creat.id}/imagini`, [1, 2, 3, 4, 5].map((i) => pozaPng(`${i}.png`)));
  const inainte = pozePeDisc().length;
  const prea = await b.trimiteFisiere(`/api/proprietar/anunturi/${creat.id}/imagini`, [pozaPng('6.png'), pozaPng('7.png')]);
  assert.equal(prea.status, 400);
  assert.match(prea.date.erori.imagini, /cel mult 6/);
  assert.equal(pozePeDisc().length, inainte); // pozele refuzate s-au sters
});

test('moderarea: o poza noua la un anunt aprobat il trimite inapoi la aprobare', async () => {
  const { b, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt())).date;
  await anunturi.aproba(creat.id);
  const r = await b.trimiteFisiere(`/api/proprietar/anunturi/${creat.id}/imagini`, [pozaPng()]);
  assert.equal(r.status, 201);
  assert.equal(r.date.stare, 'in_asteptare');
  assert.equal(r.date.aprobat, false);
});

test('IDOR la poze: alt proprietar nu poate adauga sau sterge poze la anuntul meu; nimic nu ramane pe disc', async () => {
  const { b, anunt } = await cuProprietate();
  const creat = (await b.post('/api/proprietar/anunturi', anunt({ stare: 'ciorna' }))).date;
  const poza = (await b.trimiteFisiere(`/api/proprietar/anunturi/${creat.id}/imagini`, [pozaPng()])).date.imagini[0];
  const { b: strain } = await cuProprietate();

  const inainte = pozePeDisc().length;
  assert.equal((await strain.trimiteFisiere(`/api/proprietar/anunturi/${creat.id}/imagini`, [pozaPng()])).status, 404);
  assert.equal(pozePeDisc().length, inainte); // poza urcata de strain s-a sters
  assert.equal((await strain.delete(`/api/proprietar/anunturi/${creat.id}/imagini/${poza.id}`)).status, 404);

  // O poza a anuntului A nu se poate sterge prin adresa altui anunt (B), nici macar al aceluiasi proprietar.
  const alDoilea = (await b.post('/api/proprietar/anunturi', anunt({ titlu: 'Al doilea', stare: 'ciorna' }))).date;
  assert.equal((await b.delete(`/api/proprietar/anunturi/${alDoilea.id}/imagini/${poza.id}`)).status, 404);
  assert.equal((await b.get(`/api/proprietar/anunturi/${creat.id}`)).date.imagini.length, 1); // poza a ramas
});

test('un chirias nu poate urca poze (oprit inainte de incarcare)', async () => {
  const chirias = await creeazaUtilizator('chirias');
  const b = new Browser(aplicatie.url);
  await b.conecteaza(chirias.email, chirias.parola);
  const inainte = pozePeDisc().length;
  assert.equal((await b.trimiteFisiere('/api/proprietar/anunturi/1/imagini', [pozaPng()])).status, 403);
  assert.equal(pozePeDisc().length, inainte);
});
