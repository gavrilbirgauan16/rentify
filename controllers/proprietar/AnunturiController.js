// Controller-ul "Anunturile mele" (zona proprietarului): lista, adaugare si editare cu imagini, publicare / retragere.
// Regulile (doar anunturile si proprietatile lui, promovarea, limita, moderarea) sunt in servicii/anunturiProprietar.js,
// comune cu API-ul; aici doar paginile, formularul si mesajele.
const AnuntViewModel = require('../../models/AnuntViewModel');
const serviciu = require('../../servicii/anunturiProprietar');
const { imaginiIncarcate, imaginiDeSters } = require('../AnunturiController');
const { MAX_IMAGINI, MAX_MB } = require('../../middleware/incarcareImagini');
const { citesteId, negasit, mesajFlash } = require('../../utils/http');

const LISTA = '/proprietar/anunturi';

// La proprietar, "Activ" din formular inseamna "trimite spre publicare".
const ETICHETE_FORMULAR = { ...AnuntViewModel.ETICHETE_STARE, activ: 'Publică (se trimite spre aprobare)' };

const anuntNegasit = (res) => negasit(res, 'Anunțul nu există', 'Anunțul căutat nu a fost găsit printre anunțurile tale.');

// Pagina formularului (aceeasi pentru Create si Edit; titlul si adresa difera).
function afiseazaFormular(res, { a, erori = {}, lista, status = 200 }) {
  const editare = Boolean(a.id);
  res.status(status).render('proprietar/anunturi/formular', {
    a,
    erori,
    titlu: editare ? 'Editează anunțul' : 'Adaugă anunț',
    actiune: editare ? `${LISTA}/${a.id}/edit` : `${LISTA}/create`,
    tipuri: AnuntViewModel.TIPURI,
    stari: AnuntViewModel.STARI_FORMULAR,
    monede: AnuntViewModel.MONEDE,
    eticheteTip: AnuntViewModel.ETICHETE_TIP,
    eticheteStare: ETICHETE_FORMULAR,
    maxImagini: MAX_IMAGINI,
    maxMb: MAX_MB,
    proprietati: lista,
  });
}

// Fara nicio proprietate activa nu are ce anunta: il trimitem la proprietati, cu explicatia.
function faraProprietati(req, res) {
  mesajFlash(req, 'Ca să publici un anunț, ai nevoie de o proprietate activă. Adaug-o sau activeaz-o mai întâi.', 'warning');
  return res.redirect('/proprietar/proprietati');
}

// Mesajul verde dupa salvare, in functie de starea in care a ajuns anuntul.
function mesajSalvare(titlu, stare, eraAprobat, pastreazaAprobarea) {
  if (stare === 'in_asteptare') {
    return eraAprobat
      ? `Anunțul „${titlu}” a fost modificat și trimis din nou la aprobare (orice schimbare de conținut se verifică).`
      : `Anunțul „${titlu}” a fost trimis spre aprobare. Apare pe site după ce îl aprobă administratorul.`;
  }
  if (stare === 'activ' && pastreazaAprobarea) return `Anunțul „${titlu}” a fost salvat și rămâne publicat.`;
  return `Anunțul „${titlu}” a fost salvat.`;
}

// Pozele primite de formular (multipart), in forma ceruta de serviciu.
const imaginiDinCerere = (req, cuSterse = false) => ({
  noi: imaginiIncarcate(req), eroare: req.eroareImagini || null, deSters: cuSterse ? imaginiDeSters(req) : [],
});

// GET /proprietar/anunturi - anunturile mele, cu cate anunturi publicate mai permite planul
async function index(req, res) {
  const r = await serviciu.lista(req.idUtilizator);
  res.render('proprietar/anunturi/index', {
    anunturi: r.anunturi.map(({ entitate, imagini }) => AnuntViewModel.dinEntitate(entitate, imagini)),
    limita: r.limita,
    textLimita: r.textLimita,
    areProprietatiActive: r.areProprietatiActive,
  });
}

// GET /proprietar/anunturi/create - formularul gol (are nevoie de cel putin o proprietate activa)
async function createGet(req, res) {
  const lista = await serviciu.proprietatiPentruFormular(req.idUtilizator);
  if (lista.length === 0) return faraProprietati(req, res);
  afiseazaFormular(res, { a: new AnuntViewModel({ stare: 'ciorna', proprietate_id: lista.length === 1 ? lista[0].id : '' }), lista });
}

// POST /proprietar/anunturi/create - salvarea anuntului nou, cu imaginile lui
async function createPost(req, res) {
  const r = await serviciu.adauga(req.idUtilizator, req.body, imaginiDinCerere(req));
  if (r.faraProprietati) return faraProprietati(req, res);
  if (r.erori) return afiseazaFormular(res, { a: r.model, erori: r.erori, lista: r.lista, status: 400 });
  mesajFlash(req, mesajSalvare(r.anunt.titlu, r.stare, false, false));
  res.redirect(LISTA); // Post/Redirect/Get
}

// GET /proprietar/anunturi/:id/edit - formularul completat, cu imaginile actuale (doar anunturile mele)
async function editGet(req, res) {
  const gasit = await serviciu.getALui(req.idUtilizator, citesteId(req));
  if (!gasit) return anuntNegasit(res);
  const lista = await serviciu.proprietatiPentruFormular(req.idUtilizator, gasit.entitate.proprietate);
  const model = AnuntViewModel.dinEntitate(gasit.entitate, gasit.imagini);
  // In formular se aleg doar Ciorna / Publica / Inactiv: un anunt in asteptare sau respins apare cu "Publica"
  // (respins: salvat cu "Publica" = retrimis spre aprobare dupa corectura).
  if (!AnuntViewModel.STARI_FORMULAR.includes(model.stare)) model.stare = 'activ';
  afiseazaFormular(res, { a: model, lista });
}

// POST /proprietar/anunturi/:id/edit - salvarea modificarilor (date + imagini noi + imagini sterse)
async function editPost(req, res) {
  const r = await serviciu.modifica(req.idUtilizator, citesteId(req), req.body, imaginiDinCerere(req, true));
  if (r.negasit) return anuntNegasit(res);
  if (r.erori) return afiseazaFormular(res, { a: r.model, erori: r.erori, lista: r.lista, status: 400 });
  mesajFlash(req, mesajSalvare(r.anunt.titlu, r.stare, r.eraAprobat, r.pastreazaAprobarea));
  res.redirect(LISTA);
}

// POST /proprietar/anunturi/:id/activeaza - il publica: direct, daca aprobarea e inca valabila; altfel spre aprobare
async function activeaza(req, res) {
  const r = await serviciu.publica(req.idUtilizator, citesteId(req));
  if (r.negasit) return anuntNegasit(res);
  if (r.proprietateInactiva) {
    mesajFlash(req, `Anunțul nu poate fi publicat: proprietatea „${r.proprietateInactiva}” este inactivă. Activeaz-o întâi.`, 'warning');
  } else if (r.blocat) {
    mesajFlash(req, r.blocat, 'warning');
  } else if (r.schimbat) {
    mesajFlash(req, r.stare === 'activ'
      ? `Anunțul „${r.anunt.titlu}” a fost publicat din nou.`
      : `Anunțul „${r.anunt.titlu}” a fost trimis spre aprobare.`);
  }
  res.redirect(LISTA);
}

// POST /proprietar/anunturi/:id/dezactiveaza - il scoate de pe site (sau il retrage din asteptare)
async function dezactiveaza(req, res) {
  const r = await serviciu.retrage(req.idUtilizator, citesteId(req));
  if (r.negasit) return anuntNegasit(res);
  if (r.schimbat) {
    mesajFlash(req, r.stareVeche === 'in_asteptare'
      ? `Anunțul „${r.anunt.titlu}” a fost retras de la aprobare.`
      : `Anunțul „${r.anunt.titlu}” a fost dezactivat.`);
  }
  res.redirect(LISTA);
}

// POST /proprietar/anunturi/:id/sterge - stergere LOGICA (dupa confirmarea din fereastra): dispare din toate listele
async function sterge(req, res) {
  const r = await serviciu.sterge(req.idUtilizator, citesteId(req));
  if (r.negasit) return anuntNegasit(res);
  mesajFlash(req, `Anunțul „${r.anunt.titlu}” a fost șters.`);
  res.redirect(LISTA);
}

module.exports = { index, createGet, createPost, editGet, editPost, activeaza, dezactiveaza, sterge };
