// Planurile de abonament in zona adminului: lista pe roluri, adaugare, modificare, activare / dezactivare.
// Mutat aici din PlanuriController (laboratorul 10). Dependintele vin prin constructor, de la containerul DI.
// Fiecare metoda intoarce un rezultat; controllerul decide cum il arata:
//   { negasit: true } | { model, erori } | rezultatul reusit.
const PlanViewModel = require('../models/PlanViewModel');

const NUME_FOLOSIT = 'Există deja un plan cu acest nume pentru acest rol.';

class PlanuriAdmin {
  constructor({ planAccessor, jurnal }) {
    this.planuri = planAccessor;
    this.jurnal = jurnal;
  }

  async lista(rol) {
    return (await this.planuri.getByRol(rol)).map(PlanViewModel.dinEntitate);
  }

  // Modelul pentru formularul de modificare. null daca nu exista.
  async getModel(id) {
    const entitate = await this.planuri.getById(id);
    return entitate ? PlanViewModel.dinEntitate(entitate) : null;
  }

  // Validarea comuna: campurile + numele unic in cadrul rolului.
  async #valideaza(model, rol, exceptId = null) {
    const erori = model.valideaza();
    if (!erori.nume && (await this.planuri.numeFolosit(rol, model.nume, exceptId))) erori.nume = NUME_FOLOSIT;
    return erori;
  }

  // date = campurile formularului; admin = cine face actiunea (pentru jurnal).
  async adauga(rol, date, admin) {
    const model = PlanViewModel.dinFormular(date, rol);
    const erori = await this.#valideaza(model, rol);
    if (Object.keys(erori).length > 0) return { model, erori };
    const nou = await this.planuri.addEntity(rol, model.catreEntitate(), model.catreLimite());
    await this.jurnal.noteaza(admin, 'creare', 'plan', nou.id, nou.nume);
    return { nou };
  }

  // Rolul NU se schimba (un plan de chirias ramane de chirias): il luam din baza de date, nu din formular.
  async modifica(id, date, admin) {
    const entitate = await this.planuri.getById(id);
    if (!entitate) return { negasit: true };
    const rol = entitate.rol.nume;
    const model = PlanViewModel.dinFormular(date, rol);
    model.id = id;
    const erori = await this.#valideaza(model, rol, id);
    if (Object.keys(erori).length > 0) return { model, erori, rol };
    await this.planuri.updateEntity(id, model.catreEntitate(), model.catreLimite());
    await this.jurnal.noteaza(admin, 'modificare', 'plan', id, model.nume);
    return { model, rol };
  }

  // aveaAbonati: la dezactivare, abonatii actuali il pastreaza pana la expirare (doar il anuntam pe admin).
  async schimbaActiv(id, activ, admin) {
    const entitate = await this.planuri.getById(id);
    if (!entitate) return { negasit: true };
    await this.planuri.schimbaActiv(id, activ);
    await this.jurnal.noteaza(admin, activ ? 'activare' : 'dezactivare', 'plan', id, entitate.nume);
    return { nume: entitate.nume, rol: entitate.rol.nume, aveaAbonati: entitate._count.abonament > 0 };
  }
}

module.exports = PlanuriAdmin;
