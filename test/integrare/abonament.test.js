// Teste de integrare pentru API-ul "Abonamentul meu" (proprietarul): situatia, previzualizarea, schimbarea cu plata
// SIMULATA (upgrade cu credit, downgrade programat), renuntarea la schimbarea programata.
// Ruleaza cu: npm run test:integrare (pe baza rentify_test). Un proprietar nou are planul Gratuit (anual, 0 lei).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pornesteAplicatia, Browser, creeazaUtilizator, unic } = require('./ajutor');
const PlanAccessor = require('../../src/NivelAccesDate/PlanAccessor');
const D = require('../../servicii/date');

const planuri = new PlanAccessor();

// Baza de test are doar ce pun migrarile (planul Gratuit), asa ca planurile platite le facem aici, cu nume unice.
const planNou = (rol, pretLunar, maxProprietati) => planuri.addEntity(rol, {
  nume: `Test ${pretLunar} ${unic()}`, pret_lunar: pretLunar, pret_anual: pretLunar * 10, activ: true, recomandat: false,
}, maxProprietati ? [{ cheie: 'max_proprietati', valoare: maxProprietati }] : []);

let aplicatie;
let mic; // 300 lei / luna, 3 proprietati
let mare; // 600 lei / luna, 10 proprietati
before(async () => {
  aplicatie = await pornesteAplicatia();
  mic = await planNou('proprietar', 300, 3);
  mare = await planNou('proprietar', 600, 10);
});
after(() => aplicatie.opreste());

async function conectat(rol = 'proprietar') {
  const cont = await creeazaUtilizator(rol);
  const b = new Browser(aplicatie.url);
  await b.conecteaza(cont.email, cont.parola);
  return { cont, b };
}

const sumaPlatita = (istoric) => istoric.flatMap((a) => a.plati).filter((p) => p.stare === 'reusita').reduce((s, p) => s + p.suma, 0);

test('situatia unui proprietar nou: Gratuit, nimic programat, limitele si planurile active', async () => {
  const { b } = await conectat();
  const r = await b.get('/api/proprietar/abonament');
  assert.equal(r.status, 200);
  assert.equal(r.date.curent.plan, 'Gratuit');
  assert.equal(r.date.curent.pret, 0);
  assert.equal(r.date.programat, null);
  assert.deepEqual(r.date.limite.proprietati, { folosite: 0, maxim: 1, poate_adauga: true });
  const plan = r.date.planuri.find((p) => p.id === mic.id);
  assert.equal(plan.pret_lunar, 300);
  assert.equal(plan.limite.max_proprietati, 3);
  assert.ok(plan.caracteristici.length > 0);
  assert.equal('abonati' in plan, false); // cati abonati are un plan e treaba adminului
});

test('cine are acces: neconectat -> 401, chirias -> 403', async () => {
  const anonim = new Browser(aplicatie.url);
  assert.equal((await anonim.get('/api/proprietar/abonament')).status, 401);
  const { b } = await conectat('chirias');
  assert.equal((await b.get('/api/proprietar/abonament')).status, 403);
  assert.equal((await b.post('/api/proprietar/abonament/schimba', { plan: mic.id, perioada: 'lunar' })).status, 403);
});

test('previzualizarea: calculeaza pretul si nu schimba nimic; plan inexistent, de chirias sau perioada inventata -> 400', async () => {
  const { b } = await conectat();
  const r = await b.get(`/api/proprietar/abonament/previzualizare?plan=${mic.id}&perioada=lunar`);
  assert.equal(r.status, 200);
  assert.equal(r.date.tip, 'upgrade');
  assert.equal(r.date.de_plata, 300);
  assert.equal(r.date.data_inceput, D.azi());
  assert.equal((await b.get('/api/proprietar/abonament')).date.curent.plan, 'Gratuit'); // tot Gratuit

  const deChirias = await planNou('chirias', 20);
  for (const q of [`plan=999999&perioada=lunar`, `plan=${deChirias.id}&perioada=lunar`, `plan=${mic.id}&perioada=saptamanal`, 'plan=abc']) {
    const e = await b.get(`/api/proprietar/abonament/previzualizare?${q}`);
    assert.equal(e.status, 400, q);
    assert.ok(e.date.eroare);
  }
});

test('upgrade: 201, plata simulata; un "pret" trimis in cerere e ignorat (serverul recalculeaza)', async () => {
  const { b } = await conectat();
  const r = await b.post('/api/proprietar/abonament/schimba', { plan: mic.id, perioada: 'lunar', pret: 1, de_plata: 0 });
  assert.equal(r.status, 201);
  assert.equal(r.date.tip, 'upgrade');
  assert.equal(r.date.de_plata, 300);
  assert.equal(r.date.plata.suma, 300);
  assert.equal(r.date.plata.simulata, true);
  assert.match(r.date.plata.referinta, /^SIMULAT-/);

  const s = (await b.get('/api/proprietar/abonament')).date;
  assert.equal(s.curent.plan_id, mic.id);
  assert.equal(s.curent.stare, 'platit');
  assert.equal(s.limite.proprietati.maxim, 3); // limita vine acum din planul nou
  assert.equal((await b.post('/api/proprietar/abonament/schimba', { plan: mic.id, perioada: 'lunar' })).status, 400); // acelasi plan
});

test('doua upgrade-uri in aceeasi zi: creditul se aduce intreg, nu se pierde niciun ban (regresie)', async () => {
  const { b } = await conectat();
  await b.post('/api/proprietar/abonament/schimba', { plan: mic.id, perioada: 'lunar' });
  const r = await b.post('/api/proprietar/abonament/schimba', { plan: mare.id, perioada: 'lunar' });
  assert.equal(r.status, 201);
  assert.equal(r.date.credit, 300);
  assert.equal(r.date.de_plata, 300);

  const s = (await b.get('/api/proprietar/abonament')).date;
  assert.equal(s.curent.valoare, 600); // 300 cash + 300 credit = pretul planului
  assert.equal(sumaPlatita(s.istoric), 600); // in total a platit exact cat costa planul mare
});

test('downgrade: programat dupa finalul perioadei; DELETE il anuleaza (204), a doua oara -> 404', async () => {
  const { b } = await conectat();
  await b.post('/api/proprietar/abonament/schimba', { plan: mare.id, perioada: 'lunar' });
  const curent = (await b.get('/api/proprietar/abonament')).date.curent;

  const r = await b.post('/api/proprietar/abonament/schimba', { plan: mic.id, perioada: 'lunar' });
  assert.equal(r.status, 201);
  assert.equal(r.date.tip, 'downgrade');
  assert.equal(r.date.data_inceput, D.adunaZile(curent.data_sfarsit, 1));

  let s = (await b.get('/api/proprietar/abonament')).date;
  assert.equal(s.curent.plan_id, mare.id); // planul actual continua pana la final
  assert.equal(s.programat.plan_id, mic.id);

  assert.equal((await b.delete('/api/proprietar/abonament/programat')).status, 204);
  s = (await b.get('/api/proprietar/abonament')).date;
  assert.equal(s.programat, null);
  assert.equal(sumaPlatita(s.istoric), 600); // plata pentru downgrade s-a rambursat
  assert.equal((await b.delete('/api/proprietar/abonament/programat')).status, 404);
});

test('dublu-click pe "Plateste" (doua cereri deodata): o singura schimbare si o singura plata', async () => {
  const { b } = await conectat();
  const cerere = () => b.post('/api/proprietar/abonament/schimba', { plan: mic.id, perioada: 'lunar' });
  const raspunsuri = await Promise.all([cerere(), cerere()]);
  const coduri = raspunsuri.map((r) => r.status).sort();
  assert.equal(coduri[0], 201);
  assert.ok([400, 409].includes(coduri[1]), `al doilea raspuns: ${coduri[1]}`); // 409 = s-a schimbat intre timp
  assert.equal(sumaPlatita((await b.get('/api/proprietar/abonament')).date.istoric), 300);
});

test('CSRF: o schimbare fara tokenul CSRF e refuzata (403)', async () => {
  const { b } = await conectat();
  b.csrf = '';
  assert.equal((await b.post('/api/proprietar/abonament/schimba', { plan: mic.id, perioada: 'lunar' })).status, 403);
});
