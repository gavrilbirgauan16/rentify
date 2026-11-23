// Metode de acces la date pentru contactari (tabelul "contactare"): chiriasul cere telefonul proprietarului.
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.
const { inceputZiRomania } = require('../../servicii/date');

class ContactareAccessor {
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context }) {
    this.context = context;
  }

  // Cate anunturi DIFERITE a contactat chiriasul de la o zi incoace (luna curenta) - pentru limita din plan.
  // deLa = 'AAAA-LL-ZZ'; ziua incepe la miezul noptii in ROMANIA (creat_la e ora exacta, salvata in UTC).
  async numaraAnunturiContactate(chiriasId, deLa) {
    const randuri = await this.context.contactare.findMany({
      where: { chirias_id: chiriasId, creat_la: { gte: inceputZiRomania(deLa) } },
      distinct: ['anunt_id'],
      select: { anunt_id: true },
    });
    return randuri.length;
  }

  // A mai contactat acest anunt de la data data (luna curenta)?
  async aContactat(chiriasId, anuntId, deLa) {
    const gasit = await this.context.contactare.findFirst({
      where: { chirias_id: chiriasId, anunt_id: anuntId, creat_la: { gte: inceputZiRomania(deLa) } },
      select: { id: true },
    });
    return Boolean(gasit);
  }

  async adauga(chiriasId, anuntId) {
    return this.context.contactare.create({ data: { chirias_id: chiriasId, anunt_id: anuntId } });
  }
}

module.exports = ContactareAccessor;
