// Controller-ul pentru utilizatori (in admin): lista cu filtre, Detalii, Blocare / Deblocare si Resetarea parolei.
// Conturile noi nu se fac de aici: proprietarii si chiriasii isi vor face singuri cont (inregistrare).
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { hashParola, genereazaParolaTemporara } = require('../servicii/parole');
const { citesteId, negasit, mesajFlash } = require('../utils/http');
const { azi } = require('../servicii/date');

const utilizatori = new UtilizatorAccessor();
const abonamente = new AbonamentAccessor();

const utilizatorNegasit = (res) => negasit(res, 'Utilizatorul nu există', 'Utilizatorul căutat nu a fost găsit.');

// Filtrele din adresa (?rol=&stare=&q=), curatate: orice valoare necunoscuta e ignorata.
function filtreDin(query) {
  return {
    rol: UtilizatorViewModel.ROLURI[query.rol] ? query.rol : '',
    stare: UtilizatorViewModel.STARI[query.stare] ? query.stare : '',
    q: String(query.q ?? '').trim().slice(0, 100),
  };
}

// GET /admin/utilizatori
async function index(req, res) {
  const filtre = filtreDin(req.query);
  const entitati = await utilizatori.cauta({ rol: filtre.rol, stare: filtre.stare, cautare: filtre.q });
  // Abonamentele curente le aducem pe toate dintr-o singura interogare (nu cate una pentru fiecare utilizator).
  const curente = await abonamente.getCurente(entitati.map((u) => u.id), azi());
  const peUtilizator = new Map(curente.map((a) => [a.utilizator_id, a]));
  const lista = entitati.map((u) => new UtilizatorViewModel(u, peUtilizator.get(u.id) ?? null));
  res.render('admin/utilizatori/index', { utilizatori: lista, filtre, roluri: UtilizatorViewModel.ROLURI, stari: UtilizatorViewModel.STARI });
}

// GET /admin/utilizatori/:id
async function details(req, res) {
  const id = citesteId(req);
  const entitate = id && (await utilizatori.getDetalii(id));
  if (!entitate) return utilizatorNegasit(res);
  const [toate, curente] = await Promise.all([abonamente.getByUtilizator(id), abonamente.getCurente([id], azi())]);
  res.render('admin/utilizatori/details', {
    u: new UtilizatorViewModel(entitate, curente[0] ?? null),
    abonamente: toate.map(AbonamentViewModel.dinEntitate),
  });
}

// Gaseste utilizatorul din adresa si verifica daca adminul conectat are voie sa-l administreze.
// Intoarce modelul sau null (si a raspuns deja).
async function utilizatorAdministrabil(req, res) {
  const id = citesteId(req);
  const entitate = id && (await utilizatori.getDetalii(id));
  if (!entitate) {
    utilizatorNegasit(res);
    return null;
  }
  const u = new UtilizatorViewModel(entitate);
  if (!u.poateFiAdministratDe(res.locals.utilizator.id)) {
    mesajFlash(req, 'Conturile de administrator (inclusiv al tău) nu pot fi blocate sau resetate de aici.', 'warning');
    res.redirect(`/admin/utilizatori/${id}`);
    return null;
  }
  return u;
}

// POST /admin/utilizatori/:id/blocheaza si /deblocheaza
async function schimbaStare(req, res, stare) {
  const u = await utilizatorAdministrabil(req, res);
  if (!u) return;
  if (u.stare !== stare) {
    await utilizatori.schimbaStare(u.id, stare);
    mesajFlash(req, stare === 'blocat'
      ? `Contul lui ${u.numeComplet} a fost blocat. Dacă era conectat, este deconectat imediat.`
      : `Contul lui ${u.numeComplet} a fost deblocat.`);
  }
  res.redirect(`/admin/utilizatori/${u.id}`);
}

// POST /admin/utilizatori/:id/reseteaza-parola
// Genereaza o parola temporara, o arata O SINGURA DATA adminului si il obliga pe utilizator s-o schimbe
// la prima conectare. Toate sesiunile deschise ale utilizatorului se inchid.
async function reseteazaParola(req, res) {
  const u = await utilizatorAdministrabil(req, res);
  if (!u) return;
  const parola = genereazaParolaTemporara();
  await utilizatori.seteazaParola(u.id, await hashParola(parola), { temporara: true });
  await utilizatori.inchideSesiunile(u.id);

  // Parola NU se pune in mesajul flash (care se salveaza in sesiune, in baza de date):
  // o afisam direct, in raspuns, si cerem browserului sa nu pastreze pagina.
  res.set('Cache-Control', 'no-store');
  res.render('admin/utilizatori/parola-temporara', { u, parola });
}

module.exports = {
  index,
  details,
  blocheaza: (req, res) => schimbaStare(req, res, 'blocat'),
  deblocheaza: (req, res) => schimbaStare(req, res, 'activ'),
  reseteazaParola,
};
