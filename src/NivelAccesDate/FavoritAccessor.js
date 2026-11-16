// Metode de acces la date pentru favorite (tabelul "favorit"): anunturile salvate de un utilizator.
// Toate cauta dupa utilizator + anunt impreuna: nimeni nu poate vedea sau sterge favoritele altcuiva (IDOR).
const context = require('../Repository_CodeFirst/context');

class FavoritAccessor {
  // Favoritele unui utilizator, cele mai noi primele, cu anuntul si proprietatea lui (fara date personale).
  async getAleUtilizatorului(utilizatorId) {
    return context.favorit.findMany({
      where: { utilizator_id: utilizatorId },
      include: {
        anunt: {
          include: { proprietate: { select: { denumire: true, oras: true, zona: true, max_locatari: true, stare: true } } },
        },
      },
      orderBy: { creat_la: 'desc' },
    });
  }

  // Id-urile anunturilor favorite (ca pagina de cautare sa arate inima plina / goala).
  async getIdAnunturi(utilizatorId) {
    const randuri = await context.favorit.findMany({ where: { utilizator_id: utilizatorId }, select: { anunt_id: true } });
    return randuri.map((r) => r.anunt_id);
  }

  // Adauga la favorite. Daca era deja, nu e eroare (regula @@unique din baza ar refuza dublura; skipDuplicates o ignora).
  async adauga(utilizatorId, anuntId) {
    const r = await context.favorit.createMany({ data: [{ utilizator_id: utilizatorId, anunt_id: anuntId }], skipDuplicates: true });
    return r.count === 1; // true = adaugat acum, false = era deja
  }

  // Scoate de la favorite: doar din ale ACESTUI utilizator. Intoarce true daca a existat.
  async sterge(utilizatorId, anuntId) {
    const r = await context.favorit.deleteMany({ where: { utilizator_id: utilizatorId, anunt_id: anuntId } });
    return r.count === 1;
  }
}

module.exports = FavoritAccessor;
