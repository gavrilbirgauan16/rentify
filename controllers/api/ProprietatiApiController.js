// API-ul "Proprietatile mele" (proprietarul conectat). Aceleasi reguli ca paginile (servicii/proprietatiProprietar.js):
// doar proprietatile lui (altfel 404), proprietarul din sesiune, limita din plan (403 cu explicatia).
const serviciu = require('../../servicii/proprietatiProprietar');
const { citesteId } = require('../../utils/http');

const corp = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// JSON -> campurile formularului: in JSON balconul vine true / false, formularul trimite "on".
// proprietar_id NU se citeste niciodata din cerere (il pune serviciul, din sesiune).
const dinJson = (b) => ({ ...b, are_balcon: b.are_balcon === true ? 'on' : '', proprietar_id: undefined });

const negasita = (res) => res.status(404).json({ eroare: 'Proprietatea nu există printre proprietățile tale.' });

// Ce vede proprietarul despre o proprietate a lui.
const catreDto = (p) => ({
  id: p.id,
  denumire: p.denumire,
  tip: p.tip,
  judet: p.judet,
  oras: p.oras,
  zona: p.zona ?? null,
  nr_camere: p.nr_camere,
  suprafata_mp: p.suprafata_mp === null || p.suprafata_mp === undefined ? null : Number(p.suprafata_mp),
  max_locatari: p.max_locatari,
  are_balcon: p.are_balcon,
  stare: p.stare,
  ...(p._count ? { anunturi_active: p._count.anunt } : {}),
});

// Situatia limitei din plan, pentru interfata.
const catreLimita = (l) => ({ plan: l.plan, folosite: l.folosit, maxim: l.maxim, poate_adauga: l.poateAdauga });

// GET /api/proprietar/proprietati - lista lui + limita din plan
async function lista(req, res) {
  const r = await serviciu.lista(res.locals.utilizator.id);
  res.json({ proprietati: r.proprietati.map(catreDto), limita: catreLimita(r.limita), mesaj_limita: r.limita.poateAdauga ? null : r.textLimita });
}

// GET /api/proprietar/proprietati/:id
async function una(req, res) {
  const p = await serviciu.getALui(res.locals.utilizator.id, citesteId(req));
  if (!p) return negasita(res);
  res.json(catreDto(p));
}

// POST /api/proprietar/proprietati  { denumire, tip, judet, oras, zona, nr_camere, suprafata_mp, max_locatari, are_balcon, stare }
async function adauga(req, res) {
  const r = await serviciu.adauga(res.locals.utilizator.id, dinJson(corp(req)));
  if (r.blocat) return res.status(403).json({ eroare: r.blocat });
  if (r.erori) return res.status(400).json({ eroare: 'Date invalide.', erori: r.erori });
  res.status(201).location(`/api/proprietar/proprietati/${r.proprietate.id}`).json(catreDto(r.proprietate));
}

// PUT /api/proprietar/proprietati/:id - inlocuieste datele (o proprietate inactiva ramane inactiva)
async function modifica(req, res) {
  const r = await serviciu.modifica(res.locals.utilizator.id, citesteId(req), dinJson(corp(req)));
  if (r.negasita) return negasita(res);
  if (r.erori) return res.status(400).json({ eroare: 'Date invalide.', erori: r.erori });
  res.json(catreDto(r.proprietate));
}

// POST /api/proprietar/proprietati/:id/dezactiveaza - si anunturile ei devin inactive
async function dezactiveaza(req, res) {
  const r = await serviciu.dezactiveaza(res.locals.utilizator.id, citesteId(req));
  if (r.negasita) return negasita(res);
  res.json({ proprietate: catreDto(r.proprietate), anunturi_dezactivate: r.anunturiDezactivate });
}

// POST /api/proprietar/proprietati/:id/activeaza - doar daca planul mai permite; anunturile ei raman inactive
async function activeaza(req, res) {
  const r = await serviciu.activeaza(res.locals.utilizator.id, citesteId(req));
  if (r.negasita) return negasita(res);
  if (r.blocat) return res.status(403).json({ eroare: r.blocat });
  res.json({ proprietate: catreDto(r.proprietate) });
}

module.exports = { lista, una, adauga, modifica, dezactiveaza, activeaza };
