// Metode de acces la date pentru modelul "proprietate".
const context = require('../Repository_CodeFirst/context');

class ProprietateAccessor {
  // Toate proprietatile, cu numele proprietarului (pagina Index).
  async getAll() {
    return context.proprietate.findMany({
      include: { utilizator: { select: { nume: true, prenume: true } } },
      orderBy: { id: 'asc' },
    });
  }

  // O proprietate dupa id, cu proprietarul si anunturile ei (Details si Edit).
  async getById(id) {
    return context.proprietate.findUnique({
      where: { id },
      include: { utilizator: { select: { nume: true, prenume: true } }, anunt: true },
    });
  }

  // Proprietatile libere dintr-un oras (de la laboratorul 3).
  async getLibereInOras(oras) {
    return context.proprietate.findMany({
      where: { oras, stare: 'liber' },
      orderBy: { suprafata_mp: 'desc' },
    });
  }

  // Cate proprietati are un proprietar (pentru limita de abonament).
  async countByProprietar(proprietarId) {
    return context.proprietate.count({
      where: { proprietar_id: proprietarId, NOT: { stare: 'inactiv' } },
    });
  }

  // Adauga o proprietate noua (Create).
  async addEntity(date) {
    return context.proprietate.create({ data: date });
  }

  // Proprietatile care nu sunt inactive (pentru lista din formularul de anunt).
  async getDisponibile() {
    return context.proprietate.findMany({
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
  async schimbaStare(id, stare) {
    return this.#salveazaCuAnunturi(id, { stare, actualizat_la: new Date() });
  }

  // Tranzactie: proprietatea si anunturile ei se salveaza impreuna sau deloc.
  // Proprietatea devine inactiva -> anunturile ei devin inactive.
  // Proprietatea e reactivata   -> anunturile ei inactive redevin active.
  // Intoarce si cate anunturi s-au schimbat, ca sa-l anuntam pe admin.
  async #salveazaCuAnunturi(id, date) {
    return context.$transaction(async (tx) => {
      const inainte = await tx.proprietate.findUnique({ where: { id }, select: { stare: true } });
      const proprietate = await tx.proprietate.update({ where: { id }, data: date });
      let anunturiDezactivate = 0;
      let anunturiActivate = 0;

      if (proprietate.stare === 'inactiv' && inainte.stare !== 'inactiv') {
        const rezultat = await tx.anunt.updateMany({
          where: { proprietate_id: id, NOT: { stare: 'inactiv' } },
          data: { stare: 'inactiv' },
        });
        anunturiDezactivate = rezultat.count;
      }
      if (proprietate.stare !== 'inactiv' && inainte.stare === 'inactiv') {
        const rezultat = await tx.anunt.updateMany({
          where: { proprietate_id: id, stare: 'inactiv' },
          data: { stare: 'activ' },
        });
        anunturiActivate = rezultat.count;
      }
      return { proprietate, anunturiDezactivate, anunturiActivate };
    });
  }
}

module.exports = ProprietateAccessor;