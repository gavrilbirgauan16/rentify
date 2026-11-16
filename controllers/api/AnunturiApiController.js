// Controller-ul API pentru anunturi (laboratorul 7). Raspunde cu JSON, nu cu pagini.
// Foloseste aceleasi parti ca site-ul: accesorul (nivelul de acces la date) si validarea din AnuntViewModel.
//   GET  /api/anunturi       - lista (Get)
//   GET  /api/anunturi/:id   - un anunt (Get(int id))
//   POST /api/anunturi       - adauga (Post), cere cheia API
//   PUT  /api/anunturi/:id   - modifica tot anuntul (Put), cere cheia API
const AnuntAccessor = require('../../src/NivelAccesDate/AnuntAccessor');
const ProprietateAccessor = require('../../src/NivelAccesDate/ProprietateAccessor');
const AnuntViewModel = require('../../models/AnuntViewModel');
const { catreDto, catreListaDto, dinBody } = require('../../models/api/AnuntDto');
const { verificaProprietatea } = require('../AnunturiController');
const { areCheie } = require('../../middleware/cheieApi');
const { citesteId } = require('../../utils/http');
const { citesteCautarea, conditie, SORTARI } = require('../../servicii/cautareAnunturi');
const F = require('../../servicii/filtre');

const anunturi = new AnuntAccessor();
const proprietati = new ProprietateAccessor();

const negasit = (res) => res.status(404).json({ eroare: 'Anunțul nu există.' });

// Body-ul trebuie sa fie un obiect JSON (nu o lista, nu text).
const bodyValid = (body) => body !== null && typeof body === 'object' && !Array.isArray(body);

// Valideaza JSON-ul primit exact ca formularul de pe site. Intoarce { model, erori }.
// La PUT, anuntul isi poate pastra starea actuala (ex. "in_asteptare"), chiar daca ea nu se alege din formular.
async function valideaza(body, proprietateActuala = null, stareActuala = null) {
  const model = AnuntViewModel.dinFormular(dinBody(body));
  const erori = model.valideaza(stareActuala);
  const lista = await proprietati.getDisponibile();
  if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) lista.push(proprietateActuala);
  verificaProprietatea(model, lista, erori);
  return { model, erori };
}

// GET /api/anunturi
//  - cu cheie API (admin / programe): toate anunturile, ca la laboratorul 7 (optional ?stare=activ|ciorna|...);
//  - fara cheie (chirias / vizitator): CAUTAREA PUBLICA - doar anunturile active, cu filtre si paginare:
//    ?q=&oras=&tip=&pret_min=&pret_max=&camere_min=&persoane=&sort=noi|pret_asc|pret_desc&pagina=&pe_pagina=
// Raspunsul ramane o LISTA (ca sa nu se strice clientii existenti); paginarea vine in antete:
//    X-Total-Count (cate rezultate in total), X-Pagina, X-Total-Pagini.
async function getAll(req, res) {
  if (areCheie(req)) {
    let entitati = await anunturi.getAll();
    if (req.query.stare) entitati = entitati.filter((a) => a.stare === req.query.stare);
    const imagini = await anunturi.getImagini(entitati.map((a) => a.id));
    return res.json(catreListaDto(entitati, imagini));
  }
  const f = citesteCautarea(req.query);
  const where = conditie(f);
  const pag = F.paginare(await anunturi.numaraPublice(where), f.pagina, f.pe_pagina);
  const entitati = await anunturi.cautaPublice(where, SORTARI[f.sort], pag);
  const imagini = await anunturi.getImagini(entitati.map((a) => a.id));
  res.set({ 'X-Total-Count': pag.total, 'X-Pagina': pag.pagina, 'X-Total-Pagini': pag.totalPagini });
  res.json(catreListaDto(entitati, imagini));
}

// GET /api/anunturi/:id
//  - cu cheie API: orice anunt (ca la laboratorul 7);
//  - fara cheie: doar un anunt public (altfel 404, ca si cum n-ar exista); fiecare deschidere numara o vizualizare.
async function getById(req, res) {
  const id = citesteId(req);
  if (!id) return negasit(res);
  if (areCheie(req)) {
    const entitate = await anunturi.getById(id);
    if (!entitate) return negasit(res);
    return res.json(catreDto(entitate, await anunturi.getImagini([id])));
  }
  const entitate = await anunturi.getPublicById(id);
  if (!entitate) return negasit(res);
  await anunturi.inregistreazaVizualizare(id);
  res.json(catreDto({ ...entitate, vizualizari: entitate.vizualizari + 1 }, await anunturi.getImagini([id])));
}

// POST /api/anunturi - raspunde 201 Created cu anuntul nou si adresa lui (antetul Location)
async function post(req, res) {
  if (!bodyValid(req.body)) return res.status(400).json({ eroare: 'Trimite un obiect JSON în Body.' });
  const { model, erori } = await valideaza(req.body);
  if (Object.keys(erori).length > 0) return res.status(400).json({ eroare: 'Date invalide.', erori });

  // Cine are cheia API e de incredere, ca adminul: un anunt pus "activ" prin API e considerat aprobat.
  const date = model.catreEntitate();
  const nou = await anunturi.addEntity({ ...date, aprobat_la: date.stare === 'activ' ? new Date() : null });
  const complet = await anunturi.getById(nou.id);
  res.status(201).location(`/api/anunturi/${nou.id}`).json(catreDto(complet));
}

// PUT /api/anunturi/:id - inlocuieste TOATE campurile (cele lipsa devin goale / implicite).
// Imaginile nu se schimba prin API (raman cele existente).
async function put(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return negasit(res);
  if (!bodyValid(req.body)) return res.status(400).json({ eroare: 'Trimite un obiect JSON în Body.' });

  const { model, erori } = await valideaza(req.body, entitate.proprietate, entitate.stare);
  if (Object.keys(erori).length > 0) return res.status(400).json({ eroare: 'Date invalide.', erori });

  // Ca la POST: trecut in "activ" prin API = aprobat (cel deja aprobat isi pastreaza data aprobarii).
  const date = model.catreEntitate();
  const aprobat_la = date.stare === 'activ' ? (entitate.aprobat_la ?? new Date()) : entitate.aprobat_la;
  await anunturi.updateEntity(id, { ...date, aprobat_la });
  const actualizat = await anunturi.getById(id);
  res.json(catreDto(actualizat, await anunturi.getImagini([id])));
}

module.exports = { getAll, getById, post, put };