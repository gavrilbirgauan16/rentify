// Metode de acces la date pentru modelul "anunt" (si imaginile lui din tabelul "fisier").
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.
// TEMPORAR: pana cand nimeni nu mai creeaza accesori cu "new" (pasul 4), constructorul are o valoare implicita.
const contextImplicit = require('../Repository_CodeFirst/context');
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

// Stergerea LOGICA (soft delete): un anunt sters are sters_la completat si NU apare nicaieri (Get si GetAll).
// Conditia e scrisa o singura data aici si pusa EXPLICIT in fiecare interogare de mai jos. In plus, baza de date
// refuza un anunt sters care sa fie activ sau in asteptare (regula anunt_sters_check), deci nu poate ajunge pe site.
const NESTERS = { sters_la: null };
const STERS = { sters_la: { not: null } };

// Conditia "anunt public": activ, nesters si pe o proprietate care nu e inactiva. Pusa MEREU la cautarea publica,
// chiar daca where-ul primit o contine deja (aparare in profunzime: nu depindem de cine construieste where-ul).
const PUBLIC = { stare: 'activ', ...NESTERS, proprietate: { NOT: { stare: 'inactiv' } } };

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
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context = contextImplicit } = {}) {
    this.context = context;
  }

  // Anunturile active, cu proprietatea fiecaruia (ce apare pe prima pagina).
  async getActive() {
    return this.context.anunt.findMany({
      where: { stare: 'activ', ...NESTERS },
      include: {
        proprietate: { select: { denumire: true, oras: true, zona: true } },
      },
      orderBy: [{ promovat: 'desc' }, { creat_la: 'desc' }],
    });
  }

  // Anunturile de inchiriere dintr-un interval de pret.
  async getInchirieriIntrePreturi(pretMinim, pretMaxim) {
    return this.context.anunt.findMany({
      where: {
        tip: 'inchiriere',
        stare: 'activ',
        ...NESTERS,
        pret: { gte: pretMinim, lte: pretMaxim },
      },
      orderBy: { pret: 'asc' },
    });
  }

  // Cautare dupa un cuvant in titlu sau descriere.
  async cauta(text) {
    return this.context.anunt.findMany({
      where: {
        stare: 'activ',
        ...NESTERS,
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
    return this.context.anunt.updateMany({
      where: { id, ...PUBLIC },
      data: { vizualizari: { increment: 1 } },
    });
  }

  // ===== Cautarea publica (chirias / vizitator): DOAR anunturile active, pe proprietati care nu sunt inactive =====

  // O pagina din rezultatele cautarii. where vine din servicii/cautareAnunturi.js (contine deja conditia PUBLIC).
  // AND, nu { ...where, ...PUBLIC }: spread-ul ar suprascrie where.proprietate (filtrele de oras, camere...).
  async cautaPublice(where, orderBy, { skip, take }) {
    return this.context.anunt.findMany({ where: { AND: [where, PUBLIC] }, include: CU_PROPRIETATE_PUBLIC, orderBy, skip, take });
  }

  async numaraPublice(where) {
    return this.context.anunt.count({ where: { AND: [where, PUBLIC] } });
  }

  // Un anunt public dupa id; null daca nu exista sau nu e public (ciorna, in asteptare, respins...).
  async getPublicById(id) {
    return this.context.anunt.findFirst({ where: { id, ...PUBLIC }, include: CU_PROPRIETATE_PUBLIC });
  }

  // Telefonul proprietarului unui anunt public (doar dupa contactare; nu apare niciodata in cautare).
  async getTelefonProprietar(id) {
    const a = await this.context.anunt.findFirst({
      where: { id, ...PUBLIC },
      select: { proprietate: { select: { utilizator: { select: { telefon: true, prenume: true } } } } },
    });
    return a ? a.proprietate.utilizator : null;
  }

  // Toate anunturile nesterse, cu proprietatea si proprietarul ei (API-ul cu cheie, laboratorul 7).
  async getAll() {
    return this.context.anunt.findMany({ where: NESTERS, include: CU_PROPRIETATE, orderBy: { creat_la: 'desc' } });
  }

  // O pagina din lista filtrata (admin). where si orderBy vin din filtrele alese in controller.
  // Implicit fara cele sterse; sterse = true -> DOAR cele sterse (filtrul "Sterse" al adminului).
  // AND, nu spread: where poate avea deja chei proprii (OR, proprietate...).
  async getPagina(where, orderBy, { skip, take }, { sterse = false } = {}) {
    return this.context.anunt.findMany({ where: { AND: [where, sterse ? STERS : NESTERS] }, include: CU_PROPRIETATE, orderBy, skip, take });
  }

  // Cate anunturi se potrivesc filtrelor (pentru paginare). Aceeasi regula pentru sterse ca la getPagina.
  async numara(where, { sterse = false } = {}) {
    return this.context.anunt.count({ where: { AND: [where, sterse ? STERS : NESTERS] } });
  }

  // ===== Zona proprietarului: un anunt e "al lui" daca proprietatea anuntului e a lui =====

  // Anunturile proprietarului, cele mai noi primele (pagina "Anunturile mele").
  async getAleProprietarului(proprietarId) {
    return this.context.anunt.findMany({
      where: { ...NESTERS, proprietate: { proprietar_id: proprietarId } },
      include: CU_PROPRIETATE,
      orderBy: [{ creat_la: 'desc' }, { id: 'desc' }],
    });
  }

  // Un anunt, doar daca e al acestui proprietar si nu e sters; altfel null (pagina 404, protectie IDOR).
  async getByIdSiProprietar(id, proprietarId) {
    return this.context.anunt.findFirst({ where: { id, ...NESTERS, proprietate: { proprietar_id: proprietarId } }, include: CU_PROPRIETATE });
  }

  // Cate anunturi publicate are un proprietar (pentru limita max_anunturi_active din plan):
  // cele active si cele trimise spre aprobare (altfel ar putea trimite oricate deodata).
  async numaraPublicateAleProprietarului(proprietarId) {
    return this.context.anunt.count({ where: { stare: { in: STARI_PUBLICATE }, ...NESTERS, proprietate: { proprietar_id: proprietarId } } });
  }

  // ===== Moderarea (adminul) =====

  // Aproba un anunt care asteapta aprobarea. Conditia "in_asteptare" e in WHERE, nu doar verificata inainte:
  // daca doi admini apasa deodata, sau proprietarul l-a retras intre timp, nu se aproba de doua ori / gresit.
  // Intoarce true daca s-a aprobat.
  async aproba(id) {
    const r = await this.context.anunt.updateMany({
      where: { id, stare: 'in_asteptare', ...NESTERS },
      data: { stare: 'activ', aprobat_la: new Date(), motiv_respingere: null },
    });
    return r.count === 1;
  }

  // Respinge un anunt in asteptare (sau scoate de pe site unul activ), cu motiv. Intoarce true daca s-a respins.
  async respinge(id, motiv) {
    const r = await this.context.anunt.updateMany({
      where: { id, stare: { in: STARI_PUBLICATE }, ...NESTERS },
      data: { stare: 'respins', motiv_respingere: motiv, aprobat_la: null },
    });
    return r.count === 1;
  }

  // Un anunt nesters dupa id, cu proprietatea lui (Edit si butoanele de stare); null daca nu exista sau e sters.
  // findFirst, nu findUnique: findUnique cauta doar dupa campuri unice (id), nu accepta si conditia NESTERS.
  async getById(id) {
    return this.context.anunt.findFirst({ where: { id, ...NESTERS }, include: CU_PROPRIETATE });
  }

  // ===== Stergerea logica =====

  // Sterge LOGIC un anunt: randul ramane (contactarile, favoritele si vizionarile arata spre el), dar anuntul dispare
  // din toate listele. Un anunt activ / in asteptare devine si inactiv (regula anunt_sters_check).
  // Conditia "nesters" e in WHERE: daca e apasat de doua ori deodata, se sterge o singura data. Intoarce true / false.
  async stergeLogic(id) {
    return this.context.$transaction(async (tx) => {
      const a = await tx.anunt.findFirst({ where: { id, ...NESTERS }, select: { stare: true } });
      if (!a) return false;
      const dePeSite = STARI_PUBLICATE.includes(a.stare);
      const r = await tx.anunt.updateMany({
        where: { id, ...NESTERS },
        data: { sters_la: new Date(), ...(dePeSite ? { stare: 'inactiv' } : {}) },
      });
      return r.count === 1;
    });
  }

  // Restaureaza un anunt sters (doar adminul): revine ca CIORNA, fara aprobare si fara motiv de respingere,
  // ca proprietarul sa-l verifice si sa-l trimita din nou spre aprobare (limita din plan se verifica atunci).
  // Intoarce anuntul restaurat sau null (nu exista ori nu e sters - ex. alt admin l-a restaurat deja).
  async restaureaza(id) {
    return this.context.$transaction(async (tx) => {
      const r = await tx.anunt.updateMany({
        where: { id, ...STERS },
        data: { sters_la: null, stare: 'ciorna', aprobat_la: null, motiv_respingere: null },
      });
      return r.count === 1 ? tx.anunt.findUnique({ where: { id }, include: CU_PROPRIETATE }) : null;
    });
  }

  // Imaginile mai multor anunturi, cu o singura interogare (fara problema N+1).
  async getImagini(idAnunturi) {
    return this.context.fisier.findMany({
      where: { ...IMAGINE_ANUNT, entitate_id: { in: idAnunturi } },
      orderBy: { id: 'asc' },
    });
  }

  // Adauga un anunt nou impreuna cu imaginile lui (Create).
  // Tranzactie: daca imaginile nu se pot salva, nu se salveaza nici anuntul.
  // incarcatDe = cine a incarcat imaginile (adminul sau proprietarul).
  async addEntity(date, imagini = [], incarcatDe) {
    return this.context.$transaction(async (tx) => {
      const anunt = await tx.anunt.create({ data: date });
      await this.#adaugaImagini(tx, anunt.id, imagini, incarcatDe);
      return anunt;
    });
  }

  // Modifica un anunt: datele, imaginile noi si imaginile bifate pentru stergere (Edit).
  // Intoarce caile imaginilor sterse, ca sa fie sterse si de pe disc.
  async updateEntity(id, date, imaginiNoi = [], idImaginiDeSters = [], incarcatDe) {
    return this.context.$transaction(async (tx) => {
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
    return this.context.anunt.update({
      where: { id },
      data: { stare, motiv_respingere: null, ...(aprobat_la !== undefined ? { aprobat_la } : {}) },
    });
  }

  // Cate anunturi asteapta aprobarea (Panou -> "De rezolvat").
  async numaraInAsteptare() {
    return this.context.anunt.count({ where: { stare: 'in_asteptare', ...NESTERS } });
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
// Selectia publica a proprietatii, folosita si de favorite (FavoritAccessor): chiriasul vede aceleasi date peste tot.
module.exports.CU_PROPRIETATE_PUBLIC = CU_PROPRIETATE_PUBLIC;
// Conditia "anunt nesters", pentru interogarile din alte tabele care aduc anunturi (favorite, panou, proprietati).
module.exports.NESTERS = NESTERS;