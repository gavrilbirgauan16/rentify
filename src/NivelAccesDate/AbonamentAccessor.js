// Metode de acces la date pentru abonamente si platile lor (tabelele abonament si plata_abonament).
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.
const { catreDate } = require('../../servicii/date');

// Ce aducem mereu impreuna cu un abonament: cine il are (fara parola!), ce plan si platile.
const CU_DETALII = {
  utilizator: { select: { id: true, nume: true, prenume: true, email: true, rol: { select: { nume: true } } } },
  plan_abonament: { select: { id: true, nume: true, pret_lunar: true, limita_plan: true } }, // pret_lunar: la schimbarea planului
  plata_abonament: { orderBy: { data_platii: 'desc' } },
};

class AbonamentAccessor {
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context }) {
    this.context = context;
  }

  // Lista filtrata (admin). where si orderBy vin din controller, din filtrele alese.
  async getLista(where, orderBy) {
    return this.context.abonament.findMany({ where, include: CU_DETALII, orderBy });
  }

  async getById(id) {
    return this.context.abonament.findUnique({ where: { id }, include: CU_DETALII });
  }

  // Abonamentele unui utilizator (pentru pagina lui de detalii).
  async getByUtilizator(utilizatorId) {
    return this.context.abonament.findMany({ where: { utilizator_id: utilizatorId }, include: CU_DETALII, orderBy: { data_inceput: 'desc' } });
  }

  // Abonamentele care ruleaza AZI (neanulate, azi intre inceput si sfarsit), pentru mai multi utilizatori odata.
  async getCurente(utilizatorIds, azi) {
    const ziua = catreDate(azi);
    return this.context.abonament.findMany({
      where: { utilizator_id: { in: utilizatorIds }, stare: 'activ', data_inceput: { lte: ziua }, data_sfarsit: { gte: ziua } },
      include: CU_DETALII,
    });
  }

  // Abonamentele neanulate care inca nu s-au terminat (pentru panou: neplatite / expira curand).
  async getNeterminate(azi) {
    return this.context.abonament.findMany({
      where: { stare: 'activ', data_sfarsit: { gte: catreDate(azi) } },
      include: CU_DETALII,
      orderBy: { data_sfarsit: 'asc' },
    });
  }

  // true daca utilizatorul are deja un abonament neanulat care se suprapune cu intervalul dat.
  async seSuprapune(utilizatorId, inceput, sfarsit) {
    const gasit = await this.context.abonament.findFirst({
      where: { utilizator_id: utilizatorId, stare: 'activ', data_inceput: { lte: catreDate(sfarsit) }, data_sfarsit: { gte: catreDate(inceput) } },
      select: { id: true },
    });
    return Boolean(gasit);
  }

  // Abonament nou; daca s-a platit pe loc, salvam si plata. Totul intr-o tranzactie (ori ambele, ori niciuna).
  async addEntity(date, plata = null) {
    return this.context.$transaction(async (tx) => {
      const abonament = await tx.abonament.create({ data: date });
      if (plata) await tx.plata_abonament.create({ data: { ...plata, abonament_id: abonament.id, data_platii: new Date() } });
      return abonament;
    });
  }

  async adaugaPlata(abonamentId, plata) {
    return this.context.plata_abonament.create({ data: { ...plata, abonament_id: abonamentId, data_platii: new Date() } });
  }

  // Anularea: abonamentul se opreste si nu se mai reinnoieste. Nu stergem nimic (istoricul ramane).
  async anuleaza(id) {
    return this.context.abonament.update({ where: { id }, data: { stare: 'anulat', reinnoire_automata: false } });
  }

  // ===== Schimbarea planului de catre utilizator =====

  // Abonamentele programate (neanulate, care incep dupa azi): ex. un downgrade care incepe la final de perioada.
  async getProgramate(utilizatorId, azi) {
    return this.context.abonament.findMany({
      where: { utilizator_id: utilizatorId, stare: 'activ', data_inceput: { gt: catreDate(azi) } },
      include: CU_DETALII,
      orderBy: { data_inceput: 'asc' },
    });
  }

  // Executa schimbarea planului, totul intr-o tranzactie (ori tot, ori nimic):
  //  - verifica intai ca abonamentul curent e tot cel din calcul (sa nu se fi schimbat intre timp, ex. doua ferestre);
  //  - anuleaza schimbarile programate mai vechi (nu pot exista doua);
  //  - upgrade: abonamentul curent devine "inlocuit"; downgrade: cel curent nu se mai reinnoieste;
  //  - creeaza abonamentul nou si, daca e ceva de plata, plata (simulata).
  // Intoarce abonamentul nou sau null daca abonamentul curent s-a schimbat intre timp.
  async schimbaPlanul({ utilizatorId, curentId, tip, azi, abonamentNou, plata }) {
    return this.context.$transaction(async (tx) => {
      await this.#blocheazaUtilizatorul(tx, utilizatorId);
      const ziua = catreDate(azi);
      const curente = await tx.abonament.findMany({
        where: { utilizator_id: utilizatorId, stare: 'activ', data_inceput: { lte: ziua }, data_sfarsit: { gte: ziua } },
        select: { id: true },
      });
      if ((curente[0]?.id ?? null) !== curentId) return null;

      await this.#anuleazaProgramateTx(tx, utilizatorId, ziua);
      if (curentId && tip === 'upgrade') {
        await tx.abonament.update({ where: { id: curentId }, data: { stare: 'inlocuit', reinnoire_automata: false } });
      }
      if (curentId && tip === 'downgrade') {
        await tx.abonament.update({ where: { id: curentId }, data: { reinnoire_automata: false } });
      }
      const nou = await tx.abonament.create({ data: { ...abonamentNou, utilizator_id: utilizatorId } });
      if (plata) await tx.plata_abonament.create({ data: { ...plata, abonament_id: nou.id, data_platii: new Date() } });
      return nou;
    });
  }

  // Anuleaza schimbarile programate (inca neincepute) ale unui utilizator; cel curent se reinnoieste din nou.
  // Intoarce cate s-au anulat.
  async anuleazaProgramate(utilizatorId, azi) {
    return this.context.$transaction(async (tx) => {
      await this.#blocheazaUtilizatorul(tx, utilizatorId);
      const ziua = catreDate(azi);
      const anulate = await this.#anuleazaProgramateTx(tx, utilizatorId, ziua);
      if (anulate > 0) {
        await tx.abonament.updateMany({
          where: { utilizator_id: utilizatorId, stare: 'activ', data_inceput: { lte: ziua }, data_sfarsit: { gte: ziua } },
          data: { reinnoire_automata: true },
        });
      }
      return anulate;
    });
  }

  // Blocheaza randul utilizatorului pana la finalul tranzactiei (SELECT ... FOR UPDATE). Fara asta, doua cereri
  // trimise DEODATA (dublu-click, doua taburi) ar citi amandoua acelasi abonament curent si ar plati de doua ori.
  // Cu blocarea, a doua asteapta, apoi vede abonamentul nou si e refuzata (curentId nu mai e acelasi).
  // Blocam doar acel utilizator: ceilalti nu asteapta nimic. Valoarea e parametru (${}), nu text lipit -> fara SQL injection.
  async #blocheazaUtilizatorul(tx, utilizatorId) {
    await tx.$queryRaw`SELECT id FROM utilizator WHERE id = ${utilizatorId} FOR UPDATE`;
  }

  // In tranzactia data: anuleaza abonamentele programate si marcheaza platile lor ca rambursate
  // (un abonament care nu incepe niciodata nu trebuie platit). Intoarce cate s-au anulat.
  async #anuleazaProgramateTx(tx, utilizatorId, ziua) {
    const programate = await tx.abonament.findMany({
      where: { utilizator_id: utilizatorId, stare: 'activ', data_inceput: { gt: ziua } },
      select: { id: true },
    });
    const ids = programate.map((a) => a.id);
    if (ids.length === 0) return 0;
    await tx.abonament.updateMany({ where: { id: { in: ids } }, data: { stare: 'anulat', reinnoire_automata: false } });
    await tx.plata_abonament.updateMany({ where: { abonament_id: { in: ids }, stare: 'reusita' }, data: { stare: 'rambursata' } });
    return ids.length;
  }

  // Suma platilor reusite de la o data incoace (incasarile lunii).
  async incasariDin(dataInceput) {
    const r = await this.context.plata_abonament.aggregate({ _sum: { suma: true }, where: { stare: 'reusita', data_platii: { gte: catreDate(dataInceput) } } });
    return Number(r._sum.suma ?? 0);
  }
}

module.exports = AbonamentAccessor;
