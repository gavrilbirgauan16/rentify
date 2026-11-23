// Metode de acces la date pentru jurnalul de administrare (tabelul jurnal_admin).
// Inregistrarile din jurnal doar se adauga si se citesc: nu se modifica si nu se sterg.
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.

const CU_ADMIN = { utilizator: { select: { id: true, nume: true, prenume: true } } };

class JurnalAccessor {
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context }) {
    this.context = context;
  }

  // O actiune noua (ora o punem noi, in UTC, ca toate datele din aplicatie).
  async adauga(date) {
    return this.context.jurnal_admin.create({ data: { ...date, creat_la: new Date() } });
  }

  // O pagina din jurnalul filtrat (cele mai noi primele).
  async cauta(where, { skip, take }) {
    return this.context.jurnal_admin.findMany({ where, include: CU_ADMIN, orderBy: [{ creat_la: 'desc' }, { id: 'desc' }], skip, take });
  }

  async numara(where) {
    return this.context.jurnal_admin.count({ where });
  }

  // Ultimele actiuni (pentru panou).
  async ultimele(cate = 8) {
    return this.context.jurnal_admin.findMany({ include: CU_ADMIN, orderBy: [{ creat_la: 'desc' }, { id: 'desc' }], take: cate });
  }

  // Istoricul unei singure inregistrari (ex. tot ce s-a facut pe abonamentul 7).
  async getPentru(entitate, entitateId, cate = 20) {
    return this.context.jurnal_admin.findMany({
      where: { entitate, entitate_id: entitateId },
      include: CU_ADMIN,
      orderBy: [{ creat_la: 'desc' }, { id: 'desc' }],
      take: cate,
    });
  }

  // Adminii care apar in jurnal (pentru filtrul "Cine").
  async getAdmini() {
    return this.context.utilizator.findMany({
      where: { rol: { nume: 'admin' } },
      select: { id: true, nume: true, prenume: true },
      orderBy: { nume: 'asc' },
    });
  }
}

module.exports = JurnalAccessor;
