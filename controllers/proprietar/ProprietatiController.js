// Controller-ul "Proprietatile mele" (zona proprietarului): lista, adaugare, modificare, dezactivare / activare.
// Trei reguli de securitate, la fiecare actiune:
//   1. Proprietarul vede si schimba DOAR proprietatile lui (cautare dupa id + proprietar -> altfel 404).
//   2. proprietar_id vine mereu din sesiune, niciodata din formular (nu poate "darui" o proprietate altcuiva).
//   3. Limita din plan BLOCHEAZA adaugarea si reactivarea (adminul e doar avertizat, proprietarul e oprit).
const ProprietateAccessor = require('../../src/NivelAccesDate/ProprietateAccessor');
const ProprietateViewModel = require('../../models/ProprietateViewModel');
const { situatieProprietati } = require('../../servicii/verificariPlan');
const { textBlocare, CUVINTE_PROPRIETATI } = require('../../servicii/limite');
const { citesteId, negasit, mesajFlash } = require('../../utils/http');

const proprietati = new ProprietateAccessor();

const LISTA = '/proprietar/proprietati';

// Starile pe care le alege proprietarul din formular. "Inactiv" se pune doar din butonul Dezactiveaza,
// ca la reactivare sa putem verifica limita planului.
const STARI_FORMULAR = ['liber', 'ocupat'];

const proprietateNegasita = (res) => negasit(res, 'Proprietatea nu există', 'Proprietatea căutată nu a fost găsită printre proprietățile tale.');

// Textul afisat cand planul nu mai permite inca o proprietate (comun cu anunturile, din servicii/limite.js).
const textLimita = (s) => textBlocare(s, CUVINTE_PROPRIETATI);

// Textul despre anunturi pentru mesajul verde, de ex. " 2 anunțuri ale ei au fost dezactivate."
function textAnunturi({ anunturiDezactivate = 0, anunturiActivate = 0 }) {
  const fraza = (numar, verb) => (numar === 1 ? ` Un anunț al ei a fost ${verb}.` : ` ${numar} anunțuri ale ei au fost ${verb}e.`);
  if (anunturiDezactivate > 0) return fraza(anunturiDezactivate, 'dezactivat');
  if (anunturiActivate > 0) return fraza(anunturiActivate, 'activat');
  return '';
}

// Datele pentru formular (Create si Edit au aceeasi pagina, doar titlul si adresa difera).
// La o proprietate inactiva starea nu se poate schimba din formular (doar din butonul Activeaza).
function afiseazaFormular(res, { p, erori = {}, status = 200 }) {
  const editare = Boolean(p.id);
  res.status(status).render('proprietar/proprietati/formular', {
    p,
    erori,
    titlu: editare ? 'Editează proprietatea' : 'Adaugă proprietate',
    actiune: editare ? `${LISTA}/${p.id}/edit` : `${LISTA}/create`,
    tipuri: ProprietateViewModel.TIPURI,
    stari: p.stare === 'inactiv' ? ['inactiv'] : STARI_FORMULAR,
    eticheteTip: ProprietateViewModel.ETICHETE_TIP,
    eticheteStare: ProprietateViewModel.ETICHETE_STARE,
  });
}

// Formularul trimis -> model, cu proprietarul pus din sesiune (nu din ce a trimis browserul).
function modelDinFormular(req, stareActuala = null) {
  const model = ProprietateViewModel.dinFormular(req.body);
  model.proprietar_id = req.idUtilizator;
  if (stareActuala === 'inactiv') model.stare = 'inactiv'; // ramane inactiva pana la butonul Activeaza
  const erori = model.valideaza();
  if (stareActuala !== 'inactiv' && !STARI_FORMULAR.includes(model.stare)) erori.stare = 'Alege Liber sau Ocupat.';
  return { model, erori };
}

// GET /proprietar/proprietati - lista mea, cu cate proprietati mai permite planul
async function index(req, res) {
  const [randuri, limita] = await Promise.all([
    proprietati.getAleProprietarului(req.idUtilizator),
    situatieProprietati(req.idUtilizator),
  ]);
  res.render('proprietar/proprietati/index', {
    proprietati: randuri.map(ProprietateViewModel.dinEntitate),
    limita,
    textLimita: textLimita(limita),
  });
}

// GET /proprietar/proprietati/create - formularul gol (doar daca planul mai permite)
async function createGet(req, res) {
  const limita = await situatieProprietati(req.idUtilizator);
  if (!limita.poateAdauga) {
    mesajFlash(req, textLimita(limita), 'warning');
    return res.redirect(LISTA);
  }
  afiseazaFormular(res, { p: new ProprietateViewModel({ stare: 'liber' }) });
}

// POST /proprietar/proprietati/create - salvarea (limita se verifica din nou: formularul putea sta deschis mult)
async function createPost(req, res) {
  const limita = await situatieProprietati(req.idUtilizator);
  if (!limita.poateAdauga) {
    mesajFlash(req, textLimita(limita), 'warning');
    return res.redirect(LISTA);
  }
  const { model, erori } = modelDinFormular(req);
  if (Object.keys(erori).length > 0) return afiseazaFormular(res, { p: model, erori, status: 400 });

  const noua = await proprietati.addEntity(model.catreEntitate());
  mesajFlash(req, `Proprietatea „${noua.denumire}” a fost adăugată.`);
  res.redirect(LISTA); // Post/Redirect/Get: refresh-ul nu mai trimite formularul a doua oara
}

// GET /proprietar/proprietati/:id/edit - formularul completat (doar pentru proprietatile mele)
async function editGet(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return proprietateNegasita(res);
  afiseazaFormular(res, { p: ProprietateViewModel.dinEntitate(entitate) });
}

// POST /proprietar/proprietati/:id/edit - salvarea modificarilor
async function editPost(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return proprietateNegasita(res);

  const { model, erori } = modelDinFormular(req, entitate.stare);
  model.id = id;
  if (Object.keys(erori).length > 0) return afiseazaFormular(res, { p: model, erori, status: 400 });

  await proprietati.updateEntity(id, model.catreEntitate());
  mesajFlash(req, `Modificările la „${model.denumire}” au fost salvate.`);
  res.redirect(LISTA);
}

// POST /proprietar/proprietati/:id/dezactiveaza - o scoate din uz (si anunturile ei)
async function dezactiveaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return proprietateNegasita(res);
  if (entitate.stare !== 'inactiv') {
    const rezultat = await proprietati.schimbaStare(id, 'inactiv');
    mesajFlash(req, `Proprietatea „${entitate.denumire}” a fost dezactivată.` + textAnunturi(rezultat));
  }
  res.redirect(LISTA);
}

// POST /proprietar/proprietati/:id/activeaza - o pune din nou in uz, doar daca planul mai permite.
// Anunturile ei raman inactive: proprietarul le activeaza unul cate unul, cu limita de anunturi verificata.
async function activeaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await proprietati.getByIdSiProprietar(id, req.idUtilizator));
  if (!entitate) return proprietateNegasita(res);
  if (entitate.stare === 'inactiv') {
    const limita = await situatieProprietati(req.idUtilizator);
    if (!limita.poateAdauga) {
      mesajFlash(req, textLimita(limita), 'warning');
      return res.redirect(LISTA);
    }
    await proprietati.schimbaStare(id, 'liber', { reactiveazaAnunturi: false });
    mesajFlash(req, `Proprietatea „${entitate.denumire}” a fost activată. Anunțurile ei au rămas inactive: le poți activa din „Anunțurile mele”.`);
  }
  res.redirect(LISTA);
}

module.exports = { index, createGet, createPost, editGet, editPost, dezactiveaza, activeaza };
