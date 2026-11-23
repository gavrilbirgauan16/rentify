// Controller-ul pentru abonamente (admin): lista cu filtre, Detalii (cu istoricul platilor), Create,
// adaugarea unei plati si Anularea. Un abonament nu se sterge si nu se editeaza: e un "contract" cu pret inghetat.
// Logica e in serviciul abonamenteAdmin (primit prin injectie, laboratorul 10); aici doar cererea, mesajele si pagina.
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { ROLURI_CU_ABONAMENT, SORTARI } = require('../servicii/abonamenteAdmin');
const { citesteId, negasit, mesajFlash } = require('../utils/http');
const F = require('../servicii/filtre');

const abonamentNegasit = (res) => negasit(res, 'Abonamentul nu există', 'Abonamentul căutat nu a fost găsit.');

// Filtrele din adresa listei (?stare=neplatit&expira=7).
const FILTRE = {
  q: { tip: 'text' },
  rol: { tip: 'enum', valori: ROLURI_CU_ABONAMENT },
  stare: { tip: 'enum', valori: Object.keys(AbonamentViewModel.STARI) },
  plan: { tip: 'id' },
  perioada: { tip: 'enum', valori: Object.keys(AbonamentViewModel.PERIOADE) },
  expira: { tip: 'enum', valori: ['7', '30'] },
  sort: { tip: 'enum', valori: Object.keys(SORTARI), implicit: 'noi' },
};
const PE_PAGINA = 20;

module.exports = function AbonamenteController({ abonamenteAdmin: serviciu }) {
  // Listele pentru formularul de Create + textele fixe.
  const dateFormular = async () => ({
    ...(await serviciu.dateFormular()),
    perioade: AbonamentViewModel.PERIOADE,
    metode: AbonamentViewModel.METODE,
    lei: AbonamentViewModel.lei,
  });

  // Pagina de detalii; cu erori (plata gresita) raspunde 400 si pastreaza ce a scris adminul.
  async function arataDetalii(req, res, erori = {}, plataIntrodusa = {}) {
    const id = citesteId(req);
    const date = id && (await serviciu.detalii(id));
    if (!date) return abonamentNegasit(res);
    res.status(Object.keys(erori).length ? 400 : 200).render('admin/abonamente/details', {
      ...date,
      metode: AbonamentViewModel.METODE,
      erori,
      plataIntrodusa,
    });
  }

  // GET /admin/abonamente
  async function index(req, res) {
    const f = F.citesteFiltre(req.query, FILTRE);
    const { randuri, pag, planuri } = await serviciu.lista(f, PE_PAGINA);
    res.render('admin/abonamente/index', {
      abonamente: randuri,
      ...F.pentruPagina('/admin/abonamente', f, FILTRE, pag),
      stari: AbonamentViewModel.STARI,
      perioade: AbonamentViewModel.PERIOADE,
      planuri,
    });
  }

  // GET /admin/abonamente/create (?utilizator=ID preselecteaza utilizatorul, ex. din pagina lui)
  async function createGet(req, res) {
    const model = new AbonamentViewModel({ utilizator_id: Number(req.query.utilizator) || '' });
    res.render('admin/abonamente/create', { a: model, erori: {}, ...(await dateFormular()) });
  }

  // POST /admin/abonamente/create
  async function createPost(req, res) {
    const r = await serviciu.adauga(req.body, res.locals.utilizator);
    if (r.erori) return res.status(400).render('admin/abonamente/create', { a: r.model, erori: r.erori, ...(await dateFormular()) });
    mesajFlash(req, `Abonamentul „${r.plan.nume}” pentru ${r.u.prenume} ${r.u.nume} a fost creat.`);
    res.redirect(`/admin/abonamente/${r.nou.id}`);
  }

  // POST /admin/abonamente/:id/plati - inregistreaza o plata (ex. a platit prin transfer)
  async function plataPost(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.adaugaPlata(id, req.body, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return abonamentNegasit(res);
    if (r.erori) return arataDetalii(req, res, r.erori, req.body);
    if (r.refuzat) mesajFlash(req, r.refuzat, 'warning');
    else mesajFlash(req, `Plata de ${AbonamentViewModel.lei(r.plata.suma)} a fost înregistrată.`);
    res.redirect(`/admin/abonamente/${id}`);
  }

  // POST /admin/abonamente/:id/anuleaza
  async function anuleaza(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.anuleaza(id, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return abonamentNegasit(res);
    if (r.nuSePoate) mesajFlash(req, 'Abonamentul nu mai poate fi anulat (este deja anulat sau expirat).', 'warning');
    else mesajFlash(req, `Abonamentul lui ${r.a.utilizator_nume} a fost anulat. Istoricul plăților rămâne păstrat.`);
    res.redirect(`/admin/abonamente/${id}`);
  }

  return { index, details: (req, res) => arataDetalii(req, res), createGet, createPost, plataPost, anuleaza };
};
