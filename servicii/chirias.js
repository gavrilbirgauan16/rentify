// Regulile chiriasului: contactarea proprietarului (dezvaluirea telefonului, cu limita din plan) si favoritele.
// Mutate aici din ChiriasApiController (laboratorul 10: logica sta in nivelul de servicii, nu in controller).
// Chiriasul e MEREU cel conectat (id-ul vine din sesiune, niciodata din cerere).
// Dependintele (accesorii, verificarile de plan) vin prin constructor, de la containerul DI.
const { decide } = require('./contactari');
const D = require('./date');

class Chirias {
  constructor({ anuntAccessor, contactareAccessor, favoritAccessor, verificariPlan }) {
    this.anunturi = anuntAccessor;
    this.contactari = contactareAccessor;
    this.favorite = favoritAccessor;
    this.verificariPlan = verificariPlan;
  }

  // Cate contactari a folosit luna aceasta si cate are in plan: { plan, folosit, maxim, ... }.
  situatieContactari(chiriasId) {
    return this.verificariPlan.situatieContactari(chiriasId);
  }

  // Dezvaluie telefonul proprietarului unui anunt public.
  // Prima cerere a lunii pentru un anunt consuma o contactare; acelasi anunt din nou, luna asta, nu mai consuma.
  // Intoarce { negasit } | { refuzat, situatie } | { proprietar: { telefon, prenume }, situatie, consumat, ramase }.
  async contacteaza(chiriasId, anuntId) {
    const proprietar = anuntId && (await this.anunturi.getTelefonProprietar(anuntId)); // null daca anuntul nu e public
    if (!proprietar) return { negasit: true };

    const [situatie, dejaContactat] = await Promise.all([
      this.verificariPlan.situatieContactari(chiriasId),
      this.contactari.aContactat(chiriasId, anuntId, D.inceputLuna(D.azi())),
    ]);
    const decizie = decide({ dejaContactat, folosite: situatie.folosit, maxim: situatie.maxim });
    if (!decizie.permis) return { refuzat: true, situatie };
    if (decizie.consuma) await this.contactari.adauga(chiriasId, anuntId);
    return { proprietar, situatie, consumat: decizie.consuma, ramase: decizie.ramase };
  }

  // Favoritele chiriasului, cu imaginile anunturilor (o singura interogare pentru toate imaginile).
  async listaFavorite(chiriasId) {
    const randuri = await this.favorite.getAleUtilizatorului(chiriasId);
    const imagini = await this.anunturi.getImagini(randuri.map((f) => f.anunt_id));
    return { randuri, imagini };
  }

  // Adauga la favorite doar un anunt public. Intoarce { negasit } | { nou: true / false (era deja) }.
  async adaugaFavorit(chiriasId, anuntId) {
    if (!anuntId || !(await this.anunturi.getPublicById(anuntId))) return { negasit: true };
    return { nou: await this.favorite.adauga(chiriasId, anuntId) };
  }

  // Scoate din favorite (doar din ale LUI). true = sters, false = nu era favorit.
  stergeFavorit(chiriasId, anuntId) {
    return anuntId ? this.favorite.sterge(chiriasId, anuntId) : false;
  }
}

module.exports = Chirias;
