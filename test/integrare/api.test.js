// Teste de integrare pentru API: cereri reale, prin toata aplicatia (rute -> controllere -> accesori -> PostgreSQL).
// Ruleaza cu: npm run test:integrare (pe baza rentify_test, niciodata pe datele tale).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pornesteAplicatia, Browser, creeazaUtilizator, creeazaProprietate, creeazaAnunt } = require('./ajutor');
// Accesorii ii construieste containerul DI, exact ca in aplicatie (laboratorul 10).
const { container } = require('../../infrastructura/container');
const scop = container.createScope();

let aplicatie;
before(async () => { aplicatie = await pornesteAplicatia(); });
after(async () => { await aplicatie.opreste(); });

const browser = () => new Browser(aplicatie.url);

// ===== Cautarea publica si pagina anuntului =====

test('cautarea publica arata doar anunturile active; paginarea vine in antete', async () => {
  const proprietar = await creeazaUtilizator('proprietar');
  const p = await creeazaProprietate(proprietar.id);
  const activ = await creeazaAnunt(p.id, { stare: 'activ', pret: 900 });
  await creeazaAnunt(p.id, { stare: 'ciorna' });
  await creeazaAnunt(p.id, { stare: 'in_asteptare' });

  const r = await browser().get(`/api/anunturi?oras=${encodeURIComponent(p.oras)}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.date.map((a) => a.id), [activ.id]);
  assert.equal(r.antete.get('x-total-count'), '1');
  assert.ok(!JSON.stringify(r.date).includes('0711222333'), 'telefonul nu apare in cautare');
});

test('pagina unui anunt: cel public se vede si numara vizualizarea; o ciorna da 404', async () => {
  const proprietar = await creeazaUtilizator('proprietar');
  const p = await creeazaProprietate(proprietar.id);
  const activ = await creeazaAnunt(p.id);
  const ciorna = await creeazaAnunt(p.id, { stare: 'ciorna' });

  const r = await browser().get(`/api/anunturi/${activ.id}`);
  assert.equal(r.status, 200);
  assert.equal(r.date.vizualizari, 1);
  assert.equal((await browser().get(`/api/anunturi/${ciorna.id}`)).status, 404);
});

// ===== Autentificarea =====

test('login: acelasi mesaj pentru email inexistent si parola gresita; apoi eu / logout', async () => {
  const chirias = await creeazaUtilizator('chirias');
  const b = browser();
  const gresit = await b.conecteaza(chirias.email, 'parola-gresita');
  const inexistent = await b.conecteaza('nimeni@test.rentify', 'parola-gresita');
  assert.equal(gresit.status, 401);
  assert.deepEqual(gresit.date, inexistent.date);

  assert.equal((await b.conecteaza(chirias.email, chirias.parola)).status, 200);
  const eu = await b.get('/api/auth/eu');
  assert.equal(eu.status, 200);
  assert.equal(eu.date.utilizator.email, chirias.email);
  // Fara parola si fara amprenta ei. (Nu cautam cuvantul "parola" oriunde: campul "schimba_parola" e corect si necesar.)
  const u = eu.date.utilizator;
  assert.ok(!('parola' in u) && !('parola_hash' in u), 'fara campurile parola / parola_hash');
  assert.ok(!JSON.stringify(eu.date).includes(chirias.parola), 'parola reala nu apare in raspuns');
  assert.equal(u.schimba_parola, false);

  assert.equal((await b.post('/api/auth/logout')).status, 204);
  assert.equal((await b.get('/api/auth/eu')).status, 401);
});

test('o cerere din browser fara token CSRF e refuzata, chiar daca utilizatorul e conectat', async () => {
  const chirias = await creeazaUtilizator('chirias');
  const b = browser();
  await b.conecteaza(chirias.email, chirias.parola);
  b.csrf = ''; // "uitam" tokenul, ca un site strain care incearca sa trimita cererea in numele lui
  assert.equal((await b.get('/api/favorite')).status, 200); // citirea merge
  assert.equal((await b.post('/api/favorite/1')).status, 403); // modificarea nu
});

// ===== Contactarea proprietarului (limita din plan) =====

test('contactarea: prima cerere consuma, acelasi anunt din nou nu mai consuma', async () => {
  const proprietar = await creeazaUtilizator('proprietar');
  const anunt = await creeazaAnunt((await creeazaProprietate(proprietar.id)).id);
  const chirias = await creeazaUtilizator('chirias');
  const b = browser();
  await b.conecteaza(chirias.email, chirias.parola);

  assert.equal((await b.get('/api/contactari')).date.ramase, 5);
  const prima = await b.post(`/api/anunturi/${anunt.id}/contact`);
  assert.equal(prima.status, 200);
  assert.equal(prima.date.telefon, '0711222333');
  assert.equal(prima.date.contactari.ramase, 4);
  const aDoua = await b.post(`/api/anunturi/${anunt.id}/contact`);
  assert.equal(aDoua.date.contactari.ramase, 4);
});

test('contactarea: dupa 5 anunturi diferite, al 6-lea e refuzat, dar cele deja contactate se vad in continuare', async () => {
  const proprietar = await creeazaUtilizator('proprietar');
  const p = await creeazaProprietate(proprietar.id);
  const ids = [];
  for (let i = 0; i < 6; i += 1) ids.push((await creeazaAnunt(p.id)).id);
  const chirias = await creeazaUtilizator('chirias');
  const b = browser();
  await b.conecteaza(chirias.email, chirias.parola);

  for (const id of ids.slice(0, 5)) assert.equal((await b.post(`/api/anunturi/${id}/contact`)).status, 200);
  const alSaselea = await b.post(`/api/anunturi/${ids[5]}/contact`);
  assert.equal(alSaselea.status, 403);
  assert.equal(alSaselea.date.contactari.ramase, 0);
  assert.equal((await b.post(`/api/anunturi/${ids[0]}/contact`)).status, 200);
});

test('contactarea: doar chiriasul conectat; anunt care nu e public -> 404', async () => {
  const proprietar = await creeazaUtilizator('proprietar');
  const p = await creeazaProprietate(proprietar.id);
  const anunt = await creeazaAnunt(p.id);
  const ciorna = await creeazaAnunt(p.id, { stare: 'ciorna' });

  const anonim = await browser().pregateste();
  assert.equal((await anonim.post(`/api/anunturi/${anunt.id}/contact`)).status, 401);

  const caProprietar = browser();
  await caProprietar.conecteaza(proprietar.email, proprietar.parola);
  assert.equal((await caProprietar.post(`/api/anunturi/${anunt.id}/contact`)).status, 403);

  const chirias = await creeazaUtilizator('chirias');
  const b = browser();
  await b.conecteaza(chirias.email, chirias.parola);
  assert.equal((await b.post(`/api/anunturi/${ciorna.id}/contact`)).status, 404);
});

// ===== Favoritele =====

test('favoritele: adaugare (201, apoi 200), lista, anunt devenit indisponibil, stergere', async () => {
  const proprietar = await creeazaUtilizator('proprietar');
  const p = await creeazaProprietate(proprietar.id);
  const anunt = await creeazaAnunt(p.id);
  const ciorna = await creeazaAnunt(p.id, { stare: 'ciorna' });
  const chirias = await creeazaUtilizator('chirias');
  const b = browser();
  await b.conecteaza(chirias.email, chirias.parola);

  assert.equal((await b.post(`/api/favorite/${anunt.id}`)).status, 201);
  assert.equal((await b.post(`/api/favorite/${anunt.id}`)).status, 200); // era deja: fara dublura
  assert.equal((await b.post(`/api/favorite/${ciorna.id}`)).status, 404); // nu e public

  let lista = (await b.get('/api/favorite')).date;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].disponibil, true);
  assert.equal(lista[0].proprietar, 'Test proprietar'); // aceleasi date ca la cautare

  await scop.resolve('anuntAccessor').schimbaStare(anunt.id, 'inactiv'); // proprietarul il scoate de pe site
  lista = (await b.get('/api/favorite')).date;
  assert.equal(lista[0].disponibil, false); // ramane in lista, dar marcat indisponibil

  assert.equal((await b.delete(`/api/favorite/${anunt.id}`)).status, 204);
  assert.equal((await b.delete(`/api/favorite/${anunt.id}`)).status, 404);
});

test('favoritele unui chirias nu pot fi sterse de altul', async () => {
  const proprietar = await creeazaUtilizator('proprietar');
  const anunt = await creeazaAnunt((await creeazaProprietate(proprietar.id)).id);
  const ana = await creeazaUtilizator('chirias');
  const ion = await creeazaUtilizator('chirias');
  const bAna = browser();
  const bIon = browser();
  await bAna.conecteaza(ana.email, ana.parola);
  await bIon.conecteaza(ion.email, ion.parola);

  await bAna.post(`/api/favorite/${anunt.id}`);
  assert.equal((await bIon.delete(`/api/favorite/${anunt.id}`)).status, 404); // nu e al lui
  assert.equal((await bAna.get('/api/favorite')).date.length, 1); // al Anei a ramas
});
