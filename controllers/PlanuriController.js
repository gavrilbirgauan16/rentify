// Controller-ul pentru planurile de abonament: lista (pe roluri), Create, Edit, Activeaza / Dezactiveaza.
const PlanAccessor = require('../src/NivelAccesDate/PlanAccessor');
const PlanViewModel = require('../models/PlanViewModel');
const { citesteId, negasit, mesajFlash } = require('../utils/http');
const { noteaza } = require('../servicii/jurnal');

const planuri = new PlanAccessor();

const planNegasit = (res) => negasit(res, 'Planul nu există', 'Planul căutat nu a fost găsit.');

// Rolul cerut in adresa (?rol=chirias); orice altceva inseamna "proprietar".
const rolDin = (valoare) => (PlanViewModel.ROLURI.includes(valoare) ? valoare : 'proprietar');

// Datele comune pentru formular: campurile de limite/beneficii ale rolului.
const dateFormular = (rol) => ({ caracteristici: PlanViewModel.CARACTERISTICI[rol], eticheteRol: PlanViewModel.ETICHETE_ROL });

// GET /admin/planuri?rol=proprietar|chirias - cardurile cu planuri
async function index(req, res) {
  const rol = rolDin(req.query.rol);
  const lista = (await planuri.getByRol(rol)).map(PlanViewModel.dinEntitate);
  res.render('admin/planuri/index', { planuri: lista, rol, roluri: PlanViewModel.ROLURI, eticheteRol: PlanViewModel.ETICHETE_ROL });
}

// GET /admin/planuri/create?rol=... - formularul gol
function createGet(req, res) {
  const rol = rolDin(req.query.rol);
  res.render('admin/planuri/create', { p: new PlanViewModel({ rol }), erori: {}, ...dateFormular(rol) });
}

// POST /admin/planuri/create - salvarea planului nou
async function createPost(req, res) {
  const rol = rolDin(req.body.rol);
  const model = PlanViewModel.dinFormular(req.body, rol);
  const erori = model.valideaza();
  if (!erori.nume && (await planuri.numeFolosit(rol, model.nume))) erori.nume = 'Există deja un plan cu acest nume pentru acest rol.';
  if (Object.keys(erori).length > 0) {
    return res.status(400).render('admin/planuri/create', { p: model, erori, ...dateFormular(rol) });
  }
  const nou = await planuri.addEntity(rol, model.catreEntitate(), model.catreLimite());
  await noteaza(res, 'creare', 'plan', nou.id, nou.nume);
  mesajFlash(req, `Planul „${nou.nume}” a fost adăugat.`);
  res.redirect(`/admin/planuri?rol=${rol}`);
}

// GET /admin/planuri/:id/edit
async function editGet(req, res) {
  const id = citesteId(req);
  const entitate = id && (await planuri.getById(id));
  if (!entitate) return planNegasit(res);
  const model = PlanViewModel.dinEntitate(entitate);
  res.render('admin/planuri/edit', { p: model, erori: {}, ...dateFormular(model.rol) });
}

// POST /admin/planuri/:id/edit - rolul NU se schimba (un plan de chirias ramane de chirias)
async function editPost(req, res) {
  const id = citesteId(req);
  const entitate = id && (await planuri.getById(id));
  if (!entitate) return planNegasit(res);

  const rol = entitate.rol.nume;
  const model = PlanViewModel.dinFormular(req.body, rol);
  model.id = id;
  const erori = model.valideaza();
  if (!erori.nume && (await planuri.numeFolosit(rol, model.nume, id))) erori.nume = 'Există deja un plan cu acest nume pentru acest rol.';
  if (Object.keys(erori).length > 0) {
    return res.status(400).render('admin/planuri/edit', { p: model, erori, ...dateFormular(rol) });
  }
  await planuri.updateEntity(id, model.catreEntitate(), model.catreLimite());
  await noteaza(res, 'modificare', 'plan', id, model.nume);
  mesajFlash(req, `Planul „${model.nume}” a fost modificat.`);
  res.redirect(`/admin/planuri?rol=${rol}`);
}

// POST /admin/planuri/:id/activeaza si /dezactiveaza
async function schimbaActiv(req, res, activ) {
  const id = citesteId(req);
  const entitate = id && (await planuri.getById(id));
  if (!entitate) return planNegasit(res);
  await planuri.schimbaActiv(id, activ);
  await noteaza(res, activ ? 'activare' : 'dezactivare', 'plan', id, entitate.nume);
  const nota = !activ && entitate._count.abonament > 0 ? ' Abonații actuali îl păstrează până la expirare, dar nimeni nu-l mai poate alege.' : '';
  mesajFlash(req, `Planul „${entitate.nume}” a fost ${activ ? 'activat' : 'dezactivat'}.${nota}`);
  res.redirect(`/admin/planuri?rol=${entitate.rol.nume}`);
}
const activeaza = (req, res) => schimbaActiv(req, res, true);
const dezactiveaza = (req, res) => schimbaActiv(req, res, false);

module.exports = { index, createGet, createPost, editGet, editPost, activeaza, dezactiveaza };