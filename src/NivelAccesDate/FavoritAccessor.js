// Metode de acces la date pentru favorite (tabelul "favorit"): anunturile salvate de un utilizator.
// Toate cauta dupa utilizator + anunt impreuna: nimeni nu poate vedea sau sterge favoritele altcuiva (IDOR).
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.
// TEMPORAR: pana cand nimeni nu mai creeaza accesori cu "new" (pasul 4), constructorul are o valoare implicita.
const contextImplicit = require('../Repository_CodeFirst/context');
const { CU_PROPRIETATE_PUBLIC, NESTERS } = require('./AnuntAccessor');

// Aceleasi date despre proprietate ca la cautare + starea ei (ca sa stim daca anuntul salvat mai e disponibil).
const PROPRIETATE_FAVORIT = { select: { ...CU_PROPRIETATE_PUBLIC.proprietate.select, stare: true } };

class FavoritAccessor {
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context = contextImplicit } = {}) {
    this.context = context;
  }

  // Favoritele unui utilizator, cele mai noi primele, cu anuntul si proprietatea lui (fara telefon / email).
  // Anunturile sterse nu apar (randul din "favorit" ramane, dar chiriasul nu-l mai vede).
  async getAleUtilizatorului(utilizatorId) {
    return this.context.favorit.findMany({
      where: { utilizator_id: utilizatorId, anunt: NESTERS },
      include: { anunt: { include: { proprietate: PROPRIETATE_FAVORIT } } },
      orderBy: { creat_la: 'desc' },
    });
  }

  // Id-urile anunturilor favorite (ca pagina de cautare sa arate inima plina / goala).
  async getIdAnunturi(utilizatorId) {
    const randuri = await this.context.favorit.findMany({ where: { utilizator_id: utilizatorId, anunt: NESTERS }, select: { anunt_id: true } });
    return randuri.map((r) => r.anunt_id);
  }

  // Adauga la favorite. Daca era deja, nu e eroare (regula @@unique din baza ar refuza dublura; skipDuplicates o ignora).
  async adauga(utilizatorId, anuntId) {
    const r = await this.context.favorit.createMany({ data: [{ utilizator_id: utilizatorId, anunt_id: anuntId }], skipDuplicates: true });
    return r.count === 1; // true = adaugat acum, false = era deja
  }

  // Scoate de la favorite: doar din ale ACESTUI utilizator. Intoarce true daca a existat.
  async sterge(utilizatorId, anuntId) {
    const r = await this.context.favorit.deleteMany({ where: { utilizator_id: utilizatorId, anunt_id: anuntId } });
    return r.count === 1;
  }
}

module.exports = FavoritAccessor;
