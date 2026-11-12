// Controller-ul pentru utilizatori (in admin): lista cu filtre, Detalii, Blocare / Deblocare si Resetarea parolei.
// Conturile noi nu se fac de aici: proprietarii si chiriasii isi vor face singuri cont (inregistrare).
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { hashParola, genereazaParolaTemporara } = require('../servicii/parole');
const { citesteId, negasit, mesajFlash } = require('../utils/http');
const F = require('../servicii/filtre');
const { azi } = require('../servicii/date');
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');
const { noteaza } = require('../servicii/jurnal');
const { trimiteLinkResetare } = require('./ParolaUitataController');
const { trimiteConfirmarea } = require('./InregistrareController');

const utilizatori = new UtilizatorAccessor();
const abonamente = new AbonamentAccessor();
const jurnal = new JurnalAccessor();

const utilizatorNegasit = (res) => negasit(res, 'Utilizatorul nu există', 'Utilizatorul căutat nu a fost găsit.');

// Filtrele listei de utilizatori si sortarile.
const SITUATII = {
  peste_limita: 'Proprietari peste limita planului',
  fara_abonament: 'Fără abonament în curs',
  neplatit: 'Abonament neplătit',
  parola_temporara: 'Parolă temporară nefolosită',
  email_neconfirmat: 'Email neconfirmat',
};
const FILTRE = {
  q: { tip: 'text' },
  rol: { tip: 'enum', valori: Object.keys(UtilizatorViewModel.ROLURI) },
  stare: { tip: 'enum', valori: Object.keys(UtilizatorViewModel.STARI) },
  situatie: { tip: 'enum', valori: Object.keys(SITUATII) },
  sort: { tip: 'enum', valori: ['nume', 'noi', 'conectare'], implicit: 'nume' },
};
const SORTARI = {
  nume: [{ nume: 'asc' }, { prenume: 'asc' }],
  noi: [{ creat_la: 'desc' }, { id: 'desc' }],
  conectare: [{ ultima_autentificare: { sort: 'desc', nulls: 'last' } }, { nume: 'asc' }],
};
const PE_PAGINA = 25;

// Situatiile "de verificat" se calculeaza din abonamentul curent si proprietati.
const SE_POTRIVESTE = {
  peste_limita: (u) => Boolean(u.situatieProprietati?.depaseste),
  fara_abonament: (u) => u.areAbonamente && !u.abonament,
  neplatit: (u) => u.abonament?.stareCod() === 'neplatit',
  parola_temporara: (u) => u.areParolaTemporara,
  email_neconfirmat: (u) => !u.emailConfirmat,
};

// GET /admin/utilizatori
async function index(req, res) {
  const f = F.citesteFiltre(req.query, FILTRE);
  const entitati = await utilizatori.cauta({ rol: f.rol, stare: f.stare, cautare: f.q }, SORTARI[f.sort]);
  // Abonamentele curente le aducem pe toate dintr-o singura interogare (nu cate una pentru fiecare utilizator).
  const curente = await abonamente.getCurente(entitati.map((u) => u.id), azi());
  const peUtilizator = new Map(curente.map((a) => [a.utilizator_id, a]));
  let lista = entitati.map((u) => new UtilizatorViewModel(u, peUtilizator.get(u.id) ?? null));
  if (f.situatie) lista = lista.filter(SE_POTRIVESTE[f.situatie]);
  const pag = F.paginareLista(lista, f.pagina, PE_PAGINA);
  res.render('admin/utilizatori/index', {
    utilizatori: pag.randuri,
    ...F.pentruPagina('/admin/utilizatori', f, FILTRE, pag),
    roluri: UtilizatorViewModel.ROLURI,
    stari: UtilizatorViewModel.STARI,
    situatii: SITUATII,
  });
}

// GET /admin/utilizatori/:id
async function details(req, res) {
  const id = citesteId(req);
  const entitate = id && (await utilizatori.getDetalii(id));
  if (!entitate) return utilizatorNegasit(res);
  const [toate, curente, istoric] = await Promise.all([
    abonamente.getByUtilizator(id),
    abonamente.getCurente([id], azi()),
    jurnal.getPentru('utilizator', id, 10),
  ]);
  res.render('admin/utilizatori/details', {
    u: new UtilizatorViewModel(entitate, curente[0] ?? null),
    abonamente: toate.map(AbonamentViewModel.dinEntitate),
    istoric,
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
    await noteaza(res, stare === 'blocat' ? 'blocare' : 'deblocare', 'utilizator', u.id, u.numeComplet);
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
  await noteaza(res, 'resetare_parola', 'utilizator', u.id, u.numeComplet); // parola NU se scrie in jurnal

  // Parola NU se pune in mesajul flash (care se salveaza in sesiune, in baza de date):
  // o afisam direct, in raspuns, si cerem browserului sa nu pastreze pagina.
  res.set('Cache-Control', 'no-store');
  res.render('admin/utilizatori/parola-temporara', { u, parola });
}

// POST /admin/utilizatori/:id/trimite-link-resetare - varianta recomandata: utilizatorul isi alege singur
// parola din linkul primit pe email (adminul nu afla nicio parola). Parola veche merge pana foloseste linkul.
async function trimiteLinkParola(req, res) {
  const u = await utilizatorAdministrabil(req, res);
  if (!u) return;
  if (u.esteBlocat) {
    mesajFlash(req, 'Contul este blocat: deblochează-l întâi, altfel utilizatorul nu se poate conecta oricum.', 'warning');
    return res.redirect(`/admin/utilizatori/${u.id}`);
  }
  const plecat = await trimiteLinkResetare(u);
  if (!plecat) {
    mesajFlash(req, 'Emailul nu a putut fi trimis (verifică setările SMTP). Poți folosi parola temporară.', 'warning');
    return res.redirect(`/admin/utilizatori/${u.id}`);
  }
  await noteaza(res, 'link_resetare', 'utilizator', u.id, u.numeComplet);
  mesajFlash(req, `I-am trimis lui ${u.numeComplet} un link de resetare pe ${u.email} (valabil o oră).`);
  res.redirect(`/admin/utilizatori/${u.id}`);
}

// POST /admin/utilizatori/:id/retrimite-confirmare - pentru cine nu a gasit emailul de confirmare
async function retrimiteConfirmare(req, res) {
  const u = await utilizatorAdministrabil(req, res);
  if (!u) return;
  if (u.emailConfirmat) {
    mesajFlash(req, 'Adresa de email este deja confirmată.', 'warning');
    return res.redirect(`/admin/utilizatori/${u.id}`);
  }
  await trimiteConfirmarea(u);
  await noteaza(res, 'link_confirmare', 'utilizator', u.id, u.numeComplet);
  mesajFlash(req, `Am retrimis linkul de confirmare pe ${u.email}.`);
  res.redirect(`/admin/utilizatori/${u.id}`);
}

module.exports = {
  index,
  trimiteLinkParola,
  retrimiteConfirmare,
  details,
  blocheaza: (req, res) => schimbaStare(req, res, 'blocat'),
  deblocheaza: (req, res) => schimbaStare(req, res, 'activ'),
  reseteazaParola,
};
