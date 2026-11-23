// Metode de acces la date pentru modelul "proprietate".
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.
const { NESTERS } = require('./AnuntAccessor');

class ProprietateAccessor {
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context }) {
    this.context = context;
  }

  // Toate proprietatile, cu numele proprietarului (pagina Index).
  async getAll() {
    return this.context.proprietate.findMany({
      include: { utilizator: { select: { nume: true, prenume: true } } },
      orderBy: { id: 'asc' },
    });
  }

  // O pagina din lista filtrata (admin). where si orderBy vin gata facute din controller, din filtrele alese.
  // Aducem si cate anunturi active are fiecare proprietate.
  async getPagina(where, orderBy, { skip, take }) {
    return this.context.proprietate.findMany({
      where,
      include: {
        utilizator: { select: { nume: true, prenume: true } },
        _count: { select: { anunt: { where: { stare: 'activ', ...NESTERS } } } },
      },
      orderBy,
      skip,
      take,
    });
  }

  // Cate proprietati se potrivesc filtrelor (pentru paginare).
  async numara(where) {
    return this.context.proprietate.count({ where });
  }

  // Orasele in care exista proprietati (pentru lista de filtrare).
  async getOrase() {
    const randuri = await this.context.proprietate.findMany({ distinct: ['oras'], select: { oras: true }, orderBy: { oras: 'asc' } });
    return randuri.map((r) => r.oras);
  }

  // O proprietate dupa id, cu proprietarul si anunturile ei (Details si Edit).
  async getById(id) {
    return this.context.proprietate.findUnique({
      where: { id },
      include: { utilizator: { select: { nume: true, prenume: true } }, anunt: true },
    });
  }

  // Proprietatile libere dintr-un oras (de la laboratorul 3).
  async getLibereInOras(oras) {
    return this.context.proprietate.findMany({
      where: { oras, stare: 'liber' },
      orderBy: { suprafata_mp: 'desc' },
    });
  }

  // Cate proprietati are un proprietar (pentru limita de abonament).
  async countByProprietar(proprietarId) {
    return this.context.proprietate.count({
      where: { proprietar_id: proprietarId, NOT: { stare: 'inactiv' } },
    });
  }

  // ===== Zona proprietarului: cautam MEREU dupa id si proprietar impreuna =====
  // Asa un proprietar nu poate ajunge la proprietatea altuia schimband numarul din adresa (IDOR).

  // Proprietatile unui proprietar, cu numarul de anunturi active (pagina "Proprietatile mele").
  async getAleProprietarului(proprietarId) {
    return this.context.proprietate.findMany({
      where: { proprietar_id: proprietarId },
      include: { _count: { select: { anunt: { where: { stare: 'activ', ...NESTERS } } } } },
      orderBy: [{ creat_la: 'desc' }, { id: 'desc' }],
    });
  }

  // O proprietate, doar daca apartine acestui proprietar; altfel null (pagina 404).
  async getByIdSiProprietar(id, proprietarId) {
    return this.context.proprietate.findFirst({ where: { id, proprietar_id: proprietarId } });
  }

  // Proprietatile active ale unui proprietar (lista din formularul lui de anunt).
  async getDisponibileAleProprietarului(proprietarId) {
    return this.context.proprietate.findMany({
      where: { proprietar_id: proprietarId, NOT: { stare: 'inactiv' } },
      orderBy: { denumire: 'asc' },
    });
  }

  // Adauga o proprietate noua (Create).
  async addEntity(date) {
    return this.context.proprietate.create({ data: date });
  }

  // Proprietatile care nu sunt inactive (pentru lista din formularul de anunt).
  async getDisponibile() {
    return this.context.proprietate.findMany({
      where: { NOT: { stare: 'inactiv' } },
      include: { utilizator: { select: { nume: true, prenume: true } } },
      orderBy: { denumire: 'asc' },
    });
  }

  // Modifica o proprietate existenta (Edit). Daca devine inactiva, i se dezactiveaza si anunturile.
  async updateEntity(id, date) {
    return this.#salveazaCuAnunturi(id, { ...date, actualizat_la: new Date() });
  }

  // Schimba doar starea (butoanele Dezactiveaza / Activeaza).
  // reactiveazaAnunturi: false -> la reactivare anunturile raman inactive (proprietarul le activeaza
  // unul cate unul, ca sa se verifice limita de anunturi active din planul lui).
  async schimbaStare(id, stare, { reactiveazaAnunturi = true } = {}) {
    return this.#salveazaCuAnunturi(id, { stare, actualizat_la: new Date() }, reactiveazaAnunturi);
  }

  // Tranzactie: proprietatea si anunturile ei se salveaza impreuna sau deloc.
  // Proprietatea devine inactiva -> anunturile ei devin inactive.
  // Proprietatea e reactivata   -> anunturile ei inactive redevin active (doar daca reactiveazaAnunturi).
  // Intoarce si cate anunturi s-au schimbat, ca sa-l anuntam pe utilizator.
  async #salveazaCuAnunturi(id, date, reactiveazaAnunturi = true) {
    return this.context.$transaction(async (tx) => {
      const inainte = await tx.proprietate.findUnique({ where: { id }, select: { stare: true } });
      const proprietate = await tx.proprietate.update({ where: { id }, data: date });
      let anunturiDezactivate = 0;
      let anunturiActivate = 0;

      if (proprietate.stare === 'inactiv' && inainte.stare !== 'inactiv') {
        // Motivul respingerii se sterge: ramane doar pe anunturile respinse (regula anunt_motiv_check).
        const rezultat = await tx.anunt.updateMany({
          where: { proprietate_id: id, NOT: { stare: 'inactiv' }, ...NESTERS },
          data: { stare: 'inactiv', motiv_respingere: null },
        });
        anunturiDezactivate = rezultat.count;
      }
      if (reactiveazaAnunturi && proprietate.stare !== 'inactiv' && inainte.stare === 'inactiv') {
        // Doar adminul reactiveaza anunturile odata cu proprietatea; fiind moderatorul, le si aproba
        // (cele aprobate deja isi pastreaza data aprobarii).
        const neaprobate = await tx.anunt.updateMany({
          where: { proprietate_id: id, stare: 'inactiv', aprobat_la: null, ...NESTERS }, // cele sterse raman sterse
          data: { stare: 'activ', aprobat_la: new Date() },
        });
        const aprobate = await tx.anunt.updateMany({
          where: { proprietate_id: id, stare: 'inactiv', ...NESTERS },
          data: { stare: 'activ' },
        });
        anunturiActivate = neaprobate.count + aprobate.count;
      }
      return { proprietate, anunturiDezactivate, anunturiActivate };
    });
  }
}

module.exports = ProprietateAccessor;