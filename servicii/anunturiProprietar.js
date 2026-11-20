// Regulile pentru "Anunturile mele" (zona proprietarului), scrise O SINGURA DATA si folosite
// de paginile EJS si de API (interfata React). La fiecare actiune:
//   1. Doar anunturile LUI (anuntul e al lui daca proprietatea anuntului e a lui) -> altfel { negasit: true }.
//   2. Doar proprietatile LUI, active (altfel ar putea publica un anunt pe casa altcuiva).
//   3. "Promovat" nu se alege de aici (functie platita): la anunt nou e false, la modificare ramane cum era.
//   4. Limita din plan numara anunturile active + cele in asteptare.
//   5. Moderarea (servicii/moderare.js): "Publica" trimite spre aprobare; o schimbare de continut sau de poze
//      a unui anunt aprobat ii sterge aprobarea.
const AnuntAccessor = require('../src/NivelAccesDate/AnuntAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const AnuntViewModel = require('../models/AnuntViewModel');

const { verificaProprietatea } = AnuntViewModel;
const { stergeFisiere, eroareImagini } = require('../middleware/incarcareImagini');
const { situatieAnunturi } = require('./verificariPlan');
const { textBlocare, CUVINTE_ANUNTURI } = require('./limite');
const moderare = require('./moderare');

const anunturi = new AnuntAccessor();
const proprietati = new ProprietateAccessor();

// Daca anuntul intra intr-o stare care ocupa un loc din plan, verificam limita; intoarce textul erorii sau null.
async function eroareLimita(proprietarId, stareNoua, stareVeche = null) {
  if (!moderare.verificaLimita(stareNoua, stareVeche)) return null;
  const s = await situatieAnunturi(proprietarId);
  return s.poateAdauga ? null : textBlocare(s, CUVINTE_ANUNTURI);
}

// Proprietatile din care poate alege: doar ale lui si active. La modificare apare si proprietatea actuala,
// chiar daca e inactiva (atunci anuntul poate fi doar Inactiv - verificat de verificaProprietatea).
async function proprietatiPentruFormular(proprietarId, proprietateActuala = null) {
  const lista = await proprietati.getDisponibileAleProprietarului(proprietarId);
  if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) lista.push(proprietateActuala);
  return lista;
}

// Lista proprietarului, cu pozele fiecarui anunt si limita din plan.
async function lista(proprietarId) {
  const [entitati, limita, active] = await Promise.all([
    anunturi.getAleProprietarului(proprietarId),
    situatieAnunturi(proprietarId),
    proprietati.getDisponibileAleProprietarului(proprietarId),
  ]);
  const imagini = await anunturi.getImagini(entitati.map((a) => a.id));
  return {
    anunturi: entitati.map((a) => ({ entitate: a, imagini: imagini.filter((img) => img.entitate_id === a.id) })),
    limita,
    textLimita: limita.poateAdauga ? null : textBlocare(limita, CUVINTE_ANUNTURI),
    areProprietatiActive: active.length > 0,
  };
}

// Un anunt al lui (cu imaginile lui) sau null.
async function getALui(proprietarId, id) {
  const entitate = id ? await anunturi.getByIdSiProprietar(id, proprietarId) : null;
  if (!entitate) return null;
  return { entitate, imagini: await anunturi.getImagini([id]) };
}

// Anunt nou. date = campurile formularului; imagini = { noi: [{ nume, cale }], eroare } (pozele deja salvate pe disc).
// Intoarce { faraProprietati } | { model, erori, lista } | { anunt, stare }.
// Daca anuntul nu se salveaza, pozele noi se sterg de pe disc.
async function adauga(proprietarId, date, imagini = {}) {
  const noi = imagini.noi || [];
  const renunta = (rezultat) => { stergeFisiere(noi.map((i) => i.cale)); return rezultat; };

  const lista = await proprietatiPentruFormular(proprietarId);
  if (lista.length === 0) return renunta({ faraProprietati: true });

  const model = AnuntViewModel.dinFormular(date);
  model.promovat = false;
  const erori = model.valideaza();
  verificaProprietatea(model, lista, erori); // proprietatea trebuie sa fie A LUI si activa
  const { stare } = moderare.stareLaSalvare({ ceruta: model.stare, aprobat: false, schimbat: true }); // un anunt nou nu e aprobat
  const limita = await eroareLimita(proprietarId, stare);
  if (limita) erori.stare = `${limita} Poți salva anunțul ca Ciornă.`;
  const eImg = eroareImagini({ eroareIncarcare: imagini.eroare, numarNoi: noi.length, alteErori: Object.keys(erori).length > 0 });
  if (eImg) erori.imagini = eImg;
  if (Object.keys(erori).length > 0) return renunta({ model, erori, lista });

  const anunt = await anunturi.addEntity({ ...model.catreEntitate(), stare, aprobat_la: null }, noi, proprietarId);
  return { anunt, stare };
}

// Modificarea unui anunt al lui. imagini = { noi, deSters: [id], eroare } (la API, pozele se schimba separat).
// Intoarce { negasit } | { model, erori, lista } | { anunt, stare, eraAprobat, pastreazaAprobarea }.
async function modifica(proprietarId, id, date, imagini = {}) {
  const noi = imagini.noi || [];
  const renunta = (rezultat) => { stergeFisiere(noi.map((i) => i.cale)); return rezultat; };

  const gasit = await getALui(proprietarId, id);
  if (!gasit) return renunta({ negasit: true });
  const { entitate, imagini: actuale } = gasit;
  const deSters = (imagini.deSters || []).filter((idImg) => actuale.some((f) => f.id === idImg)); // doar ale ACESTUI anunt

  const model = AnuntViewModel.dinFormular(date);
  model.id = id;
  model.promovat = entitate.promovat; // ramane cum l-a setat adminul
  model.imagini = AnuntViewModel.dinEntitate(entitate, actuale).imagini;
  model.motiv_respingere = entitate.motiv_respingere ?? '';

  const lista = await proprietatiPentruFormular(proprietarId, entitate.proprietate);
  const erori = model.valideaza();
  verificaProprietatea(model, lista, erori);

  // Moderarea: s-a schimbat continutul (sau pozele)? Atunci aprobarea se pierde.
  const deSalvat = model.catreEntitate();
  const schimbat = moderare.continutSchimbat(entitate, deSalvat, noi.length > 0 || deSters.length > 0);
  const eraAprobat = Boolean(entitate.aprobat_la);
  const { stare, pastreazaAprobarea } = moderare.stareLaSalvare({ ceruta: model.stare, aprobat: eraAprobat, schimbat });
  const limita = await eroareLimita(proprietarId, stare, entitate.stare);
  if (limita) erori.stare = `${limita} Poți păstra anunțul ca Ciornă sau Inactiv.`;
  const eImg = eroareImagini({
    eroareIncarcare: imagini.eroare, numarNoi: noi.length, numarRamase: actuale.length - deSters.length, alteErori: Object.keys(erori).length > 0,
  });
  if (eImg) erori.imagini = eImg;
  if (Object.keys(erori).length > 0) return renunta({ model, erori, lista });

  const { caiSterse } = await anunturi.updateEntity(
    id, { ...deSalvat, stare, aprobat_la: pastreazaAprobarea ? entitate.aprobat_la : null }, noi, deSters, proprietarId,
  );
  stergeFisiere(caiSterse); // imaginile sterse dispar si de pe disc
  return { anunt: (await getALui(proprietarId, id)).entitate, stare, eraAprobat, pastreazaAprobarea };
}

// Publicarea: direct activ daca aprobarea e inca valabila, altfel spre aprobare.
// Intoarce { negasit } | { proprietateInactiva } | { blocat } | { anunt, stare, schimbat }.
async function publica(proprietarId, id) {
  const gasit = await getALui(proprietarId, id);
  if (!gasit) return { negasit: true };
  const { entitate } = gasit;
  if (moderare.ocupaLoc(entitate.stare)) return { anunt: entitate, stare: entitate.stare, schimbat: false }; // deja publicat / in asteptare
  if (entitate.proprietate.stare === 'inactiv') return { proprietateInactiva: entitate.proprietate.denumire };
  const stare = moderare.stareLaActivare(Boolean(entitate.aprobat_la));
  const blocat = await eroareLimita(proprietarId, stare, entitate.stare);
  if (blocat) return { blocat };
  await anunturi.schimbaStare(id, stare); // aprobarea (aprobat_la) ramane cum era
  return { anunt: { ...entitate, stare }, stare, schimbat: true };
}

// Retragerea: il scoate de pe site (sau din asteptare). Aprobarea ramane: republicat fara modificari, apare direct.
// Intoarce { negasit } | { anunt, stareVeche, schimbat }.
async function retrage(proprietarId, id) {
  const gasit = await getALui(proprietarId, id);
  if (!gasit) return { negasit: true };
  const { entitate } = gasit;
  if (entitate.stare === 'inactiv') return { anunt: entitate, stareVeche: 'inactiv', schimbat: false };
  await anunturi.schimbaStare(id, 'inactiv');
  return { anunt: { ...entitate, stare: 'inactiv', motiv_respingere: null }, stareVeche: entitate.stare, schimbat: true };
}

// Schimbarea pozelor unui anunt al lui, fara restul datelor (API: adaugare / stergere separata).
// imagini = { noi: [{ nume, cale }], eroare, deSters: [id] }.
// Moderarea: o poza adaugata sau stearsa e o schimbare de continut -> aprobarea se pierde, iar un anunt activ
// ajunge din nou "in asteptare" (altfel s-ar putea pune o poza nepotrivita dupa aprobare).
// Intoarce { negasit } | { imagineNegasita } | { erori } | { anunt, imagini, stare }.
async function schimbaImagini(proprietarId, id, imagini = {}) {
  const noi = imagini.noi || [];
  const renunta = (rezultat) => { stergeFisiere(noi.map((i) => i.cale)); return rezultat; };

  const gasit = await getALui(proprietarId, id);
  if (!gasit) return renunta({ negasit: true });
  const { entitate, imagini: actuale } = gasit;
  const ceruteDeSters = imagini.deSters || [];
  const deSters = ceruteDeSters.filter((idImg) => actuale.some((f) => f.id === idImg)); // doar ale ACESTUI anunt
  if (deSters.length < ceruteDeSters.length) return renunta({ imagineNegasita: true });
  if (noi.length === 0 && deSters.length === 0 && !imagini.eroare) return renunta({ erori: { imagini: 'Alege cel puțin o imagine.' } });

  const eImg = eroareImagini({ eroareIncarcare: imagini.eroare, numarNoi: noi.length, numarRamase: actuale.length - deSters.length });
  if (eImg) return renunta({ erori: { imagini: eImg } });

  // Starea dupa schimbare: un anunt publicat si aprobat trece inapoi la aprobare; restul isi pastreaza starea.
  const stare = entitate.stare === 'activ' ? 'in_asteptare' : entitate.stare;
  const { caiSterse } = await anunturi.updateEntity(id, { stare, aprobat_la: null }, noi, deSters, proprietarId);
  stergeFisiere(caiSterse);
  const dupa = await getALui(proprietarId, id);
  return { anunt: dupa.entitate, imagini: dupa.imagini, stare };
}

module.exports = { proprietatiPentruFormular, lista, getALui, adauga, modifica, publica, retrage, schimbaImagini };
