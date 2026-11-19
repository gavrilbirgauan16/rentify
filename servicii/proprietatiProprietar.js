// Regulile pentru "Proprietatile mele" (zona proprietarului), scrise O SINGURA DATA si folosite
// de paginile EJS si de API (interfata React). Trei reguli de securitate, la fiecare actiune:
//   1. Proprietarul vede si schimba DOAR proprietatile lui (cautare dupa id + proprietar -> altfel "negasita").
//   2. proprietar_id vine mereu din sesiune, niciodata din cerere (nu poate "darui" o proprietate altcuiva).
//   3. Limita din plan BLOCHEAZA adaugarea si reactivarea.
// Fiecare functie intoarce un rezultat; cine o apeleaza decide cum il arata (pagina sau JSON):
//   { negasita: true } | { blocat: 'textul limitei' } | { model, erori } | rezultatul reusit.
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const ProprietateViewModel = require('../models/ProprietateViewModel');
const { situatieProprietati } = require('./verificariPlan');
const { textBlocare, CUVINTE_PROPRIETATI } = require('./limite');

const proprietati = new ProprietateAccessor();

// Starile pe care le alege proprietarul. "Inactiv" se pune doar prin dezactivare,
// ca la reactivare sa putem verifica limita planului.
const STARI_FORMULAR = ['liber', 'ocupat'];

const textLimita = (s) => textBlocare(s, CUVINTE_PROPRIETATI);

// Datele trimise -> model validat, cu proprietarul pus din sesiune (nu din ce a trimis browserul).
// date = campurile formularului (are_balcon: "on" la formular; API-ul il transforma inainte).
function modelDin(date, proprietarId, stareActuala = null) {
  const model = ProprietateViewModel.dinFormular(date);
  model.proprietar_id = proprietarId;
  if (stareActuala === 'inactiv') model.stare = 'inactiv'; // ramane inactiva pana la activare
  const erori = model.valideaza();
  if (stareActuala !== 'inactiv' && !STARI_FORMULAR.includes(model.stare)) erori.stare = 'Alege Liber sau Ocupat.';
  return { model, erori };
}

// Lista proprietarului si cat ii mai permite planul.
async function lista(proprietarId) {
  const [randuri, limita] = await Promise.all([proprietati.getAleProprietarului(proprietarId), situatieProprietati(proprietarId)]);
  return { proprietati: randuri, limita, textLimita: textLimita(limita) };
}

// O proprietate a lui (pentru editare) sau null.
const getALui = (proprietarId, id) => (id ? proprietati.getByIdSiProprietar(id, proprietarId) : null);

// Mai poate adauga? Intoarce null sau textul limitei (pentru pagina de adaugare, inainte de formular).
async function verificaLimita(proprietarId) {
  const limita = await situatieProprietati(proprietarId);
  return limita.poateAdauga ? null : textLimita(limita);
}

// Proprietate noua. Limita se verifica din nou aici (formularul putea sta deschis mult).
async function adauga(proprietarId, date) {
  const blocat = await verificaLimita(proprietarId);
  if (blocat) return { blocat };
  const { model, erori } = modelDin(date, proprietarId);
  if (Object.keys(erori).length > 0) return { model, erori };
  return { proprietate: await proprietati.addEntity(model.catreEntitate()) };
}

// Modificarea unei proprietati a lui. O proprietate inactiva ramane inactiva (se activeaza separat).
async function modifica(proprietarId, id, date) {
  const entitate = await getALui(proprietarId, id);
  if (!entitate) return { negasita: true };
  const { model, erori } = modelDin(date, proprietarId, entitate.stare);
  model.id = id;
  if (Object.keys(erori).length > 0) return { model, erori };
  await proprietati.updateEntity(id, model.catreEntitate());
  return { model, proprietate: await getALui(proprietarId, id) };
}

// Dezactivarea: o scoate din uz, impreuna cu anunturile ei. schimbat = false daca era deja inactiva.
async function dezactiveaza(proprietarId, id) {
  const entitate = await getALui(proprietarId, id);
  if (!entitate) return { negasita: true };
  if (entitate.stare === 'inactiv') return { proprietate: entitate, schimbat: false, anunturiDezactivate: 0 };
  const r = await proprietati.schimbaStare(id, 'inactiv');
  return { proprietate: r.proprietate, schimbat: true, anunturiDezactivate: r.anunturiDezactivate };
}

// Activarea: doar daca planul mai permite. Anunturile ei raman inactive (le activeaza el, cu limita verificata).
async function activeaza(proprietarId, id) {
  const entitate = await getALui(proprietarId, id);
  if (!entitate) return { negasita: true };
  if (entitate.stare !== 'inactiv') return { proprietate: entitate, schimbat: false };
  const blocat = await verificaLimita(proprietarId);
  if (blocat) return { blocat };
  const r = await proprietati.schimbaStare(id, 'liber', { reactiveazaAnunturi: false });
  return { proprietate: r.proprietate, schimbat: true };
}

module.exports = { STARI_FORMULAR, lista, getALui, verificaLimita, adauga, modifica, dezactiveaza, activeaza };
