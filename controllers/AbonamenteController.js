// Controller-ul pentru abonamente: lista cu filtre, Detalii (cu istoricul platilor), Create,
// adaugarea unei plati si Anularea. Un abonament nu se sterge si nu se editeaza: e un "contract" cu pret inghetat.
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const PlanAccessor = require('../src/NivelAccesDate/PlanAccessor');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { valideazaPlata } = require('../models/AbonamentViewModel');
const { citesteId, negasit, mesajFlash } = require('../utils/http');

const abonamente = new AbonamentAccessor();
const planuri = new PlanAccessor();
const utilizatori = new UtilizatorAccessor();

const ROLURI_CU_ABONAMENT = ['proprietar', 'chirias'];
const abonamentNegasit = (res) => negasit(res, 'Abonamentul nu există', 'Abonamentul căutat nu a fost găsit.');

// Filtrele din adresa (?rol=&stare=&q=), curatate: orice valoare necunoscuta e ignorata.
function filtreDin(query) {
  return {
    rol: ROLURI_CU_ABONAMENT.includes(query.rol) ? query.rol : '',
    stare: AbonamentViewModel.STARI[query.stare] ? query.stare : '',
    q: String(query.q ?? '').trim().slice(0, 100),
  };
}

// GET /admin/abonamente
async function index(req, res) {
  const filtre = filtreDin(req.query);
  let lista = (await abonamente.getAll({ rol: filtre.rol, cautare: filtre.q })).map(AbonamentViewModel.dinEntitate);
  if (filtre.stare) lista = lista.filter((a) => a.stareCod() === filtre.stare); // starea e calculata, deci filtram aici
  res.render('admin/abonamente/index', { abonamente: lista, filtre, stari: AbonamentViewModel.STARI });
}

// GET /admin/abonamente/:id
async function details(req, res, erori = {}, plataIntrodusa = {}) {
  const id = citesteId(req);
  const entitate = id && (await abonamente.getById(id));
  if (!entitate) return abonamentNegasit(res);
  res.status(Object.keys(erori).length ? 400 : 200).render('admin/abonamente/details', {
    a: AbonamentViewModel.dinEntitate(entitate),
    metode: AbonamentViewModel.METODE,
    erori,
    plataIntrodusa,
  });
}

// Datele pentru formularul de Create: utilizatorii activi (proprietari + chiriasi) si planurile active, pe roluri.
async function dateFormular() {
  const [proprietari, chiriasi, active] = await Promise.all([
    utilizatori.cauta({ rol: 'proprietar', stare: 'activ' }),
    utilizatori.cauta({ rol: 'chirias', stare: 'activ' }),
    planuri.getActive(),
  ]);
  const planuriPeRol = { proprietar: [], chirias: [] };
  active.forEach((p) => planuriPeRol[p.rol.nume]?.push(p));
  return { proprietari, chiriasi, planuriPeRol, perioade: AbonamentViewModel.PERIOADE, metode: AbonamentViewModel.METODE, lei: AbonamentViewModel.lei };
}

// GET /admin/abonamente/create (?utilizator=ID preselecteaza utilizatorul, ex. din pagina lui)
async function createGet(req, res) {
  const model = new AbonamentViewModel({ utilizator_id: Number(req.query.utilizator) || '' });
  res.render('admin/abonamente/create', { a: model, erori: {}, ...(await dateFormular()) });
}

// POST /admin/abonamente/create
async function createPost(req, res) {
  const model = AbonamentViewModel.dinFormular(req.body);
  const erori = model.valideaza();

  // Regulile care tin de alte tabele: utilizatorul si planul trebuie sa existe, sa fie activi si "pentru acelasi rol".
  const [u, plan] = await Promise.all([
    !erori.utilizator_id ? utilizatori.getPentruSesiune(model.utilizator_id) : null,
    !erori.plan_id ? planuri.getById(model.plan_id) : null,
  ]);
  if (!erori.utilizator_id && (!u || u.stare !== 'activ' || !ROLURI_CU_ABONAMENT.includes(u.rol.nume))) erori.utilizator_id = 'Alege un proprietar sau un chiriaș activ.';
  if (!erori.plan_id && (!plan || !plan.activ)) erori.plan_id = 'Planul ales nu mai este disponibil.';
  if (!erori.utilizator_id && !erori.plan_id && plan.rol.nume !== u.rol.nume) erori.plan_id = `Planul „${plan.nume}” nu este pentru ${u.rol.nume === 'chirias' ? 'chiriași' : 'proprietari'}.`;

  if (plan && !erori.plan_id) model.completeazaDinPlan(plan);
  if (Object.keys(erori).length === 0 && (await abonamente.seSuprapune(model.utilizator_id, model.data_inceput, model.data_sfarsit))) {
    erori.data_inceput = 'Utilizatorul are deja un abonament în această perioadă. Anulează-l întâi sau alege o dată după ce se termină.';
  }
  if (Object.keys(erori).length > 0) {
    return res.status(400).render('admin/abonamente/create', { a: model, erori, ...(await dateFormular()) });
  }

  // Plata pe loc are sens doar daca planul costa ceva.
  const plata = model.plata_acum && model.pret > 0 ? { suma: model.pret, metoda: model.metoda } : null;
  const nou = await abonamente.addEntity(model.catreEntitate(), plata);
  mesajFlash(req, `Abonamentul „${plan.nume}” pentru ${u.prenume} ${u.nume} a fost creat.`);
  res.redirect(`/admin/abonamente/${nou.id}`);
}

// POST /admin/abonamente/:id/plati - inregistreaza o plata (ex. a platit prin transfer)
async function plataPost(req, res) {
  const id = citesteId(req);
  const entitate = id && (await abonamente.getById(id));
  if (!entitate) return abonamentNegasit(res);
  const a = AbonamentViewModel.dinEntitate(entitate);
  if (!a.poatePrimiPlata) {
    mesajFlash(req, a.stare === 'anulat' ? 'Abonamentul este anulat.' : 'Abonamentul este deja plătit integral.', 'warning');
    return res.redirect(`/admin/abonamente/${id}`);
  }
  const { erori, plata } = valideazaPlata(req.body, a);
  if (Object.keys(erori).length > 0) return details(req, res, erori, req.body);

  await abonamente.adaugaPlata(id, plata);
  mesajFlash(req, `Plata de ${AbonamentViewModel.lei(plata.suma)} a fost înregistrată.`);
  res.redirect(`/admin/abonamente/${id}`);
}

// POST /admin/abonamente/:id/anuleaza
async function anuleaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await abonamente.getById(id));
  if (!entitate) return abonamentNegasit(res);
  const a = AbonamentViewModel.dinEntitate(entitate);
  if (!a.poateFiAnulat) {
    mesajFlash(req, 'Abonamentul nu mai poate fi anulat (este deja anulat sau expirat).', 'warning');
  } else {
    await abonamente.anuleaza(id);
    mesajFlash(req, `Abonamentul lui ${a.utilizator_nume} a fost anulat. Istoricul plăților rămâne păstrat.`);
  }
  res.redirect(`/admin/abonamente/${id}`);
}

module.exports = { index, details: (req, res) => details(req, res), createGet, createPost, plataPost, anuleaza };