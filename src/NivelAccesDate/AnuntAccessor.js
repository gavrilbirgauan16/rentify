// Metode de acces la date pentru modelul "anunt" (si imaginile lui din tabelul "fisier").
const context = require('../Repository_CodeFirst/context');

// Imaginile sunt in tabelul general "fisier", recunoscute dupa entitate = 'anunt' si tip = 'imagine'.
const IMAGINE_ANUNT = { entitate: 'anunt', tip: 'imagine' };

// Proprietatea fiecarui anunt, cu proprietarul ei (doar campurile afisate).
const CU_PROPRIETATE = {
  proprietate: {
    select: {
      id: true,
      denumire: true,
      oras: true,
      stare: true,
      max_locatari: true,
      utilizator: { select: { nume: true, prenume: true, telefon: true } },
    },
  },
};

class AnuntAccessor {
  // Anunturile active, cu proprietatea fiecaruia (ce apare pe prima pagina).
  async getActive() {
    return context.anunt.findMany({
      where: { stare: 'activ' },
      include: {
        proprietate: { select: { denumire: true, oras: true, zona: true } },
      },
      orderBy: [{ promovat: 'desc' }, { creat_la: 'desc' }],
    });
  }

  // Anunturile de inchiriere dintr-un interval de pret.
  async getInchirieriIntrePreturi(pretMinim, pretMaxim) {
    return context.anunt.findMany({
      where: {
        tip: 'inchiriere',
        stare: 'activ',
        pret: { gte: pretMinim, lte: pretMaxim },
      },
      orderBy: { pret: 'asc' },
    });
  }

  // Cautare dupa un cuvant in titlu sau descriere.
  async cauta(text) {
    return context.anunt.findMany({
      where: {
        stare: 'activ',
        OR: [
          { titlu: { contains: text, mode: 'insensitive' } },
          { descriere: { contains: text, mode: 'insensitive' } },
        ],
      },
    });
  }

  // Creste numarul de vizualizari cand cineva deschide anuntul.
  async inregistreazaVizualizare(id) {
    return context.anunt.update({
      where: { id },
      data: { vizualizari: { increment: 1 } },
    });
  }

  // Toate anunturile, cu proprietatea si proprietarul ei (pagina Index din admin).
  async getAll() {
    return context.anunt.findMany({ include: CU_PROPRIETATE, orderBy: { creat_la: 'desc' } });
  }

  // Un anunt dupa id, cu proprietatea lui (Edit si butoanele de stare).
  async getById(id) {
    return context.anunt.findUnique({ where: { id }, include: CU_PROPRIETATE });
  }

  // Imaginile mai multor anunturi, cu o singura interogare (fara problema N+1).
  async getImagini(idAnunturi) {
    return context.fisier.findMany({
      where: { ...IMAGINE_ANUNT, entitate_id: { in: idAnunturi } },
      orderBy: { id: 'asc' },
    });
  }

  // Adauga un anunt nou impreuna cu imaginile lui (Create).
  // Tranzactie: daca imaginile nu se pot salva, nu se salveaza nici anuntul.
  async addEntity(date, imagini = [], adminId) {
    return context.$transaction(async (tx) => {
      const anunt = await tx.anunt.create({ data: date });
      await this.#adaugaImagini(tx, anunt.id, imagini, adminId);
      return anunt;
    });
  }

  // Modifica un anunt: datele, imaginile noi si imaginile bifate pentru stergere (Edit).
  // Intoarce caile imaginilor sterse, ca sa fie sterse si de pe disc.
  async updateEntity(id, date, imaginiNoi = [], idImaginiDeSters = [], adminId) {
    return context.$transaction(async (tx) => {
      const anunt = await tx.anunt.update({ where: { id }, data: date });
      const deSters = await tx.fisier.findMany({
        where: { ...IMAGINE_ANUNT, entitate_id: id, id: { in: idImaginiDeSters } }, // doar imaginile ACESTUI anunt
      });
      await tx.fisier.deleteMany({ where: { id: { in: deSters.map((f) => f.id) } } });
      await this.#adaugaImagini(tx, id, imaginiNoi, adminId);
      return { anunt, caiSterse: deSters.map((f) => f.cale) };
    });
  }

  // Schimba doar starea (butoanele Activeaza / Dezactiveaza).
  async schimbaStare(id, stare) {
    return context.anunt.update({ where: { id }, data: { stare } });
  }

  // Salveaza in tabelul fisier imaginile primite de la formular.
  async #adaugaImagini(tx, anuntId, imagini, adminId) {
    if (imagini.length === 0) return;
    await tx.fisier.createMany({
      data: imagini.map((img) => ({
        ...IMAGINE_ANUNT,
        entitate_id: anuntId,
        incarcat_de: adminId,
        nume_fisier: img.nume,
        cale: img.cale,
      })),
    });
  }
}

module.exports = AnuntAccessor;