// Ajutoare pentru testele de integrare: pornesc aplicatia, imita un browser (cookie + token CSRF)
// si creeaza datele de care are nevoie fiecare test. Ruleaza DOAR pe baza de test (vezi scripts/teste-integrare.js).
//
// Fiecare test isi creeaza propriile date, cu nume unice (ex. un oras inventat): testele nu depind unele de altele
// si nici de ce mai e in baza.
const crypto = require('crypto');
const app = require('../../app');
const context = require('../../src/Repository_CodeFirst/context');
// Accesorii ii construieste containerul DI, exact ca in aplicatie (laboratorul 10).
const { container } = require('../../infrastructura/container');
const scop = container.createScope();
const { abonamentGratuit } = require('../../models/AbonamentViewModel');
const { hashParola } = require('../../servicii/parole');
const D = require('../../servicii/date');

const utilizatori = scop.resolve('utilizatorAccessor');
const planuri = scop.resolve('planAccessor');
const proprietati = scop.resolve('proprietateAccessor');
const anunturi = scop.resolve('anuntAccessor');

// A doua plasa de siguranta (prima e in scripts/teste-integrare.js): nu pornim pe alta baza decat una "_test".
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) {
  throw new Error('Testele de integrare ruleaza doar pe o baza al carei nume se termina cu "_test".');
}

// Un sufix unic, ca datele fiecarui test sa nu se amestece (emailuri, orase).
const unic = () => crypto.randomBytes(4).toString('hex');

// Porneste aplicatia pe un port liber ales de sistem (port 0). Intoarce { url, opreste }.
function pornesteAplicatia() {
  return new Promise((gata) => {
    const server = app.listen(0, () => {
      gata({
        url: `http://localhost:${server.address().port}`,
        opreste: () => new Promise((r) => server.close(async () => { await context.$disconnect(); r(); })),
      });
    });
  });
}

// Un "browser" pentru teste: tine minte cookie-ul de sesiune si trimite singur tokenul CSRF.
class Browser {
  constructor(url) { this.url = url; this.cookie = ''; this.csrf = ''; }

  async cere(metoda, adresa, body) {
    const antete = { ...(this.cookie ? { cookie: this.cookie } : {}), ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}) };
    if (body !== undefined) antete['content-type'] = 'application/json';
    const r = await fetch(this.url + adresa, { method: metoda, headers: antete, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0]; // pastram doar "rentify.sid=..."
    const text = await r.text();
    let date;
    try { date = text ? JSON.parse(text) : null; } catch { date = text; } // nu e JSON (ex. o pagina HTML): textul brut
    return { status: r.status, date, antete: r.headers };
  }

  // Trimite fisiere (multipart/form-data), ca un formular cu <input type="file">. fisiere = [{ nume, continut, tip }].
  async trimiteFisiere(adresa, fisiere, camp = 'imagini') {
    const fd = new FormData();
    for (const f of fisiere) fd.append(camp, new Blob([f.continut], { type: f.tip }), f.nume);
    const antete = { ...(this.cookie ? { cookie: this.cookie } : {}), ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}) };
    const r = await fetch(this.url + adresa, { method: 'POST', headers: antete, body: fd });
    const text = await r.text();
    let date;
    try { date = text ? JSON.parse(text) : null; } catch { date = text; }
    return { status: r.status, date };
  }

  get(adresa) { return this.cere('GET', adresa); }
  post(adresa, body) { return this.cere('POST', adresa, body ?? {}); }
  delete(adresa) { return this.cere('DELETE', adresa); }

  // Ca interfata React la pornire: cere tokenul CSRF.
  async pregateste() { this.csrf = (await this.get('/api/auth/csrf')).date.csrfToken; return this; }

  // Conectare prin API; tokenul CSRF se schimba dupa login (sesiune noua).
  async conecteaza(email, parola) {
    if (!this.csrf) await this.pregateste();
    const r = await this.post('/api/auth/login', { email, parola });
    if (r.status === 200) this.csrf = r.date.csrfToken;
    return r;
  }
}

// Un utilizator confirmat, cu planul gratuit al rolului lui (ca un cont nou real). Intoarce { id, email, parola }.
async function creeazaUtilizator(rol) {
  const parola = `Parola-${unic()}`;
  const email = `${rol}.${unic()}@test.rentify`;
  const u = await utilizatori.creeazaCont(rol, { email, prenume: 'Test', nume: rol, telefon: '0711222333' }, await hashParola(parola));
  const plan = await planuri.getGratuit(rol);
  await utilizatori.confirmaEmail(u.id, plan ? abonamentGratuit(plan.id, D.azi()) : null);
  return { id: u.id, email, parola };
}

// O proprietate a proprietarului dat, intr-un oras (implicit unul inventat, ca testele de cautare sa fie izolate).
async function creeazaProprietate(proprietarId, { oras = `Oras-${unic()}`, stare = 'liber' } = {}) {
  return proprietati.addEntity({
    denumire: `Locuinta ${unic()}`, tip: 'apartament', judet: 'Suceava', oras, zona: 'Centru',
    nr_camere: 2, suprafata_mp: 50, max_locatari: 3, are_balcon: true, stare, proprietar_id: proprietarId,
  });
}

// Un anunt pe proprietatea data; "activ" inseamna si aprobat (ca dupa moderare).
async function creeazaAnunt(proprietateId, { stare = 'activ', pret = 1000, titlu = `Anunt ${unic()}` } = {}) {
  return anunturi.addEntity({
    proprietate_id: proprietateId, tip: 'inchiriere', titlu, pret, moneda: 'RON', stare,
    aprobat_la: stare === 'activ' ? new Date() : null,
  });
}

// O "poza" PNG pentru teste: semnatura PNG (dupa care aplicatia recunoaste tipul real) + cativa octeti.
const pozaPng = (nume = 'poza.png') => ({
  nume, tip: 'image/png', continut: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]),
});
// Un fisier text redenumit ".png": browserul spune "image/png", dar continutul nu e o imagine.
const pozaFalsa = () => ({ nume: 'virus.png', tip: 'image/png', continut: Buffer.from('nu sunt o imagine') });

module.exports = { pornesteAplicatia, Browser, creeazaUtilizator, creeazaProprietate, creeazaAnunt, unic, pozaPng, pozaFalsa };
