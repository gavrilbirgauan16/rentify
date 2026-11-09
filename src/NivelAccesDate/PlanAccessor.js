// Metode de acces la date pentru planurile de abonament (tabelele plan_abonament si limita_plan).
const context = require('../Repository_CodeFirst/context');

// Ce aducem mereu impreuna cu un plan: rolul, limitele si cate abonamente ACTIVE are.
const CU_DETALII = {
  rol: { select: { nume: true } },
  limita_plan: true,
  _count: { select: { abonament: { where: { stare: 'activ' } } } },
};

class PlanAccessor {
  // Planurile unui rol (proprietar / chirias), cele active primele, apoi dupa pret.
  async getByRol(numeRol) {
    return context.plan_abonament.findMany({
      where: { rol: { nume: numeRol } },
      include: CU_DETALII,
      orderBy: [{ activ: 'desc' }, { pret_lunar: 'asc' }],
    });
  }

  async getById(id) {
    return context.plan_abonament.findUnique({ where: { id }, include: CU_DETALII });
  }

  // true daca exista deja alt plan cu acelasi nume pentru acelasi rol.
  async numeFolosit(numeRol, nume, exceptId = null) {
    const gasit = await context.plan_abonament.findFirst({
      where: { rol: { nume: numeRol }, nume: { equals: nume, mode: 'insensitive' }, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    return Boolean(gasit);
  }

  // Plan nou, cu limitele lui (Create). Totul intr-o tranzactie.
  async addEntity(numeRol, date, limite) {
    return context.$transaction(async (tx) => {
      const plan = await tx.plan_abonament.create({ data: { ...date, rol: { connect: { nume: numeRol } } } });
      await tx.limita_plan.createMany({ data: limite.map((l) => ({ ...l, plan_id: plan.id })) });
      if (plan.recomandat) await this.#doarUnulRecomandat(tx, plan);
      return plan;
    });
  }

  // Modifica un plan: datele lui si inlocuieste limitele (Edit). Totul intr-o tranzactie.
  async updateEntity(id, date, limite) {
    return context.$transaction(async (tx) => {
      const plan = await tx.plan_abonament.update({ where: { id }, data: date });
      await tx.limita_plan.deleteMany({ where: { plan_id: id } });
      await tx.limita_plan.createMany({ data: limite.map((l) => ({ ...l, plan_id: id })) });
      if (plan.recomandat) await this.#doarUnulRecomandat(tx, plan);
      return plan;
    });
  }

  // Activeaza / dezactiveaza un plan. Un plan dezactivat nu mai poate fi recomandat.
  async schimbaActiv(id, activ) {
    return context.plan_abonament.update({ where: { id }, data: activ ? { activ } : { activ, recomandat: false } });
  }

  // Un singur plan recomandat pe rol: cand unul devine recomandat, celelalte nu mai sunt.
  async #doarUnulRecomandat(tx, plan) {
    await tx.plan_abonament.updateMany({
      where: { rol_id: plan.rol_id, recomandat: true, NOT: { id: plan.id } },
      data: { recomandat: false },
    });
  }
}

module.exports = PlanAccessor;