// Controller-ul pentru proprietati: Index, Details, Create (GET/POST), Edit (GET/POST).
// Erorile neprevazute ajung automat la handler-ul de erori din app.js (Express 5).
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const ProprietateViewModel = require('../models/ProprietateViewModel');
const { citesteId, negasit, mesajFlash } = require('../utils/http');

const proprietati = new ProprietateAccessor();
const utilizatori = new UtilizatorAccessor();

// Pagina 404 pentru o proprietate care nu exista.
const proprietateNegasita = (res) => negasit(res, 'Proprietatea nu există', 'Proprietatea căutată nu a fost găsită.');

// Textul despre anunturi pentru mesajul verde, de ex. " 2 anunțuri ale ei au fost dezactivate."
function textAnunturi({ anunturiDezactivate = 0, anunturiActivate = 0 }) {
  const fraza = (numar, verb) => (numar === 1 ? ` Un anunț al ei a fost ${verb}.` : ` ${numar} anunțuri ale ei au fost ${verb}e.`);
  if (anunturiDezactivate > 0) return fraza(anunturiDezactivate, 'dezactivat');
  if (anunturiActivate > 0) return fraza(anunturiActivate, 'activat');
  return '';
}

// Unde ne intoarcem dupa un buton: doar pagini de proprietati (nu acceptam adrese din afara).
function inapoi(req, id) {
  const adresa = req.body.inapoi;
  return adresa === '/admin/proprietati' || adresa === `/admin/proprietati/${id}` ? adresa : '/admin/proprietati';
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

// GET /admin/proprietati - lista tuturor proprietatilor
async function index(req, res) {
  const lista = (await proprietati.getAll()).map(ProprietateViewModel.dinEntitate);
  res.render('admin/proprietati/index', { proprietati: lista });
}

// GET /admin/proprietati/:id - detaliile unei proprietati
async function details(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getById(id));
  if (!entitate) return proprietateNegasita(res);
  res.render('admin/proprietati/details', { p: ProprietateViewModel.dinEntitate(entitate) });
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
  mesajFlash(req, `Proprietatea „${noua.denumire}” a fost adăugată.`);
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
  mesajFlash(req, 'Modificările au fost salvate.' + textAnunturi(rezultat));
  res.redirect(`/admin/proprietati/${id}`);
}

// POST /admin/proprietati/:id/dezactiveaza - butonul Dezactiveaza (dezactiveaza si anunturile ei)
async function dezactiveaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getById(id));
  if (!entitate) return proprietateNegasita(res);
  const rezultat = await proprietati.schimbaStare(id, 'inactiv');
  mesajFlash(req, `Proprietatea „${entitate.denumire}” a fost dezactivată.` + textAnunturi(rezultat));
  res.redirect(inapoi(req, id));
}

// POST /admin/proprietati/:id/activeaza - butonul Activeaza (proprietatea redevine libera, cu anunturile ei)
async function activeaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getById(id));
  if (!entitate) return proprietateNegasita(res);
  const rezultat = await proprietati.schimbaStare(id, 'liber');
  mesajFlash(req, `Proprietatea „${entitate.denumire}” a fost activată.` + textAnunturi(rezultat));
  res.redirect(inapoi(req, id));
}

module.exports = { index, details, createGet, createPost, editGet, editPost, dezactiveaza, activeaza };