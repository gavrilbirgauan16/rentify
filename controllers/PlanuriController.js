// Controller-ul pentru planurile de abonament (admin): lista (pe roluri), Create, Edit, Activeaza / Dezactiveaza.
// Logica e in serviciul planuriAdmin (primit prin injectie, laboratorul 10); aici doar cererea si pagina.
const PlanViewModel = require('../models/PlanViewModel');
const { citesteId, negasit, mesajFlash } = require('../utils/http');

const planNegasit = (res) => negasit(res, 'Planul nu există', 'Planul căutat nu a fost găsit.');

// Rolul cerut in adresa (?rol=chirias); orice altceva inseamna "proprietar".
const rolDin = (valoare) => (PlanViewModel.ROLURI.includes(valoare) ? valoare : 'proprietar');

// Datele comune pentru formular: campurile de limite/beneficii ale rolului.
const dateFormular = (rol) => ({ caracteristici: PlanViewModel.CARACTERISTICI[rol], eticheteRol: PlanViewModel.ETICHETE_ROL });

module.exports = function PlanuriController({ planuriAdmin: serviciu }) {
  // GET /admin/planuri?rol=proprietar|chirias - cardurile cu planuri
  async function index(req, res) {
    const rol = rolDin(req.query.rol);
    res.render('admin/planuri/index', { planuri: await serviciu.lista(rol), rol, roluri: PlanViewModel.ROLURI, eticheteRol: PlanViewModel.ETICHETE_ROL });
  }

  // GET /admin/planuri/create?rol=... - formularul gol
  function createGet(req, res) {
    const rol = rolDin(req.query.rol);
    res.render('admin/planuri/create', { p: new PlanViewModel({ rol }), erori: {}, ...dateFormular(rol) });
  }

  // POST /admin/planuri/create - salvarea planului nou
  async function createPost(req, res) {
    const rol = rolDin(req.body.rol);
    const r = await serviciu.adauga(rol, req.body, res.locals.utilizator);
    if (r.erori) return res.status(400).render('admin/planuri/create', { p: r.model, erori: r.erori, ...dateFormular(rol) });
    mesajFlash(req, `Planul „${r.nou.nume}” a fost adăugat.`);
    res.redirect(`/admin/planuri?rol=${rol}`);
  }

  // GET /admin/planuri/:id/edit
  async function editGet(req, res) {
    const id = citesteId(req);
    const p = id && (await serviciu.getModel(id));
    if (!p) return planNegasit(res);
    res.render('admin/planuri/edit', { p, erori: {}, ...dateFormular(p.rol) });
  }

  // POST /admin/planuri/:id/edit
  async function editPost(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.modifica(id, req.body, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return planNegasit(res);
    if (r.erori) return res.status(400).render('admin/planuri/edit', { p: r.model, erori: r.erori, ...dateFormular(r.rol) });
    mesajFlash(req, `Planul „${r.model.nume}” a fost modificat.`);
    res.redirect(`/admin/planuri?rol=${r.rol}`);
  }

  // POST /admin/planuri/:id/activeaza si /dezactiveaza
  async function schimbaActiv(req, res, activ) {
    const id = citesteId(req);
    const r = id ? await serviciu.schimbaActiv(id, activ, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return planNegasit(res);
    const nota = !activ && r.aveaAbonati ? ' Abonații actuali îl păstrează până la expirare, dar nimeni nu-l mai poate alege.' : '';
    mesajFlash(req, `Planul „${r.nume}” a fost ${activ ? 'activat' : 'dezactivat'}.${nota}`);
    res.redirect(`/admin/planuri?rol=${r.rol}`);
  }

  return {
    index,
    createGet,
    createPost,
    editGet,
    editPost,
    activeaza: (req, res) => schimbaActiv(req, res, true),
    dezactiveaza: (req, res) => schimbaActiv(req, res, false),
  };
};
