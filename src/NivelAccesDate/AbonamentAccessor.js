// Metode de acces la date pentru abonamente si platile lor (tabelele abonament si plata_abonament).
const context = require('../Repository_CodeFirst/context');
const { catreDate } = require('../../servicii/date');

// Ce aducem mereu impreuna cu un abonament: cine il are (fara parola!), ce plan si platile.
const CU_DETALII = {
  utilizator: { select: { id: true, nume: true, prenume: true, email: true, rol: { select: { nume: true } } } },
  plan_abonament: { select: { id: true, nume: true, limita_plan: true } },
  plata_abonament: { orderBy: { data_platii: 'desc' } },
};

class AbonamentAccessor {
  // Lista, cu filtre optionale: rol ('proprietar'/'chirias') si cautare dupa nume / email.
  async getAll({ rol, cautare } = {}) {
    const where = {};
    if (rol) where.utilizator = { rol: { nume: rol } };
    if (cautare) {
      where.utilizator = {
        ...where.utilizator,
        OR: ['nume', 'prenume', 'email'].map((camp) => ({ [camp]: { contains: cautare, mode: 'insensitive' } })),
      };
    }
    return context.abonament.findMany({ where, include: CU_DETALII, orderBy: [{ data_inceput: 'desc' }, { id: 'desc' }] });
  }

  async getById(id) {
    return context.abonament.findUnique({ where: { id }, include: CU_DETALII });
  }

  // Abonamentele unui utilizator (pentru pagina lui de detalii).
  async getByUtilizator(utilizatorId) {
    return context.abonament.findMany({ where: { utilizator_id: utilizatorId }, include: CU_DETALII, orderBy: { data_inceput: 'desc' } });
  }

  // Abonamentele care ruleaza AZI (neanulate, azi intre inceput si sfarsit), pentru mai multi utilizatori odata.
  async getCurente(utilizatorIds, azi) {
    const ziua = catreDate(azi);
    return context.abonament.findMany({
      where: { utilizator_id: { in: utilizatorIds }, stare: 'activ', data_inceput: { lte: ziua }, data_sfarsit: { gte: ziua } },
      include: CU_DETALII,
    });
  }

  // Abonamentele neanulate care inca nu s-au terminat (pentru panou: neplatite / expira curand).
  async getNeterminate(azi) {
    return context.abonament.findMany({
      where: { stare: 'activ', data_sfarsit: { gte: catreDate(azi) } },
      include: CU_DETALII,
      orderBy: { data_sfarsit: 'asc' },
    });
  }

  // true daca utilizatorul are deja un abonament neanulat care se suprapune cu intervalul dat.
  async seSuprapune(utilizatorId, inceput, sfarsit) {
    const gasit = await context.abonament.findFirst({
      where: { utilizator_id: utilizatorId, stare: 'activ', data_inceput: { lte: catreDate(sfarsit) }, data_sfarsit: { gte: catreDate(inceput) } },
      select: { id: true },
    });
    return Boolean(gasit);
  }

  // Abonament nou; daca s-a platit pe loc, salvam si plata. Totul intr-o tranzactie (ori ambele, ori niciuna).
  async addEntity(date, plata = null) {
    return context.$transaction(async (tx) => {
      const abonament = await tx.abonament.create({ data: date });
      if (plata) await tx.plata_abonament.create({ data: { ...plata, abonament_id: abonament.id, data_platii: new Date() } });
      return abonament;
    });
  }

  async adaugaPlata(abonamentId, plata) {
    return context.plata_abonament.create({ data: { ...plata, abonament_id: abonamentId, data_platii: new Date() } });
  }

  // Anularea: abonamentul se opreste si nu se mai reinnoieste. Nu stergem nimic (istoricul ramane).
  async anuleaza(id) {
    return context.abonament.update({ where: { id }, data: { stare: 'anulat', reinnoire_automata: false } });
  }

  // Suma platilor reusite de la o data incoace (incasarile lunii).
  async incasariDin(dataInceput) {
    const r = await context.plata_abonament.aggregate({ _sum: { suma: true }, where: { stare: 'reusita', data_platii: { gte: catreDate(dataInceput) } } });
    return Number(r._sum.suma ?? 0);
  }
}

module.exports = AbonamentAccessor;