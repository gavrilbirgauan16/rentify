// Verificari "are voie planul lui?" care au nevoie de baza de date.
// Adminul NU e blocat (el poate corecta orice), doar avertizat. Proprietarul e blocat cand atinge limita.
//
// Nivelul de servicii (laboratorul 10): accesorii de care are nevoie NU ii creeaza el, ii primeste prin
// constructor de la containerul de Dependency Injection (infrastructura/container.js).
const limite = require('./limite');
const { azi, inceputLuna } = require('./date');

class VerificariPlan {
  constructor({ abonamentAccessor, proprietateAccessor, anuntAccessor, contactareAccessor }) {
    this.abonamente = abonamentAccessor;
    this.proprietati = proprietateAccessor;
    this.anunturi = anuntAccessor;
    this.contactari = contactareAccessor;
  }

  // Cum sta un utilizator fata de o limita din plan (cheie), stiind cate a folosit (numara).
  // Intoarce { plan, folosit, maxim, depaseste, text, poateAdauga }; plan = null daca nu are abonament in curs.
  async situatie(utilizatorId, cheie, numara) {
    const [curente, folosit] = await Promise.all([this.abonamente.getCurente([utilizatorId], azi()), numara(utilizatorId)]);
    const abonament = curente[0] ?? null;
    const maxim = limite.limita(abonament, cheie);
    return {
      plan: abonament ? abonament.plan_abonament.nume : null,
      ...limite.situatie(folosit, maxim),
      poateAdauga: limite.maiPoate(folosit, maxim),
    };
  }

  // Proprietatile active (neinactive) ale unui proprietar fata de max_proprietati.
  situatieProprietati(proprietarId) {
    return this.situatie(proprietarId, 'max_proprietati', (id) => this.proprietati.countByProprietar(id));
  }

  // Anunturile publicate (active + in asteptare) ale unui proprietar fata de max_anunturi_active.
  situatieAnunturi(proprietarId) {
    return this.situatie(proprietarId, 'max_anunturi_active', (id) => this.anunturi.numaraPublicateAleProprietarului(id));
  }

  // Anunturile diferite contactate de un chirias luna aceasta fata de max_contactari_luna (planul Gratuit: 5).
  situatieContactari(chiriasId) {
    return this.situatie(chiriasId, 'max_contactari_luna', (id) => this.contactari.numaraAnunturiContactate(id, inceputLuna(azi())));
  }

  // Intoarce un text de avertizare daca proprietarul a depasit numarul de proprietati din plan, altfel null.
  async avertizareProprietati(proprietarId) {
    const s = await this.situatieProprietati(proprietarId);
    if (!s.plan) return 'Atenție: proprietarul nu are un abonament în curs.';
    return s.depaseste ? `Atenție: proprietarul are acum ${s.folosit} proprietăți active, dar planul „${s.plan}” permite ${s.maxim}.` : null;
  }
}

module.exports = VerificariPlan;
