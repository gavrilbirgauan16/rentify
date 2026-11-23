// Proprietatile in zona adminului: lista cu filtre, detalii, adaugare, modificare, activare / dezactivare.
// Mutat aici din ProprietatiController (laboratorul 10). Dependintele vin prin constructor, de la containerul DI.
// Spre deosebire de proprietar, adminul NU e blocat de limita planului (poate corecta orice), doar avertizat.
// Fiecare metoda intoarce un rezultat; controllerul decide cum il arata:
//   { negasita: true } | { model, erori } | rezultatul reusit.
const ProprietateViewModel = require('../models/ProprietateViewModel');
const AnuntViewModel = require('../models/AnuntViewModel');
const F = require('./filtre');

// Sortarile listei (cheile apar in adresa: ?sort=oras).
const SORTARI = {
  noi: [{ creat_la: 'desc' }, { id: 'desc' }],
  vechi: [{ creat_la: 'asc' }, { id: 'asc' }],
  denumire: [{ denumire: 'asc' }],
  oras: [{ oras: 'asc' }, { denumire: 'asc' }],
  camere: [{ nr_camere: 'desc' }, { denumire: 'asc' }],
};

// Filtrele alese -> conditia pentru baza de date (Prisma "where").
function conditie(f) {
  const where = {};
  if (f.q) where.OR = F.contineText(['denumire', 'oras', 'zona', 'adresa', 'utilizator.nume', 'utilizator.prenume'], f.q);
  if (f.oras) where.oras = { equals: f.oras, mode: 'insensitive' };
  if (f.tip) where.tip = f.tip;
  if (f.stare) where.stare = f.stare;
  if (f.camere_min) where.nr_camere = { gte: f.camere_min };
  if (f.balcon) where.are_balcon = f.balcon === 'da';
  if (f.proprietar) where.proprietar_id = f.proprietar;
  if (f.anunturi === 'fara') where.anunt = { none: { stare: 'activ' } };
  if (f.anunturi === 'cu') where.anunt = { some: { stare: 'activ' } };
  return where;
}

class ProprietatiAdmin {
  constructor({ proprietateAccessor, utilizatorAccessor, verificariPlan, jurnal }) {
    this.proprietati = proprietateAccessor;
    this.utilizatori = utilizatorAccessor;
    this.verificariPlan = verificariPlan;
    this.jurnal = jurnal;
  }

  // O pagina din lista filtrata + listele pentru filtre (orasele si proprietarii).
  async lista(f, pePagina) {
    const where = conditie(f);
    const pag = F.paginare(await this.proprietati.numara(where), f.pagina, pePagina);
    const [randuri, orase, proprietari] = await Promise.all([
      this.proprietati.getPagina(where, SORTARI[f.sort], pag),
      this.proprietati.getOrase(),
      this.proprietari(),
    ]);
    return { randuri: randuri.map(ProprietateViewModel.dinEntitate), pag, orase, proprietari };
  }

  // Proprietarii, pentru lista de selectie din formular si din filtre.
  proprietari() {
    return this.utilizatori.getByRol('proprietar');
  }

  // Pagina de detalii: proprietatea, anunturile ei si istoricul din jurnal. null daca nu exista.
  async detalii(id) {
    const entitate = await this.proprietati.getById(id);
    if (!entitate) return null;
    return {
      p: ProprietateViewModel.dinEntitate(entitate),
      anunturi: entitate.anunt.map((a) => AnuntViewModel.dinEntitate(a)),
      istoric: await this.jurnal.pentru('proprietate', id),
    };
  }

  // Modelul pentru formularul de modificare. null daca nu exista.
  async getModel(id) {
    const entitate = await this.proprietati.getById(id);
    return entitate ? ProprietateViewModel.dinEntitate(entitate) : null;
  }

  // date = campurile formularului; admin = cine face actiunea (pentru jurnal).
  async adauga(date, admin) {
    const model = ProprietateViewModel.dinFormular(date);
    const erori = model.valideaza();
    if (Object.keys(erori).length > 0) return { model, erori };
    const noua = await this.proprietati.addEntity(model.catreEntitate());
    await this.jurnal.noteaza(admin, 'creare', 'proprietate', noua.id, noua.denumire);
    return { noua, avertizare: await this.verificariPlan.avertizareProprietati(noua.proprietar_id) };
  }

  // Intoarce si cate anunturi s-au activat / dezactivat odata cu proprietatea.
  async modifica(id, date, admin) {
    if (!(await this.proprietati.getById(id))) return { negasita: true };
    const model = ProprietateViewModel.dinFormular(date);
    model.id = id;
    const erori = model.valideaza();
    if (Object.keys(erori).length > 0) return { model, erori };
    const rezultat = await this.proprietati.updateEntity(id, model.catreEntitate());
    await this.jurnal.noteaza(admin, 'modificare', 'proprietate', id, model.denumire);
    return { model, rezultat };
  }

  // stare = 'inactiv' (dezactivare, cu anunturile ei) sau 'liber' (activare, cu anunturile ei).
  async schimbaStare(id, stare, admin) {
    const entitate = await this.proprietati.getById(id);
    if (!entitate) return { negasita: true };
    const rezultat = await this.proprietati.schimbaStare(id, stare);
    await this.jurnal.noteaza(admin, stare === 'inactiv' ? 'dezactivare' : 'activare', 'proprietate', id, entitate.denumire);
    return { denumire: entitate.denumire, rezultat };
  }
}

module.exports = ProprietatiAdmin;
module.exports.SORTARI = SORTARI;
