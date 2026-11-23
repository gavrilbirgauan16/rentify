// Controller-ul pentru proprietati (admin): Index, Details, Create (GET/POST), Edit (GET/POST), Activeaza / Dezactiveaza.
// Logica e in serviciul proprietatiAdmin (primit prin injectie, laboratorul 10); aici doar cererea si pagina.
// Erorile neprevazute ajung automat la handler-ul de erori din app.js (Express 5).
const ProprietateViewModel = require('../models/ProprietateViewModel');
const { SORTARI } = require('../servicii/proprietatiAdmin');
const { citesteId, negasit, mesajFlash, adresaInapoi } = require('../utils/http');
const F = require('../servicii/filtre');

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

// Filtrele din adresa listei (?oras=Suceava&sort=camere).
const FILTRE = {
  q: { tip: 'text' },
  oras: { tip: 'text' },
  tip: { tip: 'enum', valori: ProprietateViewModel.TIPURI },
  stare: { tip: 'enum', valori: ProprietateViewModel.STARI },
  camere_min: { tip: 'intreg', min: 1 },
  balcon: { tip: 'enum', valori: ['da', 'nu'] },
  proprietar: { tip: 'id' },
  anunturi: { tip: 'enum', valori: ['fara', 'cu'] },
  sort: { tip: 'enum', valori: Object.keys(SORTARI), implicit: 'noi' },
};
const PE_PAGINA = 20;

// Textele pentru listele de selectie (comune listei si formularelor).
const ETICHETE = {
  tipuri: ProprietateViewModel.TIPURI,
  stari: ProprietateViewModel.STARI,
  eticheteTip: ProprietateViewModel.ETICHETE_TIP,
  eticheteStare: ProprietateViewModel.ETICHETE_STARE,
};

module.exports = function ProprietatiController({ proprietatiAdmin: serviciu }) {
  // Datele comune pentru formularele Create si Edit (listele de selectie).
  const dateFormular = async () => ({ ...ETICHETE, proprietari: await serviciu.proprietari() });

  // GET /admin/proprietati - lista cu filtre, sortare si paginare
  async function index(req, res) {
    const f = F.citesteFiltre(req.query, FILTRE);
    const { randuri, pag, orase, proprietari } = await serviciu.lista(f, PE_PAGINA);
    res.render('admin/proprietati/index', {
      proprietati: randuri,
      ...F.pentruPagina('/admin/proprietati', f, FILTRE, pag),
      orase,
      proprietari,
      ...ETICHETE,
    });
  }

  // GET /admin/proprietati/:id - detaliile unei proprietati
  async function details(req, res) {
    const id = citesteId(req);
    const date = id && (await serviciu.detalii(id));
    if (!date) return proprietateNegasita(res);
    res.render('admin/proprietati/details', date);
  }

  // GET /admin/proprietati/create - formularul gol
  async function createGet(req, res) {
    res.render('admin/proprietati/create', { p: new ProprietateViewModel(), erori: {}, ...(await dateFormular()) });
  }

  // POST /admin/proprietati/create - salvarea proprietatii noi
  async function createPost(req, res) {
    const r = await serviciu.adauga(req.body, res.locals.utilizator);
    if (r.erori) return res.status(400).render('admin/proprietati/create', { p: r.model, erori: r.erori, ...(await dateFormular()) });
    // Adminul nu e blocat de limita planului, dar e avertizat.
    mesajFlash(req, `Proprietatea „${r.noua.denumire}” a fost adăugată.` + (r.avertizare ? ` ${r.avertizare}` : ''), r.avertizare ? 'warning' : 'success');
    res.redirect(`/admin/proprietati/${r.noua.id}`); // Post/Redirect/Get: refresh-ul nu mai trimite formularul a doua oara
  }

  // GET /admin/proprietati/:id/edit - formularul completat cu datele existente
  async function editGet(req, res) {
    const id = citesteId(req);
    const p = id && (await serviciu.getModel(id));
    if (!p) return proprietateNegasita(res);
    res.render('admin/proprietati/edit', { p, erori: {}, ...(await dateFormular()) });
  }

  // POST /admin/proprietati/:id/edit - salvarea modificarilor
  async function editPost(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.modifica(id, req.body, res.locals.utilizator) : { negasita: true };
    if (r.negasita) return proprietateNegasita(res);
    if (r.erori) return res.status(400).render('admin/proprietati/edit', { p: r.model, erori: r.erori, ...(await dateFormular()) });
    mesajFlash(req, 'Modificările au fost salvate.' + textAnunturi(r.rezultat));
    res.redirect(`/admin/proprietati/${id}`);
  }

  // POST /admin/proprietati/:id/dezactiveaza si /activeaza (odata cu anunturile ei)
  async function schimbaStare(req, res, stare) {
    const id = citesteId(req);
    const r = id ? await serviciu.schimbaStare(id, stare, res.locals.utilizator) : { negasita: true };
    if (r.negasita) return proprietateNegasita(res);
    const verb = stare === 'inactiv' ? 'dezactivată' : 'activată';
    mesajFlash(req, `Proprietatea „${r.denumire}” a fost ${verb}.` + textAnunturi(r.rezultat));
    res.redirect(inapoi(req));
  }

  return {
    index,
    details,
    createGet,
    createPost,
    editGet,
    editPost,
    dezactiveaza: (req, res) => schimbaStare(req, res, 'inactiv'),
    activeaza: (req, res) => schimbaStare(req, res, 'liber'),
  };
};
