// Controller-ul pentru proprietati: Index, Details, Create (GET/POST), Edit (GET/POST).
// Erorile neprevazute ajung automat la handler-ul de erori din app.js (Express 5).
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const ProprietateViewModel = require('../models/ProprietateViewModel');
const AnuntViewModel = require('../models/AnuntViewModel');
const { citesteId, negasit, mesajFlash, adresaInapoi } = require('../utils/http');
const F = require('../servicii/filtre');
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');
const { noteaza } = require('../servicii/jurnal');
const { avertizareProprietati } = require('../servicii/verificariPlan');

const proprietati = new ProprietateAccessor();
const utilizatori = new UtilizatorAccessor();
const jurnal = new JurnalAccessor();

// Pagina 404 pentru o proprietate care nu exista.
const proprietateNegasita = (res) => negasit(res, 'Proprietatea nu există', 'Proprietatea căutată nu a fost găsită.');

// Textul despre anunturi pentru mesajul verde, de ex. " 2 anunțuri ale ei au fost dezactivate."
function textAnunturi({ anunturiDezactivate = 0, anunturiActivate = 0 }) {
  const fraza = (numar, verb) => (numar === 1 ? ` Un anunț al ei a fost ${verb}.` : ` ${numar} anunțuri ale ei au fost ${verb}e.`);
  if (anunturiDezactivate > 0) return fraza(anunturiDezactivate, 'dezactivat');
  if (anunturiActivate > 0) return fraza(anunturiActivate, 'activat');
  return '';
}

// Unde ne intoarcem dupa un buton (lista cu filtrele ei sau pagina de detalii).
const inapoi = (req) => adresaInapoi(req, '/admin/proprietati');

// Filtrele listei de proprietati (ce se poate cauta) si sortarile.
const FILTRE = {
  q: { tip: 'text' },
  oras: { tip: 'text' },
  tip: { tip: 'enum', valori: ProprietateViewModel.TIPURI },
  stare: { tip: 'enum', valori: ProprietateViewModel.STARI },
  camere_min: { tip: 'intreg', min: 1 },
  balcon: { tip: 'enum', valori: ['da', 'nu'] },
  proprietar: { tip: 'id' },
  anunturi: { tip: 'enum', valori: ['fara', 'cu'] },
  sort: { tip: 'enum', valori: ['noi', 'vechi', 'denumire', 'oras', 'camere'], implicit: 'noi' },
};
const SORTARI = {
  noi: [{ creat_la: 'desc' }, { id: 'desc' }],
  vechi: [{ creat_la: 'asc' }, { id: 'asc' }],
  denumire: [{ denumire: 'asc' }],
  oras: [{ oras: 'asc' }, { denumire: 'asc' }],
  camere: [{ nr_camere: 'desc' }, { denumire: 'asc' }],
};
const PE_PAGINA = 20;

// Filtrele alese -> conditia pentru baza de date (Prisma "where").
function conditie(f) {
  const where = {};
  if (f.q) where.OR = F.contineText(['denumire', 'oras', 'zona', 'adresa', 'utilizator.nume', 'utilizator.prenume'], f.q);
  if (f.oras) where.oras = { equals: f.oras, mode: 'insensitive' };
  if (f.tip) where.tip = f.tip;
  if (f.stare) where.stare = f.stare;
  if (f.camere_min) where.nr_camere = { gte: f.camere_min };
  if (f.balcon) where.are_balcon = f.balcon === 'da';
  if (f.proprietar) where.proprietar_id = f.proprietar;
  if (f.anunturi === 'fara') where.anunt = { none: { stare: 'activ' } };
  if (f.anunturi === 'cu') where.anunt = { some: { stare: 'activ' } };
  return where;
}

// Datele comune pentru formularele Create si Edit (listele de selectie).
async function dateFormular() {
  return {
    tipuri: ProprietateViewModel.TIPURI,
    stari: ProprietateViewModel.STARI,
    eticheteTip: ProprietateViewModel.ETICHETE_TIP,
    eticheteStare: ProprietateViewModel.ETICHETE_STARE,
    proprietari: await utilizatori.getByRol('proprietar'),
  };
}

// GET /admin/proprietati - lista cu filtre, sortare si paginare
async function index(req, res) {
  const f = F.citesteFiltre(req.query, FILTRE);
  const where = conditie(f);
  const total = await proprietati.numara(where);
  const pag = F.paginare(total, f.pagina, PE_PAGINA);
  const [randuri, orase, proprietari] = await Promise.all([
    proprietati.getPagina(where, SORTARI[f.sort], pag),
    proprietati.getOrase(),
    utilizatori.getByRol('proprietar'),
  ]);
  res.render('admin/proprietati/index', {
    proprietati: randuri.map(ProprietateViewModel.dinEntitate),
    ...F.pentruPagina('/admin/proprietati', f, FILTRE, pag),
    orase,
    proprietari,
    tipuri: ProprietateViewModel.TIPURI,
    stari: ProprietateViewModel.STARI,
    eticheteTip: ProprietateViewModel.ETICHETE_TIP,
    eticheteStare: ProprietateViewModel.ETICHETE_STARE,
  });
}

// GET /admin/proprietati/:id - detaliile unei proprietati
async function details(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getById(id));
  if (!entitate) return proprietateNegasita(res);
  res.render('admin/proprietati/details', {
    p: ProprietateViewModel.dinEntitate(entitate),
    anunturi: entitate.anunt.map((a) => AnuntViewModel.dinEntitate(a)),
    istoric: await jurnal.getPentru('proprietate', id),
  });
}

// GET /admin/proprietati/create - formularul gol
async function createGet(req, res) {
  res.render('admin/proprietati/create', { p: new ProprietateViewModel(), erori: {}, ...(await dateFormular()) });
}

// POST /admin/proprietati/create - salvarea proprietatii noi
async function createPost(req, res) {
  const model = ProprietateViewModel.dinFormular(req.body);
  const erori = model.valideaza();
  if (Object.keys(erori).length > 0) {
    return res.status(400).render('admin/proprietati/create', { p: model, erori, ...(await dateFormular()) });
  }
  const noua = await proprietati.addEntity(model.catreEntitate());
  await noteaza(res, 'creare', 'proprietate', noua.id, noua.denumire);
  // Adminul nu e blocat de limita planului (poate corecta orice), dar e avertizat.
  const avertizare = await avertizareProprietati(noua.proprietar_id);
  mesajFlash(req, `Proprietatea „${noua.denumire}” a fost adăugată.` + (avertizare ? ` ${avertizare}` : ''), avertizare ? 'warning' : 'success');
  res.redirect(`/admin/proprietati/${noua.id}`); // Post/Redirect/Get: refresh-ul nu mai trimite formularul a doua oara
}

// GET /admin/proprietati/:id/edit - formularul completat cu datele existente
async function editGet(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getById(id));
  if (!entitate) return proprietateNegasita(res);
  res.render('admin/proprietati/edit', { p: ProprietateViewModel.dinEntitate(entitate), erori: {}, ...(await dateFormular()) });
}

// POST /admin/proprietati/:id/edit - salvarea modificarilor
async function editPost(req, res) {
  const id = citesteId(req);
  if (!id || !(await proprietati.getById(id))) return proprietateNegasita(res);

  const model = ProprietateViewModel.dinFormular(req.body);
  model.id = id;
  const erori = model.valideaza();
  if (Object.keys(erori).length > 0) {
    return res.status(400).render('admin/proprietati/edit', { p: model, erori, ...(await dateFormular()) });
  }
  const rezultat = await proprietati.updateEntity(id, model.catreEntitate());
  await noteaza(res, 'modificare', 'proprietate', id, model.denumire);
  mesajFlash(req, 'Modificările au fost salvate.' + textAnunturi(rezultat));
  res.redirect(`/admin/proprietati/${id}`);
}

// POST /admin/proprietati/:id/dezactiveaza - butonul Dezactiveaza (dezactiveaza si anunturile ei)
async function dezactiveaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getById(id));
  if (!entitate) return proprietateNegasita(res);
  const rezultat = await proprietati.schimbaStare(id, 'inactiv');
  await noteaza(res, 'dezactivare', 'proprietate', id, entitate.denumire);
  mesajFlash(req, `Proprietatea „${entitate.denumire}” a fost dezactivată.` + textAnunturi(rezultat));
  res.redirect(inapoi(req));
}

// POST /admin/proprietati/:id/activeaza - butonul Activeaza (proprietatea redevine libera, cu anunturile ei)
async function activeaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getById(id));
  if (!entitate) return proprietateNegasita(res);
  const rezultat = await proprietati.schimbaStare(id, 'liber');
  await noteaza(res, 'activare', 'proprietate', id, entitate.denumire);
  mesajFlash(req, `Proprietatea „${entitate.denumire}” a fost activată.` + textAnunturi(rezultat));
  res.redirect(inapoi(req));
}

module.exports = { index, details, createGet, createPost, editGet, editPost, dezactiveaza, activeaza };