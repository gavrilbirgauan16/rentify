// Controller-ul API pentru anunturi (laboratorul 7). Raspunde cu JSON, nu cu pagini.
// Logica e in serviciul anunturiPublice (primit prin injectie, laboratorul 10); aici doar cererea, codurile HTTP si DTO-urile.
//   GET  /api/anunturi       - lista (Get)
//   GET  /api/anunturi/:id   - un anunt (Get(int id))
//   POST /api/anunturi       - adauga (Post), cere cheia API
//   PUT  /api/anunturi/:id   - modifica tot anuntul (Put), cere cheia API
const { catreDto, catreListaDto, dinBody } = require('../../models/api/AnuntDto');
const { areCheie } = require('../../middleware/cheieApi');
const { citesteId } = require('../../utils/http');
const { citesteCautarea } = require('../../servicii/cautareAnunturi');

const negasit = (res) => res.status(404).json({ eroare: 'Anunțul nu există.' });
const bodyGresit = (res) => res.status(400).json({ eroare: 'Trimite un obiect JSON în Body.' });
const dateInvalide = (res, erori) => res.status(400).json({ eroare: 'Date invalide.', erori });

// Body-ul trebuie sa fie un obiect JSON (nu o lista, nu text).
const bodyValid = (body) => body !== null && typeof body === 'object' && !Array.isArray(body);

module.exports = function AnunturiApiController({ anunturiPublice: serviciu }) {
  // GET /api/anunturi
  //  - cu cheie API (admin / programe): toate anunturile, ca la laboratorul 7 (optional ?stare=activ|ciorna|...);
  //  - fara cheie (chirias / vizitator): CAUTAREA PUBLICA - doar anunturile active, cu filtre si paginare:
  //    ?q=&oras=&tip=&pret_min=&pret_max=&camere_min=&persoane=&sort=noi|pret_asc|pret_desc&pagina=&pe_pagina=
  // Raspunsul ramane o LISTA (ca sa nu se strice clientii existenti); paginarea vine in antete:
  //    X-Total-Count (cate rezultate in total), X-Pagina, X-Total-Pagini.
  async function getAll(req, res) {
    if (areCheie(req)) {
      const { entitati, imagini } = await serviciu.toate(req.query.stare);
      return res.json(catreListaDto(entitati, imagini));
    }
    const { entitati, imagini, pag } = await serviciu.cauta(citesteCautarea(req.query));
    res.set({ 'X-Total-Count': pag.total, 'X-Pagina': pag.pagina, 'X-Total-Pagini': pag.totalPagini });
    res.json(catreListaDto(entitati, imagini));
  }

  // GET /api/anunturi/:id
  //  - cu cheie API: orice anunt (ca la laboratorul 7);
  //  - fara cheie: doar un anunt public (altfel 404, ca si cum n-ar exista); fiecare deschidere numara o vizualizare.
  async function getById(req, res) {
    const id = citesteId(req);
    const gasit = id && (areCheie(req) ? await serviciu.unul(id) : await serviciu.unulPublic(id));
    if (!gasit) return negasit(res);
    res.json(catreDto(gasit.entitate, gasit.imagini));
  }

  // POST /api/anunturi - raspunde 201 Created cu anuntul nou si adresa lui (antetul Location)
  async function post(req, res) {
    if (!bodyValid(req.body)) return bodyGresit(res);
    const r = await serviciu.adauga(dinBody(req.body));
    if (r.erori) return dateInvalide(res, r.erori);
    res.status(201).location(`/api/anunturi/${r.anunt.id}`).json(catreDto(r.anunt));
  }

  // PUT /api/anunturi/:id - inlocuieste TOATE campurile (cele lipsa devin goale / implicite).
  // Imaginile nu se schimba prin API (raman cele existente).
  async function put(req, res) {
    const id = citesteId(req);
    if (!id) return negasit(res);
    // Intai 404 (anuntul nu exista), apoi 400 (Body gresit) - ca inainte.
    if (!bodyValid(req.body)) return (await serviciu.unul(id)) ? bodyGresit(res) : negasit(res);
    const r = await serviciu.inlocuieste(id, dinBody(req.body));
    if (r.negasit) return negasit(res);
    if (r.erori) return dateInvalide(res, r.erori);
    res.json(catreDto(r.anunt, r.imagini));
  }

  return { getAll, getById, post, put };
};
