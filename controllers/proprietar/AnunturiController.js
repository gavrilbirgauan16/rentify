// Controller-ul "Anunturile mele" (zona proprietarului): lista, adaugare si editare cu imagini, activare / dezactivare.
// Regulile de securitate, la fiecare actiune:
//   1. Proprietarul vede si schimba DOAR anunturile lui (anuntul e al lui daca proprietatea anuntului e a lui).
//   2. Poate alege DOAR proprietatile lui, active (altfel ar putea publica un anunt pe casa altcuiva).
//   3. "Promovat" nu se poate bifa de aici (e o functie platita): se ignora orice trimite browserul.
//   4. Limita de anunturi active din plan se verifica la orice trecere in starea Activ.
const AnuntAccessor = require('../../src/NivelAccesDate/AnuntAccessor');
const ProprietateAccessor = require('../../src/NivelAccesDate/ProprietateAccessor');
const AnuntViewModel = require('../../models/AnuntViewModel');
const { verificaProprietatea, imaginiIncarcate, imaginiDeSters, verificaImaginile } = require('../AnunturiController');
const { stergeFisiere, MAX_IMAGINI, MAX_MB } = require('../../middleware/incarcareImagini');
const { situatieAnunturi } = require('../../servicii/verificariPlan');
const { textBlocare, CUVINTE_ANUNTURI } = require('../../servicii/limite');
const { citesteId, negasit, mesajFlash } = require('../../utils/http');

const anunturi = new AnuntAccessor();
const proprietati = new ProprietateAccessor();

const LISTA = '/proprietar/anunturi';

const anuntNegasit = (res) => negasit(res, 'Anunțul nu există', 'Anunțul căutat nu a fost găsit printre anunțurile tale.');

// Lista de proprietati din formular: doar ale lui si active. La Edit apare si proprietatea actuala,
// chiar daca e inactiva (atunci anuntul poate fi doar Inactiv - verificat de verificaProprietatea).
async function proprietatiPentruFormular(proprietarId, proprietateActuala = null) {
  const lista = await proprietati.getDisponibileAleProprietarului(proprietarId);
  if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) lista.push(proprietateActuala);
  return lista;
}

// Pagina formularului (aceeasi pentru Create si Edit; titlul si adresa difera).
function afiseazaFormular(res, { a, erori = {}, lista, status = 200 }) {
  const editare = Boolean(a.id);
  res.status(status).render('proprietar/anunturi/formular', {
    a,
    erori,
    titlu: editare ? 'Editează anunțul' : 'Adaugă anunț',
    actiune: editare ? `${LISTA}/${a.id}/edit` : `${LISTA}/create`,
    tipuri: AnuntViewModel.TIPURI,
    stari: AnuntViewModel.STARI,
    monede: AnuntViewModel.MONEDE,
    eticheteTip: AnuntViewModel.ETICHETE_TIP,
    eticheteStare: AnuntViewModel.ETICHETE_STARE,
    maxImagini: MAX_IMAGINI,
    maxMb: MAX_MB,
    proprietati: lista,
  });
}

// Daca anuntul TRECE in starea Activ, verificam limita din plan; intoarce textul erorii sau null.
async function verificaLimita(req, stareNoua, stareVeche = null) {
  if (stareNoua !== 'activ' || stareVeche === 'activ') return null;
  const s = await situatieAnunturi(req.idUtilizator);
  return s.poateAdauga ? null : textBlocare(s, CUVINTE_ANUNTURI);
}

// Fara nicio proprietate activa nu are ce anunta: il trimitem la proprietati, cu explicatia.
function faraProprietati(req, res) {
  mesajFlash(req, 'Ca să publici un anunț, ai nevoie de o proprietate activă. Adaug-o sau activeaz-o mai întâi.', 'warning');
  return res.redirect('/proprietar/proprietati');
}

// GET /proprietar/anunturi - anunturile mele, cu cate anunturi active mai permite planul
async function index(req, res) {
  const [entitati, limita, active] = await Promise.all([
    anunturi.getAleProprietarului(req.idUtilizator),
    situatieAnunturi(req.idUtilizator),
    proprietati.getDisponibileAleProprietarului(req.idUtilizator),
  ]);
  const imagini = await anunturi.getImagini(entitati.map((a) => a.id));
  res.render('proprietar/anunturi/index', {
    anunturi: entitati.map((a) => AnuntViewModel.dinEntitate(a, imagini.filter((img) => img.entitate_id === a.id))),
    limita,
    textLimita: limita.poateAdauga ? null : textBlocare(limita, CUVINTE_ANUNTURI),
    areProprietatiActive: active.length > 0,
  });
}

// GET /proprietar/anunturi/create - formularul gol (are nevoie de cel putin o proprietate activa)
async function createGet(req, res) {
  const lista = await proprietatiPentruFormular(req.idUtilizator);
  if (lista.length === 0) return faraProprietati(req, res);
  afiseazaFormular(res, { a: new AnuntViewModel({ stare: 'ciorna', proprietate_id: lista.length === 1 ? lista[0].id : '' }), lista });
}

// POST /proprietar/anunturi/create - salvarea anuntului nou, cu imaginile lui
async function createPost(req, res) {
  const model = AnuntViewModel.dinFormular(req.body);
  model.promovat = false; // promovarea nu se alege de aici
  const lista = await proprietatiPentruFormular(req.idUtilizator);
  if (lista.length === 0) {
    stergeFisiere(imaginiIncarcate(req).map((i) => i.cale));
    return faraProprietati(req, res);
  }
  const erori = model.valideaza();
  verificaProprietatea(model, lista, erori); // proprietatea trebuie sa fie A LUI si activa
  const eroareLimita = await verificaLimita(req, model.stare);
  if (eroareLimita) erori.stare = `${eroareLimita} Poți salva anunțul ca Ciornă.`;
  verificaImaginile(req, 0, erori);

  const imagini = imaginiIncarcate(req);
  if (Object.keys(erori).length > 0) {
    stergeFisiere(imagini.map((i) => i.cale)); // anuntul nu se salveaza, deci nici imaginile
    return afiseazaFormular(res, { a: model, erori, lista, status: 400 });
  }
  const nou = await anunturi.addEntity(model.catreEntitate(), imagini, req.idUtilizator);
  mesajFlash(req, `Anunțul „${nou.titlu}” a fost salvat${nou.stare === 'activ' ? ' și publicat' : ''}.`);
  res.redirect(LISTA); // Post/Redirect/Get
}

// GET /proprietar/anunturi/:id/edit - formularul completat, cu imaginile actuale (doar anunturile mele)
async function editGet(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return anuntNegasit(res);
  const [imagini, lista] = await Promise.all([
    anunturi.getImagini([id]),
    proprietatiPentruFormular(req.idUtilizator, entitate.proprietate),
  ]);
  afiseazaFormular(res, { a: AnuntViewModel.dinEntitate(entitate, imagini), lista });
}

// POST /proprietar/anunturi/:id/edit - salvarea modificarilor (date + imagini noi + imagini sterse)
async function editPost(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) {
    stergeFisiere(imaginiIncarcate(req).map((i) => i.cale));
    return anuntNegasit(res);
  }

  const imaginiActuale = await anunturi.getImagini([id]);
  const deSters = imaginiDeSters(req); // accesorul sterge doar imaginile ACESTUI anunt
  const model = AnuntViewModel.dinFormular(req.body);
  model.id = id;
  model.promovat = entitate.promovat; // ramane cum l-a setat adminul
  model.imagini = AnuntViewModel.dinEntitate(entitate, imaginiActuale).imagini;

  const lista = await proprietatiPentruFormular(req.idUtilizator, entitate.proprietate);
  const erori = model.valideaza();
  verificaProprietatea(model, lista, erori);
  const eroareLimita = await verificaLimita(req, model.stare, entitate.stare);
  if (eroareLimita) erori.stare = `${eroareLimita} Poți păstra anunțul ca Ciornă sau Inactiv.`;
  verificaImaginile(req, imaginiActuale.filter((f) => !deSters.includes(f.id)).length, erori);

  const imaginiNoi = imaginiIncarcate(req);
  if (Object.keys(erori).length > 0) {
    stergeFisiere(imaginiNoi.map((i) => i.cale));
    return afiseazaFormular(res, { a: model, erori, lista, status: 400 });
  }
  const { caiSterse } = await anunturi.updateEntity(id, model.catreEntitate(), imaginiNoi, deSters, req.idUtilizator);
  stergeFisiere(caiSterse); // imaginile sterse dispar si de pe disc
  mesajFlash(req, `Anunțul „${model.titlu}” a fost modificat.`);
  res.redirect(LISTA);
}

// POST /proprietar/anunturi/:id/activeaza - il publica (proprietatea activa + limita din plan)
async function activeaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return anuntNegasit(res);
  if (entitate.stare !== 'activ') {
    if (entitate.proprietate.stare === 'inactiv') {
      mesajFlash(req, `Anunțul nu poate fi activat: proprietatea „${entitate.proprietate.denumire}” este inactivă. Activeaz-o întâi.`, 'warning');
      return res.redirect(LISTA);
    }
    const eroareLimita = await verificaLimita(req, 'activ', entitate.stare);
    if (eroareLimita) {
      mesajFlash(req, eroareLimita, 'warning');
      return res.redirect(LISTA);
    }
    await anunturi.schimbaStare(id, 'activ');
    mesajFlash(req, `Anunțul „${entitate.titlu}” a fost activat.`);
  }
  res.redirect(LISTA);
}

// POST /proprietar/anunturi/:id/dezactiveaza - il scoate de pe site
async function dezactiveaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return anuntNegasit(res);
  if (entitate.stare !== 'inactiv') {
    await anunturi.schimbaStare(id, 'inactiv');
    mesajFlash(req, `Anunțul „${entitate.titlu}” a fost dezactivat.`);
  }
  res.redirect(LISTA);
}

module.exports = { index, createGet, createPost, editGet, editPost, activeaza, dezactiveaza };
