// Metode de acces la date pentru modelul "anunt" (si imaginile lui din tabelul "fisier").
const context = require('../Repository_CodeFirst/context');
const { STARI_PUBLICATE } = require('../../servicii/moderare');

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
      proprietar_id: true,
      utilizator: { select: { nume: true, prenume: true, telefon: true, email: true } }, // email: anuntul aprobat / respins
    },
  },
};

// Conditia "anunt public": activ si pe o proprietate care nu e inactiva. Pusa MEREU la cautarea publica,
// chiar daca where-ul primit o contine deja (aparare in profunzime: nu depindem de cine construieste where-ul).
const PUBLIC = { stare: 'activ', proprietate: { NOT: { stare: 'inactiv' } } };

// Ce vede chiriasul despre proprietate: detaliile locuintei si numele proprietarului. FARA telefon si email.
const CU_PROPRIETATE_PUBLIC = {
  proprietate: {
    select: {
      id: true, denumire: true, oras: true, zona: true, tip: true, nr_camere: true, suprafata_mp: true,
      are_balcon: true, max_locatari: true, utilizator: { select: { prenume: true, nume: true } },
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

  // Creste numarul de vizualizari cand cineva deschide anuntul (doar la anunturile publice).
  // updateMany + conditia in WHERE: un id gresit sau un anunt care nu e public nu da eroare, doar nu numara.
  async inregistreazaVizualizare(id) {
    return context.anunt.updateMany({
      where: { id, ...PUBLIC },
      data: { vizualizari: { increment: 1 } },
    });
  }

  // ===== Cautarea publica (chirias / vizitator): DOAR anunturile active, pe proprietati care nu sunt inactive =====

  // O pagina din rezultatele cautarii. where vine din servicii/cautareAnunturi.js (contine deja conditia PUBLIC).
  // AND, nu { ...where, ...PUBLIC }: spread-ul ar suprascrie where.proprietate (filtrele de oras, camere...).
  async cautaPublice(where, orderBy, { skip, take }) {
    return context.anunt.findMany({ where: { AND: [where, PUBLIC] }, include: CU_PROPRIETATE_PUBLIC, orderBy, skip, take });
  }

  async numaraPublice(where) {
    return context.anunt.count({ where: { AND: [where, PUBLIC] } });
  }

  // Un anunt public dupa id; null daca nu exista sau nu e public (ciorna, in asteptare, respins...).
  async getPublicById(id) {
    return context.anunt.findFirst({ where: { id, ...PUBLIC }, include: CU_PROPRIETATE_PUBLIC });
  }

  // Telefonul proprietarului unui anunt public (doar dupa contactare; nu apare niciodata in cautare).
  async getTelefonProprietar(id) {
    const a = await context.anunt.findFirst({
      where: { id, ...PUBLIC },
      select: { proprietate: { select: { utilizator: { select: { telefon: true, prenume: true } } } } },
    });
    return a ? a.proprietate.utilizator : null;
  }

  // Toate anunturile, cu proprietatea si proprietarul ei (pagina Index din admin).
  async getAll() {
    return context.anunt.findMany({ include: CU_PROPRIETATE, orderBy: { creat_la: 'desc' } });
  }

  // O pagina din lista filtrata (admin). where si orderBy vin din filtrele alese in controller.
  async getPagina(where, orderBy, { skip, take }) {
    return context.anunt.findMany({ where, include: CU_PROPRIETATE, orderBy, skip, take });
  }

  // Cate anunturi se potrivesc filtrelor (pentru paginare).
  async numara(where) {
    return context.anunt.count({ where });
  }

  // ===== Zona proprietarului: un anunt e "al lui" daca proprietatea anuntului e a lui =====

  // Anunturile proprietarului, cele mai noi primele (pagina "Anunturile mele").
  async getAleProprietarului(proprietarId) {
    return context.anunt.findMany({
      where: { proprietate: { proprietar_id: proprietarId } },
      include: CU_PROPRIETATE,
      orderBy: [{ creat_la: 'desc' }, { id: 'desc' }],
    });
  }

  // Un anunt, doar daca e al acestui proprietar; altfel null (pagina 404, protectie IDOR).
  async getByIdSiProprietar(id, proprietarId) {
    return context.anunt.findFirst({ where: { id, proprietate: { proprietar_id: proprietarId } }, include: CU_PROPRIETATE });
  }

  // Cate anunturi publicate are un proprietar (pentru limita max_anunturi_active din plan):
  // cele active si cele trimise spre aprobare (altfel ar putea trimite oricate deodata).
  async numaraPublicateAleProprietarului(proprietarId) {
    return context.anunt.count({ where: { stare: { in: STARI_PUBLICATE }, proprietate: { proprietar_id: proprietarId } } });
  }

  // ===== Moderarea (adminul) =====

  // Aproba un anunt care asteapta aprobarea. Conditia "in_asteptare" e in WHERE, nu doar verificata inainte:
  // daca doi admini apasa deodata, sau proprietarul l-a retras intre timp, nu se aproba de doua ori / gresit.
  // Intoarce true daca s-a aprobat.
  async aproba(id) {
    const r = await context.anunt.updateMany({
      where: { id, stare: 'in_asteptare' },
      data: { stare: 'activ', aprobat_la: new Date(), motiv_respingere: null },
    });
    return r.count === 1;
  }

  // Respinge un anunt in asteptare (sau scoate de pe site unul activ), cu motiv. Intoarce true daca s-a respins.
  async respinge(id, motiv) {
    const r = await context.anunt.updateMany({
      where: { id, stare: { in: STARI_PUBLICATE } },
      data: { stare: 'respins', motiv_respingere: motiv, aprobat_la: null },
    });
    return r.count === 1;
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
  // incarcatDe = cine a incarcat imaginile (adminul sau proprietarul).
  async addEntity(date, imagini = [], incarcatDe) {
    return context.$transaction(async (tx) => {
      const anunt = await tx.anunt.create({ data: date });
      await this.#adaugaImagini(tx, anunt.id, imagini, incarcatDe);
      return anunt;
    });
  }

  // Modifica un anunt: datele, imaginile noi si imaginile bifate pentru stergere (Edit).
  // Intoarce caile imaginilor sterse, ca sa fie sterse si de pe disc.
  async updateEntity(id, date, imaginiNoi = [], idImaginiDeSters = [], incarcatDe) {
    return context.$transaction(async (tx) => {
      // Motivul respingerii ramane doar cat anuntul e respins (regula anunt_motiv_check din baza de date).
      const anunt = await tx.anunt.update({ where: { id }, data: { ...date, ...(date.stare && date.stare !== 'respins' ? { motiv_respingere: null } : {}) } });
      const deSters = await tx.fisier.findMany({
        where: { ...IMAGINE_ANUNT, entitate_id: id, id: { in: idImaginiDeSters } }, // doar imaginile ACESTUI anunt
      });
      await tx.fisier.deleteMany({ where: { id: { in: deSters.map((f) => f.id) } } });
      await this.#adaugaImagini(tx, id, imaginiNoi, incarcatDe);
      return { anunt, caiSterse: deSters.map((f) => f.cale) };
    });
  }

  // Schimba doar starea (butoanele Activeaza / Dezactiveaza).
  // aprobat_la (optional): ex. adminul activeaza = aproba; proprietarul nu atinge aprobarea.
  async schimbaStare(id, stare, { aprobat_la } = {}) {
    return context.anunt.update({
      where: { id },
      data: { stare, motiv_respingere: null, ...(aprobat_la !== undefined ? { aprobat_la } : {}) },
    });
  }

  // Cate anunturi asteapta aprobarea (Panou -> "De rezolvat").
  async numaraInAsteptare() {
    return context.anunt.count({ where: { stare: 'in_asteptare' } });
  }

  // Salveaza in tabelul fisier imaginile primite de la formular.
  async #adaugaImagini(tx, anuntId, imagini, incarcatDe) {
    if (imagini.length === 0) return;
    await tx.fisier.createMany({
      data: imagini.map((img) => ({
        ...IMAGINE_ANUNT,
        entitate_id: anuntId,
        incarcat_de: incarcatDe,
        nume_fisier: img.nume,
        cale: img.cale,
      })),
    });
  }
}

module.exports = AnuntAccessor;