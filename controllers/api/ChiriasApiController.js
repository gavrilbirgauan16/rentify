// API-ul chiriasului: contactarea proprietarului (dezvaluirea telefonului, cu limita din plan) si favoritele.
// Toate actiunile sunt ale chiriasului CONECTAT (id-ul vine din sesiune, niciodata din cerere).
const AnuntAccessor = require('../../src/NivelAccesDate/AnuntAccessor');
const ContactareAccessor = require('../../src/NivelAccesDate/ContactareAccessor');
const FavoritAccessor = require('../../src/NivelAccesDate/FavoritAccessor');
const { situatieContactari } = require('../../servicii/verificariPlan');
const { decide } = require('../../servicii/contactari');
const { catreListaDto } = require('../../models/api/AnuntDto');
const { citesteId } = require('../../utils/http');
const D = require('../../servicii/date');

const anunturi = new AnuntAccessor();
const contactari = new ContactareAccessor();
const favorite = new FavoritAccessor();

const negasit = (res) => res.status(404).json({ eroare: 'Anunțul nu există.' });
const idUtilizator = (res) => res.locals.utilizator.id;

// Situatia contactarilor din luna curenta, pentru interfata: { plan, folosite, maxim, ramase } (maxim/ramase null = nelimitat).
const catreSituatie = (s) => ({
  plan: s.plan, folosite: s.folosit, maxim: s.maxim, ramase: s.maxim === null ? null : Math.max(0, s.maxim - s.folosit),
});

// GET /api/contactari - cate contactari mai are luna asta (ca butonul "Suna" sa arate ce urmeaza)
async function situatie(req, res) {
  res.json(catreSituatie(await situatieContactari(idUtilizator(res))));
}

// POST /api/anunturi/:id/contact - dezvaluie telefonul proprietarului.
// Prima cerere a lunii pentru un anunt consuma o contactare din plan; acelasi anunt, din nou luna asta, nu mai consuma.
async function contact(req, res) {
  const anuntId = citesteId(req);
  const proprietar = anuntId && (await anunturi.getTelefonProprietar(anuntId)); // null daca anuntul nu e public
  if (!proprietar) return negasit(res);

  const chiriasId = idUtilizator(res);
  const [s, dejaContactat] = await Promise.all([
    situatieContactari(chiriasId),
    contactari.aContactat(chiriasId, anuntId, D.inceputLuna(D.azi())),
  ]);
  const decizie = decide({ dejaContactat, folosite: s.folosit, maxim: s.maxim });
  if (!decizie.permis) {
    const eroare = s.plan
      ? `Ai folosit toate cele ${s.maxim} contactări incluse luna aceasta în planul „${s.plan}”. Treci la un plan mai mare sau revino luna viitoare.`
      : 'Nu ai un abonament în curs, așa că nu poți contacta proprietari.';
    return res.status(403).json({ eroare, contactari: catreSituatie(s) });
  }
  if (decizie.consuma) await contactari.adauga(chiriasId, anuntId);
  res.json({
    telefon: proprietar.telefon,
    prenume: proprietar.prenume,
    contactari: { plan: s.plan, folosite: s.folosit + (decizie.consuma ? 1 : 0), maxim: s.maxim, ramase: decizie.ramase },
  });
}

// GET /api/favorite - anunturile salvate (si cele care intre timp nu mai sunt publice, marcate "disponibil: false")
async function listaFavorite(req, res) {
  const randuri = await favorite.getAleUtilizatorului(idUtilizator(res));
  const imagini = await anunturi.getImagini(randuri.map((f) => f.anunt_id));
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
  if (!anuntId || !(await anunturi.getPublicById(anuntId))) return negasit(res);
  const nou = await favorite.adauga(idUtilizator(res), anuntId);
  res.status(nou ? 201 : 200).json({ anunt_id: anuntId, favorit: true });
}

// DELETE /api/favorite/:id - il scoate din favorite (doar din ale LUI). 204 = sters, 404 = nu era favorit.
async function stergeFavorit(req, res) {
  const anuntId = citesteId(req);
  if (!anuntId || !(await favorite.sterge(idUtilizator(res), anuntId))) {
    return res.status(404).json({ eroare: 'Anunțul nu este în favoritele tale.' });
  }
  res.status(204).end();
}

module.exports = { situatie, contact, listaFavorite, adaugaFavorit, stergeFavorit };
