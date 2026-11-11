// Controller-ul pentru abonamente: lista cu filtre, Detalii (cu istoricul platilor), Create,
// adaugarea unei plati si Anularea. Un abonament nu se sterge si nu se editeaza: e un "contract" cu pret inghetat.
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const PlanAccessor = require('../src/NivelAccesDate/PlanAccessor');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { valideazaPlata } = require('../models/AbonamentViewModel');
const { citesteId, negasit, mesajFlash } = require('../utils/http');
const F = require('../servicii/filtre');
const D = require('../servicii/date');
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');
const { noteaza } = require('../servicii/jurnal');

const abonamente = new AbonamentAccessor();
const planuri = new PlanAccessor();
const utilizatori = new UtilizatorAccessor();
const jurnal = new JurnalAccessor();

const ROLURI_CU_ABONAMENT = ['proprietar', 'chirias'];
const abonamentNegasit = (res) => negasit(res, 'Abonamentul nu există', 'Abonamentul căutat nu a fost găsit.');

// Filtrele listei de abonamente si sortarile.
const FILTRE = {
  q: { tip: 'text' },
  rol: { tip: 'enum', valori: ROLURI_CU_ABONAMENT },
  stare: { tip: 'enum', valori: Object.keys(AbonamentViewModel.STARI) },
  plan: { tip: 'id' },
  perioada: { tip: 'enum', valori: Object.keys(AbonamentViewModel.PERIOADE) },
  expira: { tip: 'enum', valori: ['7', '30'] },
  sort: { tip: 'enum', valori: ['noi', 'sfarsit', 'pret'], implicit: 'noi' },
};
const SORTARI = {
  noi: [{ data_inceput: 'desc' }, { id: 'desc' }],
  sfarsit: [{ data_sfarsit: 'asc' }, { id: 'asc' }],
  pret: [{ pret: 'desc' }, { id: 'desc' }],
};
const PE_PAGINA = 20;

// Filtrele -> conditia pentru baza de date. Starea "platit / neplatit" depinde de plati,
// deci aceea se verifica dupa ce aducem abonamentele (vezi index).
function conditie(f) {
  const astazi = D.catreDate(D.azi());
  const where = {};
  const u = {};
  if (f.rol) u.rol = { nume: f.rol };
  if (f.q) u.OR = F.contineText(['nume', 'prenume', 'email'], f.q);
  if (Object.keys(u).length) where.utilizator = u;
  if (f.plan) where.plan_id = f.plan;
  if (f.perioada) where.perioada = f.perioada;
  if (f.stare === 'anulat') where.stare = 'anulat';
  if (f.stare === 'expirat') Object.assign(where, { stare: 'activ', data_sfarsit: { lt: astazi } });
  if (f.stare === 'programat') Object.assign(where, { stare: 'activ', data_inceput: { gt: astazi } });
  if (f.stare === 'platit' || f.stare === 'neplatit') Object.assign(where, { stare: 'activ', data_inceput: { lte: astazi }, data_sfarsit: { gte: astazi } });
  if (f.expira) {
    // in desfasurare si se termina in urmatoarele N zile
    Object.assign(where, { stare: 'activ', data_inceput: { lte: astazi } });
    where.data_sfarsit = { gte: astazi, lte: D.catreDate(D.adunaZile(D.azi(), Number(f.expira))) };
  }
  return where;
}

// GET /admin/abonamente
async function index(req, res) {
  const f = F.citesteFiltre(req.query, FILTRE);
  let lista = (await abonamente.getLista(conditie(f), SORTARI[f.sort])).map(AbonamentViewModel.dinEntitate);
  if (f.stare === 'platit' || f.stare === 'neplatit') lista = lista.filter((a) => a.stareCod() === f.stare);
  const pag = F.paginareLista(lista, f.pagina, PE_PAGINA);
  res.render('admin/abonamente/index', {
    abonamente: pag.randuri,
    ...F.pentruPagina('/admin/abonamente', f, FILTRE, pag),
    stari: AbonamentViewModel.STARI,
    perioade: AbonamentViewModel.PERIOADE,
    planuri: await planuri.getToate(),
  });
}

// GET /admin/abonamente/:id
async function details(req, res, erori = {}, plataIntrodusa = {}) {
  const id = citesteId(req);
  const entitate = id && (await abonamente.getById(id));
  if (!entitate) return abonamentNegasit(res);
  res.status(Object.keys(erori).length ? 400 : 200).render('admin/abonamente/details', {
    a: AbonamentViewModel.dinEntitate(entitate),
    metode: AbonamentViewModel.METODE,
    istoric: await jurnal.getPentru('abonament', id),
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
  await noteaza(res, 'creare', 'abonament', nou.id, `${u.prenume} ${u.nume} – ${plan.nume}, ${model.perioadaAfisata.toLowerCase()}, ${model.pretAfisat}${plata ? ', plătit' : ''}`);
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
  await noteaza(res, 'plata', 'abonament', id, `${AbonamentViewModel.lei(plata.suma)} (${AbonamentViewModel.METODE[plata.metoda].toLowerCase()})`);
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
    await noteaza(res, 'anulare', 'abonament', id, `${a.utilizator_nume} – ${a.plan_nume}`);
    mesajFlash(req, `Abonamentul lui ${a.utilizator_nume} a fost anulat. Istoricul plăților rămâne păstrat.`);
  }
  res.redirect(`/admin/abonamente/${id}`);
}

module.exports = { index, details: (req, res) => details(req, res), createGet, createPost, plataPost, anuleaza };
