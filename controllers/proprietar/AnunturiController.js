// Controller-ul "Anunturile mele" (zona proprietarului): lista, adaugare si editare cu imagini, publicare / retragere.
// Regulile de securitate, la fiecare actiune:
//   1. Proprietarul vede si schimba DOAR anunturile lui (anuntul e al lui daca proprietatea anuntului e a lui).
//   2. Poate alege DOAR proprietatile lui, active (altfel ar putea publica un anunt pe casa altcuiva).
//   3. "Promovat" nu se poate bifa de aici (e o functie platita): se ignora orice trimite browserul.
//   4. Limita din plan numara anunturile active + cele in asteptare; se verifica la orice intrare intr-o astfel de stare.
//   5. Moderare: "Publica" trimite anuntul spre aprobarea adminului. Un anunt aprobat ramane aprobat doar
//      cat timp nu i se schimba continutul (vezi servicii/moderare.js).
const AnuntAccessor = require('../../src/NivelAccesDate/AnuntAccessor');
const ProprietateAccessor = require('../../src/NivelAccesDate/ProprietateAccessor');
const AnuntViewModel = require('../../models/AnuntViewModel');
const { verificaProprietatea, imaginiIncarcate, imaginiDeSters, verificaImaginile } = require('../AnunturiController');
const { stergeFisiere, MAX_IMAGINI, MAX_MB } = require('../../middleware/incarcareImagini');
const { situatieAnunturi } = require('../../servicii/verificariPlan');
const { textBlocare, CUVINTE_ANUNTURI } = require('../../servicii/limite');
const moderare = require('../../servicii/moderare');
const { citesteId, negasit, mesajFlash } = require('../../utils/http');

const anunturi = new AnuntAccessor();
const proprietati = new ProprietateAccessor();

const LISTA = '/proprietar/anunturi';

// La proprietar, "Activ" din formular inseamna "trimite spre publicare".
const ETICHETE_FORMULAR = { ...AnuntViewModel.ETICHETE_STARE, activ: 'Publică (se trimite spre aprobare)' };

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
    stari: AnuntViewModel.STARI_FORMULAR,
    monede: AnuntViewModel.MONEDE,
    eticheteTip: AnuntViewModel.ETICHETE_TIP,
    eticheteStare: ETICHETE_FORMULAR,
    maxImagini: MAX_IMAGINI,
    maxMb: MAX_MB,
    proprietati: lista,
  });
}

// Daca anuntul intra intr-o stare care ocupa un loc din plan, verificam limita; intoarce textul erorii sau null.
async function eroareLimita(req, stareNoua, stareVeche = null) {
  if (!moderare.verificaLimita(stareNoua, stareVeche)) return null;
  const s = await situatieAnunturi(req.idUtilizator);
  return s.poateAdauga ? null : textBlocare(s, CUVINTE_ANUNTURI);
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

// GET /proprietar/anunturi - anunturile mele, cu cate anunturi publicate mai permite planul
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
  // Un anunt nou nu e aprobat: "Publica" il trimite spre aprobare.
  const { stare } = moderare.stareLaSalvare({ ceruta: model.stare, aprobat: false, schimbat: true });
  const limita = await eroareLimita(req, stare);
  if (limita) erori.stare = `${limita} Poți salva anunțul ca Ciornă.`;
  verificaImaginile(req, 0, erori);

  const imagini = imaginiIncarcate(req);
  if (Object.keys(erori).length > 0) {
    stergeFisiere(imagini.map((i) => i.cale)); // anuntul nu se salveaza, deci nici imaginile
    return afiseazaFormular(res, { a: model, erori, lista, status: 400 });
  }
  const nou = await anunturi.addEntity({ ...model.catreEntitate(), stare, aprobat_la: null }, imagini, req.idUtilizator);
  mesajFlash(req, mesajSalvare(nou.titlu, stare, false, false));
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
  const model = AnuntViewModel.dinEntitate(entitate, imagini);
  // In formular se aleg doar Ciorna / Publica / Inactiv: un anunt in asteptare sau respins apare cu "Publica"
  // (respins: salvat cu "Publica" = retrimis spre aprobare dupa corectura).
  if (!AnuntViewModel.STARI_FORMULAR.includes(model.stare)) model.stare = 'activ';
  afiseazaFormular(res, { a: model, lista });
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
  const deSters = imaginiDeSters(req).filter((idImg) => imaginiActuale.some((f) => f.id === idImg)); // doar ale ACESTUI anunt
  const imaginiNoi = imaginiIncarcate(req);
  const model = AnuntViewModel.dinFormular(req.body);
  model.id = id;
  model.promovat = entitate.promovat; // ramane cum l-a setat adminul
  model.imagini = AnuntViewModel.dinEntitate(entitate, imaginiActuale).imagini;
  model.motiv_respingere = entitate.motiv_respingere ?? ''; // ca sa ramana vizibil daca formularul are erori

  const lista = await proprietatiPentruFormular(req.idUtilizator, entitate.proprietate);
  const erori = model.valideaza();
  verificaProprietatea(model, lista, erori);

  // Moderarea: s-a schimbat continutul? Atunci aprobarea se pierde si "Publica" il trimite din nou la aprobare.
  const date = model.catreEntitate();
  const schimbat = moderare.continutSchimbat(entitate, date, imaginiNoi.length > 0 || deSters.length > 0);
  const eraAprobat = Boolean(entitate.aprobat_la);
  const { stare, pastreazaAprobarea } = moderare.stareLaSalvare({ ceruta: model.stare, aprobat: eraAprobat, schimbat });
  const limita = await eroareLimita(req, stare, entitate.stare);
  if (limita) erori.stare = `${limita} Poți păstra anunțul ca Ciornă sau Inactiv.`;
  verificaImaginile(req, imaginiActuale.length - deSters.length, erori);

  if (Object.keys(erori).length > 0) {
    stergeFisiere(imaginiNoi.map((i) => i.cale));
    return afiseazaFormular(res, { a: model, erori, lista, status: 400 });
  }
  const deSalvat = { ...date, stare, aprobat_la: pastreazaAprobarea ? entitate.aprobat_la : null };
  const { caiSterse } = await anunturi.updateEntity(id, deSalvat, imaginiNoi, deSters, req.idUtilizator);
  stergeFisiere(caiSterse); // imaginile sterse dispar si de pe disc
  mesajFlash(req, mesajSalvare(model.titlu, stare, eraAprobat, pastreazaAprobarea));
  res.redirect(LISTA);
}

// POST /proprietar/anunturi/:id/activeaza - il publica: direct, daca aprobarea e inca valabila; altfel spre aprobare
async function activeaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return anuntNegasit(res);
  if (moderare.ocupaLoc(entitate.stare)) return res.redirect(LISTA); // deja publicat sau in asteptare

  if (entitate.proprietate.stare === 'inactiv') {
    mesajFlash(req, `Anunțul nu poate fi publicat: proprietatea „${entitate.proprietate.denumire}” este inactivă. Activeaz-o întâi.`, 'warning');
    return res.redirect(LISTA);
  }
  const stare = moderare.stareLaActivare(Boolean(entitate.aprobat_la));
  const limita = await eroareLimita(req, stare, entitate.stare);
  if (limita) {
    mesajFlash(req, limita, 'warning');
    return res.redirect(LISTA);
  }
  await anunturi.schimbaStare(id, stare); // aprobarea (aprobat_la) ramane cum era
  mesajFlash(req, stare === 'activ'
    ? `Anunțul „${entitate.titlu}” a fost publicat din nou.`
    : `Anunțul „${entitate.titlu}” a fost trimis spre aprobare.`);
  res.redirect(LISTA);
}

// POST /proprietar/anunturi/:id/dezactiveaza - il scoate de pe site (sau il retrage din asteptare)
async function dezactiveaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return anuntNegasit(res);
  if (entitate.stare !== 'inactiv') {
    await anunturi.schimbaStare(id, 'inactiv'); // aprobarea ramane: la reactivare, fara modificari, apare direct
    mesajFlash(req, entitate.stare === 'in_asteptare'
      ? `Anunțul „${entitate.titlu}” a fost retras de la aprobare.`
      : `Anunțul „${entitate.titlu}” a fost dezactivat.`);
  }
  res.redirect(LISTA);
}

module.exports = { index, createGet, createPost, editGet, editPost, activeaza, dezactiveaza };
