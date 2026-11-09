// Controller-ul pentru anunturi: Index, Create, Edit (GET/POST), butoanele Activeaza / Dezactiveaza
// si imaginile anunturilor.
const AnuntAccessor = require('../src/NivelAccesDate/AnuntAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const AnuntViewModel = require('../models/AnuntViewModel');
const { stergeFisiere, MAX_IMAGINI, MAX_MB } = require('../middleware/incarcareImagini');
const { citesteId, negasit, mesajFlash } = require('../utils/http');

const anunturi = new AnuntAccessor();
const proprietati = new ProprietateAccessor();

// Pagina 404 pentru un anunt care nu exista.
const anuntNegasit = (res) => negasit(res, 'Anunțul nu există', 'Anunțul căutat nu a fost găsit.');

// Datele pentru formular: listele de selectie, inclusiv proprietatile (cheia straina).
// In lista apar doar proprietatile active; la Edit apare si proprietatea actuala, chiar daca e inactiva.
async function dateFormular(proprietateActuala = null) {
  const lista = await proprietati.getDisponibile();
  if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) {
    lista.push(proprietateActuala);
  }
  return {
    tipuri: AnuntViewModel.TIPURI,
    stari: AnuntViewModel.STARI,
    monede: AnuntViewModel.MONEDE,
    eticheteTip: AnuntViewModel.ETICHETE_TIP,
    eticheteStare: AnuntViewModel.ETICHETE_STARE,
    maxImagini: MAX_IMAGINI,
    maxMb: MAX_MB,
    proprietati: lista,
  };
}

// Verificarile care tin de legatura cu proprietatea (le adauga peste erorile din model).
function verificaProprietatea(model, listaProprietati, erori) {
  if (!model.proprietate_id) return;
  const aleasa = listaProprietati.find((p) => String(p.id) === String(model.proprietate_id));
  if (!aleasa) {
    erori.proprietate_id = 'Proprietatea aleasă nu există sau este inactivă.'; // cineva a trimis un id inventat
  } else if (aleasa.stare === 'inactiv' && model.stare !== 'inactiv') {
    erori.stare = 'Proprietatea este inactivă, deci anunțul poate fi doar Inactiv.';
  }
}

// Imaginile primite de la formular, in forma pentru baza de date.
function imaginiIncarcate(req) {
  return req.files.map((f) => ({ nume: f.originalname, cale: `/uploads/anunturi/${f.filename}` }));
}

// Id-urile imaginilor bifate la "Sterge" (pot veni ca text sau ca lista).
function imaginiDeSters(req) {
  return [].concat(req.body.sterge_imagini || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

// Verificarile pentru imagini: eroarea de la incarcare si numarul maxim pe anunt.
function verificaImaginile(req, numarRamase, erori) {
  if (req.eroareImagini) {
    erori.imagini = req.eroareImagini;
  } else if (numarRamase + req.files.length > MAX_IMAGINI) {
    erori.imagini = `Un anunț poate avea cel mult ${MAX_IMAGINI} imagini.`;
  }
  // Daca formularul are erori, imaginile alese trebuie selectate din nou (browserul nu le pastreaza).
  if (Object.keys(erori).length > 0 && req.files.length > 0 && !erori.imagini) {
    erori.imagini = 'Formularul are erori: alege din nou imaginile.';
  }
}

// GET /admin/anunturi - lista anunturilor, cu date din anunt, proprietate, proprietar si imagini
async function index(req, res) {
  const entitati = await anunturi.getAll();
  const imagini = await anunturi.getImagini(entitati.map((a) => a.id));
  const lista = entitati.map((a) => AnuntViewModel.dinEntitate(a, imagini.filter((f) => f.entitate_id === a.id)));
  res.render('admin/anunturi/index', { anunturi: lista });
}

// GET /admin/anunturi/create - formularul gol
async function createGet(req, res) {
  res.render('admin/anunturi/create', { a: new AnuntViewModel(), erori: {}, ...(await dateFormular()) });
}

// POST /admin/anunturi/create - salvarea anuntului nou, cu imaginile lui
async function createPost(req, res) {
  const model = AnuntViewModel.dinFormular(req.body);
  const date = await dateFormular();
  const erori = model.valideaza();
  verificaProprietatea(model, date.proprietati, erori);
  verificaImaginile(req, 0, erori);

  const imagini = imaginiIncarcate(req);
  if (Object.keys(erori).length > 0) {
    stergeFisiere(imagini.map((i) => i.cale)); // anuntul nu se salveaza, deci nici imaginile
    return res.status(400).render('admin/anunturi/create', { a: model, erori, ...date });
  }
  const nou = await anunturi.addEntity(model.catreEntitate(), imagini, res.locals.utilizator.id); // cine a incarcat pozele
  mesajFlash(req, `Anunțul „${nou.titlu}” a fost adăugat.`);
  res.redirect('/admin/anunturi'); // Post/Redirect/Get
}

// GET /admin/anunturi/:id/edit - formularul completat cu datele existente si imaginile actuale
async function editGet(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  const model = AnuntViewModel.dinEntitate(entitate, await anunturi.getImagini([id]));
  res.render('admin/anunturi/edit', { a: model, erori: {}, ...(await dateFormular(entitate.proprietate)) });
}

// POST /admin/anunturi/:id/edit - salvarea modificarilor (date + imagini noi + imagini sterse)
async function editPost(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) {
    stergeFisiere(imaginiIncarcate(req).map((i) => i.cale));
    return anuntNegasit(res);
  }

  const imaginiActuale = await anunturi.getImagini([id]);
  const deSters = imaginiDeSters(req);
  const model = AnuntViewModel.dinFormular(req.body);
  model.id = id;
  model.imagini = AnuntViewModel.dinEntitate(entitate, imaginiActuale).imagini;

  const date = await dateFormular(entitate.proprietate);
  const erori = model.valideaza();
  verificaProprietatea(model, date.proprietati, erori);
  const ramase = imaginiActuale.filter((f) => !deSters.includes(f.id)).length;
  verificaImaginile(req, ramase, erori);

  const imaginiNoi = imaginiIncarcate(req);
  if (Object.keys(erori).length > 0) {
    stergeFisiere(imaginiNoi.map((i) => i.cale));
    return res.status(400).render('admin/anunturi/edit', { a: model, erori, ...date });
  }
  const { caiSterse } = await anunturi.updateEntity(id, model.catreEntitate(), imaginiNoi, deSters, res.locals.utilizator.id);
  stergeFisiere(caiSterse); // imaginile sterse dispar si de pe disc
  mesajFlash(req, `Anunțul „${model.titlu}” a fost modificat.`);
  res.redirect('/admin/anunturi');
}

// POST /admin/anunturi/:id/activeaza - butonul Activeaza (doar daca proprietatea lui e activa)
async function activeaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  if (entitate.proprietate.stare === 'inactiv') {
    mesajFlash(req, `Anunțul nu poate fi activat: proprietatea „${entitate.proprietate.denumire}” este inactivă. Activează întâi proprietatea.`, 'warning');
    return res.redirect('/admin/anunturi');
  }
  await anunturi.schimbaStare(id, 'activ');
  mesajFlash(req, `Anunțul „${entitate.titlu}” a fost activat.`);
  res.redirect('/admin/anunturi');
}

// POST /admin/anunturi/:id/dezactiveaza - butonul Dezactiveaza
async function dezactiveaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  await anunturi.schimbaStare(id, 'inactiv');
  mesajFlash(req, `Anunțul „${entitate.titlu}” a fost dezactivat.`);
  res.redirect('/admin/anunturi');
}

module.exports = { index, createGet, createPost, editGet, editPost, activeaza, dezactiveaza, verificaProprietatea };