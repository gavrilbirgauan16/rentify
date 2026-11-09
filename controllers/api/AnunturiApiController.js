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

const anunturi = new AnuntAccessor();
const proprietati = new ProprietateAccessor();

const negasit = (res) => res.status(404).json({ eroare: 'Anunțul nu există.' });

// Fara cheie se vad doar anunturile active (ce vede orice vizitator). Cu cheie se vad toate.
const vizibil = (req, anunt) => anunt.stare === 'activ' || areCheie(req);

// Body-ul trebuie sa fie un obiect JSON (nu o lista, nu text).
const bodyValid = (body) => body !== null && typeof body === 'object' && !Array.isArray(body);

// Valideaza JSON-ul primit exact ca formularul de pe site. Intoarce { model, erori }.
async function valideaza(body, proprietateActuala = null) {
  const model = AnuntViewModel.dinFormular(dinBody(body));
  const erori = model.valideaza();
  const lista = await proprietati.getDisponibile();
  if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) lista.push(proprietateActuala);
  verificaProprietatea(model, lista, erori);
  return { model, erori };
}

// GET /api/anunturi  (optional ?stare=activ|ciorna|inactiv, doar cu cheie)
async function getAll(req, res) {
  let entitati = (await anunturi.getAll()).filter((a) => vizibil(req, a));
  if (req.query.stare && areCheie(req)) entitati = entitati.filter((a) => a.stare === req.query.stare);
  const imagini = await anunturi.getImagini(entitati.map((a) => a.id));
  res.json(catreListaDto(entitati, imagini));
}

// GET /api/anunturi/:id
async function getById(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate || !vizibil(req, entitate)) return negasit(res);
  res.json(catreDto(entitate, await anunturi.getImagini([id])));
}

// POST /api/anunturi - raspunde 201 Created cu anuntul nou si adresa lui (antetul Location)
async function post(req, res) {
  if (!bodyValid(req.body)) return res.status(400).json({ eroare: 'Trimite un obiect JSON în Body.' });
  const { model, erori } = await valideaza(req.body);
  if (Object.keys(erori).length > 0) return res.status(400).json({ eroare: 'Date invalide.', erori });

  const nou = await anunturi.addEntity(model.catreEntitate());
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

  const { model, erori } = await valideaza(req.body, entitate.proprietate);
  if (Object.keys(erori).length > 0) return res.status(400).json({ eroare: 'Date invalide.', erori });

  await anunturi.updateEntity(id, model.catreEntitate());
  const actualizat = await anunturi.getById(id);
  res.json(catreDto(actualizat, await anunturi.getImagini([id])));
}

module.exports = { getAll, getById, post, put };