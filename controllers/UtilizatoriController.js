// Controller-ul pentru utilizatori (in admin): lista cu filtre, Detalii, Blocare / Deblocare si Resetarea parolei.
// Conturile noi nu se fac de aici: proprietarii si chiriasii isi vor face singuri cont (inregistrare).
// Logica e in serviciul utilizatoriAdmin (primit prin injectie, laboratorul 10); aici doar cererea, mesajele si pagina.
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const { SITUATII, SORTARI } = require('../servicii/utilizatoriAdmin');
const { citesteId, negasit, mesajFlash } = require('../utils/http');
const F = require('../servicii/filtre');

const utilizatorNegasit = (res) => negasit(res, 'Utilizatorul nu există', 'Utilizatorul căutat nu a fost găsit.');

// Filtrele din adresa listei (?rol=proprietar&situatie=neplatit).
const FILTRE = {
  q: { tip: 'text' },
  rol: { tip: 'enum', valori: Object.keys(UtilizatorViewModel.ROLURI) },
  stare: { tip: 'enum', valori: Object.keys(UtilizatorViewModel.STARI) },
  situatie: { tip: 'enum', valori: Object.keys(SITUATII) },
  sort: { tip: 'enum', valori: Object.keys(SORTARI), implicit: 'nume' },
};
const PE_PAGINA = 25;

// Raspunsurile comune ale actiunilor pe un utilizator: nu exista (404) sau e un cont de administrator.
// Intoarce true daca a raspuns deja.
function aRaspuns(req, res, id, r) {
  if (r.negasit) {
    utilizatorNegasit(res);
    return true;
  }
  if (r.interzis) {
    mesajFlash(req, 'Conturile de administrator (inclusiv al tău) nu pot fi blocate sau resetate de aici.', 'warning');
    res.redirect(`/admin/utilizatori/${id}`);
    return true;
  }
  return false;
}

module.exports = function UtilizatoriController({ utilizatoriAdmin: serviciu }) {
  // Ruleaza o actiune a serviciului pe utilizatorul din adresa (id gresit = 404, fara sa intrebe baza de date).
  const peUtilizator = (req, actiune) => {
    const id = citesteId(req);
    return id ? actiune(id) : { negasit: true };
  };

  // GET /admin/utilizatori
  async function index(req, res) {
    const f = F.citesteFiltre(req.query, FILTRE);
    const { randuri, pag } = await serviciu.lista(f, PE_PAGINA);
    res.render('admin/utilizatori/index', {
      utilizatori: randuri,
      ...F.pentruPagina('/admin/utilizatori', f, FILTRE, pag),
      roluri: UtilizatorViewModel.ROLURI,
      stari: UtilizatorViewModel.STARI,
      situatii: SITUATII,
    });
  }

  // GET /admin/utilizatori/:id
  async function details(req, res) {
    const id = citesteId(req);
    const date = id && (await serviciu.detalii(id));
    if (!date) return utilizatorNegasit(res);
    res.render('admin/utilizatori/details', date);
  }

  // POST /admin/utilizatori/:id/blocheaza si /deblocheaza
  async function schimbaStare(req, res, stare) {
    const id = citesteId(req);
    const r = await peUtilizator(req, (i) => serviciu.schimbaStare(i, stare, res.locals.utilizator));
    if (aRaspuns(req, res, id, r)) return;
    if (r.schimbat) {
      mesajFlash(req, stare === 'blocat'
        ? `Contul lui ${r.u.numeComplet} a fost blocat. Dacă era conectat, este deconectat imediat.`
        : `Contul lui ${r.u.numeComplet} a fost deblocat.`);
    }
    res.redirect(`/admin/utilizatori/${r.u.id}`);
  }

  // POST /admin/utilizatori/:id/reseteaza-parola
  // Parola temporara se arata O SINGURA DATA adminului; utilizatorul e obligat s-o schimbe la prima conectare.
  async function reseteazaParola(req, res) {
    const id = citesteId(req);
    const r = await peUtilizator(req, (i) => serviciu.reseteazaParola(i, res.locals.utilizator));
    if (aRaspuns(req, res, id, r)) return;
    // Parola NU se pune in mesajul flash (care se salveaza in sesiune, in baza de date):
    // o afisam direct, in raspuns, si cerem browserului sa nu pastreze pagina.
    res.set('Cache-Control', 'no-store');
    res.render('admin/utilizatori/parola-temporara', { u: r.u, parola: r.parola });
  }

  // POST /admin/utilizatori/:id/trimite-link-resetare - varianta recomandata: utilizatorul isi alege singur
  // parola din linkul primit pe email (adminul nu afla nicio parola). Parola veche merge pana foloseste linkul.
  async function trimiteLinkParola(req, res) {
    const id = citesteId(req);
    const r = await peUtilizator(req, (i) => serviciu.trimiteLinkParola(i, res.locals.utilizator));
    if (aRaspuns(req, res, id, r)) return;
    if (r.blocat) mesajFlash(req, 'Contul este blocat: deblochează-l întâi, altfel utilizatorul nu se poate conecta oricum.', 'warning');
    else if (r.neplecat) mesajFlash(req, 'Emailul nu a putut fi trimis (verifică setările SMTP). Poți folosi parola temporară.', 'warning');
    else mesajFlash(req, `I-am trimis lui ${r.u.numeComplet} un link de resetare pe ${r.u.email} (valabil o oră).`);
    res.redirect(`/admin/utilizatori/${r.u.id}`);
  }

  // POST /admin/utilizatori/:id/retrimite-confirmare - pentru cine nu a gasit emailul de confirmare
  async function retrimiteConfirmare(req, res) {
    const id = citesteId(req);
    const r = await peUtilizator(req, (i) => serviciu.retrimiteConfirmare(i, res.locals.utilizator));
    if (aRaspuns(req, res, id, r)) return;
    if (r.dejaConfirmat) mesajFlash(req, 'Adresa de email este deja confirmată.', 'warning');
    else mesajFlash(req, `Am retrimis linkul de confirmare pe ${r.u.email}.`);
    res.redirect(`/admin/utilizatori/${r.u.id}`);
  }

  return {
    index,
    details,
    blocheaza: (req, res) => schimbaStare(req, res, 'blocat'),
    deblocheaza: (req, res) => schimbaStare(req, res, 'activ'),
    reseteazaParola,
    trimiteLinkParola,
    retrimiteConfirmare,
  };
};
