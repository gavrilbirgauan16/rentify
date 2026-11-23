// Controller-ul pentru anunturi (admin): Index, Details, Create, Edit (GET/POST), Activeaza / Dezactiveaza,
// moderarea (Aproba / Respinge) si Restaureaza (stergerea logica).
// Logica e in serviciul anunturiAdmin (primit prin injectie, laboratorul 10); aici doar cererea, mesajele si pagina.
const AnuntViewModel = require('../models/AnuntViewModel');
const { stergeFisiere, MAX_IMAGINI, MAX_MB } = require('../middleware/incarcareImagini');
const { SORTARI } = require('../servicii/anunturiAdmin');
const { citesteId, negasit, mesajFlash, adresaInapoi } = require('../utils/http');
const F = require('../servicii/filtre');

// Unde ne intoarcem dupa Activeaza / Dezactiveaza (lista cu filtrele ei sau pagina anuntului).
const inapoi = (req) => adresaInapoi(req, '/admin/anunturi');

// Filtrele din adresa listei (?stare=in_asteptare&sort=pret_asc).
const FILTRE = {
  q: { tip: 'text' },
  tip: { tip: 'enum', valori: AnuntViewModel.TIPURI },
  stare: { tip: 'enum', valori: AnuntViewModel.STARI },
  oras: { tip: 'text' },
  proprietar: { tip: 'id' },
  proprietate: { tip: 'id' },
  pret_min: { tip: 'numar' },
  pret_max: { tip: 'numar' },
  promovat: { tip: 'enum', valori: ['da', 'nu'] },
  problema: { tip: 'enum', valori: ['proprietate_inactiva', 'fara_disponibilitate'] },
  sterse: { tip: 'enum', valori: ['da'] }, // stergerea logica: "da" = DOAR anunturile sterse (de restaurat)
  sort: { tip: 'enum', valori: Object.keys(SORTARI), implicit: 'noi' },
};
const PE_PAGINA = 20;

// Pagina 404 pentru un anunt care nu exista.
const anuntNegasit = (res) => negasit(res, 'Anunțul nu există', 'Anunțul căutat nu a fost găsit.');

// Datele pentru formular: listele de selectie, inclusiv proprietatile (cheia straina, primite de la serviciu).
// Starile din formular: Ciorna / Activ / Inactiv, plus starea actuala la Edit (ex. "Respins"), ca sa poata ramane.
function dateFormular(proprietati, stareActuala = null) {
  const stari = [...AnuntViewModel.STARI_FORMULAR];
  if (stareActuala && !stari.includes(stareActuala)) stari.push(stareActuala);
  return {
    tipuri: AnuntViewModel.TIPURI,
    stari,
    monede: AnuntViewModel.MONEDE,
    eticheteTip: AnuntViewModel.ETICHETE_TIP,
    eticheteStare: AnuntViewModel.ETICHETE_STARE,
    maxImagini: MAX_IMAGINI,
    maxMb: MAX_MB,
    proprietati,
  };
}

// Imaginile primite de la formular, in forma pentru baza de date.
function imaginiIncarcate(req) {
  return req.files.map((f) => ({ nume: f.originalname, cale: `/uploads/anunturi/${f.filename}` }));
}

// Id-urile imaginilor bifate la "Sterge" (pot veni ca text sau ca lista).
function imaginiDeSters(req) {
  return [].concat(req.body.sterge_imagini || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

// Mesajul si redirectionarea pentru un anunt "In asteptare" (adminul nu-i schimba continutul).
function blocatInAsteptare(req, res, id) {
  mesajFlash(req, 'Anunțul așteaptă aprobarea: nu-l poți modifica. Dacă trebuie corectat, respinge-l cu motivul, iar proprietarul îl corectează.', 'warning');
  res.redirect(`/admin/anunturi/${id}`);
}

function AnunturiController({ anunturiAdmin: serviciu }) {
  // GET /admin/anunturi - lista anunturilor, cu date din anunt, proprietate, proprietar si imagini
  async function index(req, res) {
    const f = F.citesteFiltre(req.query, FILTRE);
    const { randuri, pag, orase, proprietari, proprietateAleasa } = await serviciu.lista(f, PE_PAGINA);
    res.render('admin/anunturi/index', {
      anunturi: randuri,
      ...F.pentruPagina('/admin/anunturi', f, FILTRE, pag),
      orase,
      proprietari,
      proprietateAleasa,
      tipuri: AnuntViewModel.TIPURI,
      stari: AnuntViewModel.STARI,
      eticheteTip: AnuntViewModel.ETICHETE_TIP,
      eticheteStare: AnuntViewModel.ETICHETE_STARE,
    });
  }

  // GET /admin/anunturi/:id - pagina unui anunt (aceleasi detalii ca fereastra din lista + istoricul)
  async function details(req, res) {
    const id = citesteId(req);
    const date = id && (await serviciu.detalii(id));
    if (!date) return anuntNegasit(res);
    res.render('admin/anunturi/details', date);
  }

  // GET /admin/anunturi/create - formularul gol
  async function createGet(req, res) {
    res.render('admin/anunturi/create', { a: new AnuntViewModel(), erori: {}, ...dateFormular(await serviciu.proprietatiPentruFormular()) });
  }

  // POST /admin/anunturi/create - salvarea anuntului nou, cu imaginile lui
  async function createPost(req, res) {
    const r = await serviciu.adauga(req.body, { noi: imaginiIncarcate(req), eroare: req.eroareImagini || null }, res.locals.utilizator);
    if (r.erori) return res.status(400).render('admin/anunturi/create', { a: r.model, erori: r.erori, ...dateFormular(r.lista) });
    mesajFlash(req, `Anunțul „${r.anunt.titlu}” a fost adăugat.`);
    res.redirect('/admin/anunturi'); // Post/Redirect/Get
  }

  // GET /admin/anunturi/:id/edit - formularul completat cu datele existente si imaginile actuale
  async function editGet(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.pentruModificare(id) : { negasit: true };
    if (r.negasit) return anuntNegasit(res);
    if (r.inAsteptare) return blocatInAsteptare(req, res, id);
    res.render('admin/anunturi/edit', { a: r.model, erori: {}, ...dateFormular(r.lista, r.stareActuala) });
  }

  // POST /admin/anunturi/:id/edit - salvarea modificarilor (date + imagini noi + imagini sterse)
  async function editPost(req, res) {
    const id = citesteId(req);
    const imagini = { noi: imaginiIncarcate(req), eroare: req.eroareImagini || null, deSters: imaginiDeSters(req) };
    if (!id) {
      stergeFisiere(imagini.noi.map((i) => i.cale)); // anuntul nu exista, deci pozele abia primite nu se pastreaza
      return anuntNegasit(res);
    }
    const r = await serviciu.modifica(id, req.body, imagini, res.locals.utilizator);
    if (r.negasit) return anuntNegasit(res);
    if (r.inAsteptare) return blocatInAsteptare(req, res, id);
    if (r.erori) return res.status(400).render('admin/anunturi/edit', { a: r.model, erori: r.erori, ...dateFormular(r.lista, r.stareActuala) });
    mesajFlash(req, `Anunțul „${r.model.titlu}” a fost modificat.`);
    res.redirect('/admin/anunturi');
  }

  // POST /admin/anunturi/:id/activeaza - butonul Activeaza (doar daca proprietatea lui e activa)
  async function activeaza(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.activeaza(id, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return anuntNegasit(res);
    if (r.inAsteptare) {
      mesajFlash(req, 'Anunțul așteaptă aprobarea: deschide-l, verifică-l și apasă „Aprobă”.', 'warning');
      return res.redirect(`/admin/anunturi/${id}`);
    }
    if (r.proprietateInactiva) {
      mesajFlash(req, `Anunțul nu poate fi activat: proprietatea „${r.proprietateInactiva}” este inactivă. Activează întâi proprietatea.`, 'warning');
      return res.redirect(inapoi(req));
    }
    mesajFlash(req, `Anunțul „${r.titlu}” a fost activat.`);
    res.redirect(inapoi(req));
  }

  // POST /admin/anunturi/:id/dezactiveaza - butonul Dezactiveaza
  async function dezactiveaza(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.dezactiveaza(id, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return anuntNegasit(res);
    mesajFlash(req, `Anunțul „${r.titlu}” a fost dezactivat.`);
    res.redirect(inapoi(req));
  }

  // POST /admin/anunturi/:id/aproba - anuntul in asteptare devine activ (public)
  async function aproba(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.aproba(id, req.body.versiune, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return anuntNegasit(res);
    if (r.proprietateInactiva) {
      mesajFlash(req, `Anunțul nu poate fi aprobat: proprietatea „${r.proprietateInactiva}” este inactivă.`, 'warning');
      return res.redirect(inapoi(req));
    }
    if (r.versiuneVeche) {
      mesajFlash(req, 'Proprietarul a modificat anunțul între timp. Verifică varianta nouă și apoi aprobă-l.', 'warning');
      return res.redirect(`/admin/anunturi/${id}`);
    }
    if (r.nuMaiAsteapta) {
      mesajFlash(req, 'Anunțul nu mai așteaptă aprobarea (poate a fost deja aprobat sau retras de proprietar).', 'warning');
      return res.redirect(inapoi(req));
    }
    mesajFlash(req, `Anunțul „${r.titlu}” a fost aprobat și apare pe site. Proprietarul a fost anunțat pe email.`);
    res.redirect(inapoi(req));
  }

  // POST /admin/anunturi/:id/respinge - cu motiv obligatoriu
  async function respinge(req, res) {
    const id = citesteId(req);
    const r = id ? await serviciu.respinge(id, req.body.motiv, res.locals.utilizator) : { negasit: true };
    if (r.negasit) return anuntNegasit(res);
    if (r.eroare) mesajFlash(req, r.eroare, 'warning');
    else if (r.nuSePoate) mesajFlash(req, 'Doar un anunț în așteptare sau activ poate fi respins.', 'warning');
    else mesajFlash(req, `Anunțul „${r.titlu}” a fost respins. Proprietarul a primit motivul pe email.`);
    res.redirect(`/admin/anunturi/${id}`);
  }

  // POST /admin/anunturi/:id/restaureaza - readuce un anunt sters logic, ca CIORNA (proprietarul il verifica si
  // il trimite din nou spre aprobare). Doar adminul poate restaura; actiunea se scrie in jurnal.
  async function restaureaza(req, res) {
    const id = citesteId(req);
    const anunt = id && (await serviciu.restaureaza(id, res.locals.utilizator));
    if (!anunt) {
      mesajFlash(req, 'Anunțul nu mai este printre cele șterse (poate a fost deja restaurat).', 'warning');
      return res.redirect('/admin/anunturi?sterse=da');
    }
    mesajFlash(req, `Anunțul „${anunt.titlu}” a fost restaurat ca ciornă. Proprietarul îl poate trimite din nou spre aprobare.`);
    res.redirect(inapoi(req));
  }

  return { index, details, createGet, createPost, editGet, editPost, activeaza, dezactiveaza, aproba, respinge, restaureaza };
}

module.exports = AnunturiController;
// Ajutoare pentru imaginile din cerere, folosite si de zona proprietarului (pagini si API).
module.exports.imaginiIncarcate = imaginiIncarcate;
module.exports.imaginiDeSters = imaginiDeSters;
