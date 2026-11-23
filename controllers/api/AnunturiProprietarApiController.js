// API-ul "Anunturile mele" (proprietarul conectat). Aceleasi reguli ca paginile (servicii/anunturiProprietar.js):
// doar anunturile si proprietatile lui (altfel 404 / 400), "promovat" ignorat, limita din plan, moderarea.
// Pozele se adauga / sterg prin adrese separate (vezi mai jos, pasul cu imaginile).
const { catreDto, dinBody } = require('../../models/api/AnuntDto');
const { citesteId } = require('../../utils/http');
const { imaginiIncarcate } = require('../AnunturiController');

const corp = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
const negasit = (res) => res.status(404).json({ eroare: 'Anunțul nu există printre anunțurile tale.' });

// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - la fiecare cerere, containerul o apeleaza
// cu serviciul de care are nevoie (primit prin parametru, nu creat aici) si primeste inapoi actiunile.
module.exports = function AnunturiProprietarApiController({ anunturiProprietar: serviciu }) {
  // Ce vede proprietarul despre anuntul LUI: tot ce vede un vizitator + starea, motivul respingerii, aprobarea
  // si id-ul fiecarei poze (ca sa o poata sterge).
  function catreDtoProprietar(entitate, imagini = []) {
    return {
      ...catreDto(entitate, imagini),
      stare: entitate.stare,
      motiv_respingere: entitate.motiv_respingere ?? null,
      aprobat: Boolean(entitate.aprobat_la),
      imagini: imagini.map((f) => ({ id: f.id, url: f.cale })),
    };
  }

  const catreLimita = (l) => ({ plan: l.plan, folosite: l.folosit, maxim: l.maxim, poate_adauga: l.poateAdauga });

  // GET /api/proprietar/anunturi - anunturile lui + limita din plan (active + in asteptare)
  async function lista(req, res) {
    const r = await serviciu.lista(res.locals.utilizator.id);
    res.json({
      anunturi: r.anunturi.map(({ entitate, imagini }) => catreDtoProprietar(entitate, imagini)),
      limita: catreLimita(r.limita),
      mesaj_limita: r.textLimita,
      are_proprietati_active: r.areProprietatiActive,
    });
  }

  // GET /api/proprietar/anunturi/:id
  async function unul(req, res) {
    const gasit = await serviciu.getALui(res.locals.utilizator.id, citesteId(req));
    if (!gasit) return negasit(res);
    res.json(catreDtoProprietar(gasit.entitate, gasit.imagini));
  }

  // POST /api/proprietar/anunturi  { proprietate_id, tip, titlu, descriere, pret, ..., stare: "ciorna" | "activ" (publica) | "inactiv" }
  // "activ" il trimite spre aprobare (stare "in_asteptare"); raspunsul arata starea reala.
  async function adauga(req, res) {
    const r = await serviciu.adauga(res.locals.utilizator.id, dinBody(corp(req)));
    if (r.faraProprietati) return res.status(409).json({ eroare: 'Ca să publici un anunț, ai nevoie de o proprietate activă.' });
    if (r.erori) return res.status(400).json({ eroare: 'Date invalide.', erori: r.erori });
    const gasit = await serviciu.getALui(res.locals.utilizator.id, r.anunt.id);
    res.status(201).location(`/api/proprietar/anunturi/${r.anunt.id}`).json(catreDtoProprietar(gasit.entitate, gasit.imagini));
  }

  // PUT /api/proprietar/anunturi/:id - inlocuieste datele; o schimbare de continut a unui anunt aprobat cere reaprobare
  async function modifica(req, res) {
    const r = await serviciu.modifica(res.locals.utilizator.id, citesteId(req), dinBody(corp(req)));
    if (r.negasit) return negasit(res);
    if (r.erori) return res.status(400).json({ eroare: 'Date invalide.', erori: r.erori });
    const gasit = await serviciu.getALui(res.locals.utilizator.id, r.anunt.id);
    res.json(catreDtoProprietar(gasit.entitate, gasit.imagini));
  }

  // POST /api/proprietar/anunturi/:id/publica - direct activ daca aprobarea e valabila, altfel spre aprobare
  async function publica(req, res) {
    const r = await serviciu.publica(res.locals.utilizator.id, citesteId(req));
    if (r.negasit) return negasit(res);
    if (r.proprietateInactiva) return res.status(409).json({ eroare: `Proprietatea „${r.proprietateInactiva}” este inactivă. Activeaz-o întâi.` });
    if (r.blocat) return res.status(403).json({ eroare: r.blocat });
    res.json({ id: r.anunt.id, stare: r.stare });
  }

  // POST /api/proprietar/anunturi/:id/retrage - il scoate de pe site (sau din asteptare); aprobarea ramane
  async function retrage(req, res) {
    const r = await serviciu.retrage(res.locals.utilizator.id, citesteId(req));
    if (r.negasit) return negasit(res);
    res.json({ id: r.anunt.id, stare: 'inactiv' });
  }

  // DELETE /api/proprietar/anunturi/:id - stergere LOGICA: 204 (sters), apoi 404 la orice cerere pentru el
  // (inclusiv un al doilea DELETE: pentru client, anuntul nu mai exista).
  async function sterge(req, res) {
    const r = await serviciu.sterge(res.locals.utilizator.id, citesteId(req));
    if (r.negasit) return negasit(res);
    res.status(204).end();
  }

  // Raspunsul comun pentru schimbarea pozelor.
  function raspunsImagini(res, r, statusReusit) {
    if (r.negasit) return negasit(res);
    if (r.imagineNegasita) return res.status(404).json({ eroare: 'Imaginea nu aparține acestui anunț.' });
    if (r.erori) return res.status(400).json({ eroare: 'Imagini invalide.', erori: r.erori });
    return res.status(statusReusit).json(catreDtoProprietar(r.anunt, r.imagini));
  }

  // POST /api/proprietar/anunturi/:id/imagini  (multipart/form-data, campul "imagini", una sau mai multe)
  // Pozele sunt deja verificate dupa continut de incarcaImagini; daca anuntul nu e al lui, se sterg de pe disc.
  async function adaugaImagini(req, res) {
    const noi = imaginiIncarcate(req);
    const r = await serviciu.schimbaImagini(res.locals.utilizator.id, citesteId(req), { noi, eroare: req.eroareImagini || null });
    raspunsImagini(res, r, 201);
  }

  // DELETE /api/proprietar/anunturi/:id/imagini/:idImagine
  async function stergeImagine(req, res) {
    const idImagine = Number(req.params.idImagine);
    if (!Number.isInteger(idImagine) || idImagine <= 0) return res.status(404).json({ eroare: 'Imaginea nu aparține acestui anunț.' });
    const r = await serviciu.schimbaImagini(res.locals.utilizator.id, citesteId(req), { deSters: [idImagine] });
    raspunsImagini(res, r, 200);
  }

  return { lista, unul, adauga, modifica, publica, retrage, sterge, adaugaImagini, stergeImagine };
};
