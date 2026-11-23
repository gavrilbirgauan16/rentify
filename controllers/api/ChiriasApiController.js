// API-ul chiriasului: contactarea proprietarului (dezvaluirea telefonului, cu limita din plan) si favoritele.
// Toate actiunile sunt ale chiriasului CONECTAT (id-ul vine din sesiune, niciodata din cerere).
// Logica e in servicii/chirias.js; aici doar transformam rezultatul in raspuns HTTP (JSON + cod de stare).
//
// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - containerul o apeleaza la fiecare cerere
// cu dependintele ei (aici serviciul "chirias") si primeste inapoi actiunile.
const { catreListaDto } = require('../../models/api/AnuntDto');
const { citesteId } = require('../../utils/http');

const negasit = (res) => res.status(404).json({ eroare: 'Anunțul nu există.' });
const idUtilizator = (res) => res.locals.utilizator.id;

// Situatia contactarilor din luna curenta, pentru interfata: { plan, folosite, maxim, ramase } (maxim/ramase null = nelimitat).
const catreSituatie = (s) => ({
  plan: s.plan, folosite: s.folosit, maxim: s.maxim, ramase: s.maxim === null ? null : Math.max(0, s.maxim - s.folosit),
});

module.exports = function ChiriasApiController({ chirias }) {
  // GET /api/contactari - cate contactari mai are luna asta (ca butonul "Suna" sa arate ce urmeaza)
  async function situatie(req, res) {
    res.json(catreSituatie(await chirias.situatieContactari(idUtilizator(res))));
  }

  // POST /api/anunturi/:id/contact - dezvaluie telefonul proprietarului.
  // Prima cerere a lunii pentru un anunt consuma o contactare din plan; acelasi anunt, din nou luna asta, nu mai consuma.
  async function contact(req, res) {
    const r = await chirias.contacteaza(idUtilizator(res), citesteId(req));
    if (r.negasit) return negasit(res);
    const s = r.situatie;
    if (r.refuzat) {
      const eroare = s.plan
        ? `Ai folosit toate cele ${s.maxim} contactări incluse luna aceasta în planul „${s.plan}”. Treci la un plan mai mare sau revino luna viitoare.`
        : 'Nu ai un abonament în curs, așa că nu poți contacta proprietari.';
      return res.status(403).json({ eroare, contactari: catreSituatie(s) });
    }
    res.json({
      telefon: r.proprietar.telefon,
      prenume: r.proprietar.prenume,
      contactari: { plan: s.plan, folosite: s.folosit + (r.consumat ? 1 : 0), maxim: s.maxim, ramase: r.ramase },
    });
  }

  // GET /api/favorite - anunturile salvate (si cele care intre timp nu mai sunt publice, marcate "disponibil: false")
  async function listaFavorite(req, res) {
    const { randuri, imagini } = await chirias.listaFavorite(idUtilizator(res));
    const dto = catreListaDto(randuri.map((f) => f.anunt), imagini);
    res.json(dto.map((a, i) => ({
      ...a,
      adaugat_la: randuri[i].creat_la.toISOString(),
      disponibil: randuri[i].anunt.stare === 'activ' && randuri[i].anunt.proprietate.stare !== 'inactiv',
    })));
  }

  // POST /api/favorite/:id - adauga anuntul la favorite (doar un anunt public). 201 = adaugat acum, 200 = era deja.
  async function adaugaFavorit(req, res) {
    const anuntId = citesteId(req);
    const r = await chirias.adaugaFavorit(idUtilizator(res), anuntId);
    if (r.negasit) return negasit(res);
    res.status(r.nou ? 201 : 200).json({ anunt_id: anuntId, favorit: true });
  }

  // DELETE /api/favorite/:id - il scoate din favorite (doar din ale LUI). 204 = sters, 404 = nu era favorit.
  async function stergeFavorit(req, res) {
    if (!(await chirias.stergeFavorit(idUtilizator(res), citesteId(req)))) {
      return res.status(404).json({ eroare: 'Anunțul nu este în favoritele tale.' });
    }
    res.status(204).end();
  }

  return { situatie, contact, listaFavorite, adaugaFavorit, stergeFavorit };
};
