// Abonamentele in zona adminului: lista cu filtre, detalii (cu istoricul platilor), abonament nou, plata, anulare.
// Un abonament nu se sterge si nu se editeaza: e un "contract" cu pret inghetat.
// Mutat aici din AbonamenteController (laboratorul 10). Dependintele vin prin constructor, de la containerul DI.
// Fiecare metoda intoarce un rezultat; controllerul decide cum il arata.
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { valideazaPlata } = require('../models/AbonamentViewModel');
const F = require('./filtre');
const D = require('./date');

const ROLURI_CU_ABONAMENT = ['proprietar', 'chirias'];
const SORTARI = {
  noi: [{ data_inceput: 'desc' }, { id: 'desc' }],
  sfarsit: [{ data_sfarsit: 'asc' }, { id: 'asc' }],
  pret: [{ pret: 'desc' }, { id: 'desc' }],
};

// Filtrele -> conditia pentru baza de date. Starea "platit / neplatit" depinde de plati,
// deci aceea se verifica dupa ce aducem abonamentele (vezi lista).
function conditie(f) {
  const astazi = D.catreDate(D.azi());
  const where = {};
  const u = {};
  if (f.rol) u.rol = { nume: f.rol };
  if (f.q) u.OR = F.contineText(['nume', 'prenume', 'email'], f.q);
  if (Object.keys(u).length) where.utilizator = u;
  if (f.plan) where.plan_id = f.plan;
  if (f.perioada) where.perioada = f.perioada;
  if (f.stare === 'anulat' || f.stare === 'inlocuit') where.stare = f.stare;
  if (f.stare === 'expirat') Object.assign(where, { stare: 'activ', data_sfarsit: { lt: astazi } });
  if (f.stare === 'programat') Object.assign(where, { stare: 'activ', data_inceput: { gt: astazi } });
  if (f.stare === 'platit' || f.stare === 'neplatit') Object.assign(where, { stare: 'activ', data_inceput: { lte: astazi }, data_sfarsit: { gte: astazi } });
  if (f.expira) {
    // in desfasurare si se termina in urmatoarele N zile
    Object.assign(where, { stare: 'activ', data_inceput: { lte: astazi } });
    where.data_sfarsit = { gte: astazi, lte: D.catreDate(D.adunaZile(D.azi(), Number(f.expira))) };
  }
  return where;
}

class AbonamenteAdmin {
  constructor({ abonamentAccessor, planAccessor, utilizatorAccessor, jurnal }) {
    this.abonamente = abonamentAccessor;
    this.planuri = planAccessor;
    this.utilizatori = utilizatorAccessor;
    this.jurnal = jurnal;
  }

  // O pagina din lista filtrata + planurile (pentru filtru).
  async lista(f, pePagina) {
    let lista = (await this.abonamente.getLista(conditie(f), SORTARI[f.sort])).map(AbonamentViewModel.dinEntitate);
    if (f.stare === 'platit' || f.stare === 'neplatit') lista = lista.filter((a) => a.stareCod() === f.stare);
    const pag = F.paginareLista(lista, f.pagina, pePagina);
    return { randuri: pag.randuri, pag, planuri: await this.planuri.getToate() };
  }

  // Pagina unui abonament: modelul si istoricul din jurnal. null daca nu exista.
  async detalii(id) {
    const entitate = await this.abonamente.getById(id);
    if (!entitate) return null;
    return { a: AbonamentViewModel.dinEntitate(entitate), istoric: await this.jurnal.pentru('abonament', id) };
  }

  // Listele pentru formularul de abonament nou: utilizatorii activi (proprietari + chiriasi) si planurile active, pe roluri.
  async dateFormular() {
    const [proprietari, chiriasi, active] = await Promise.all([
      this.utilizatori.cauta({ rol: 'proprietar', stare: 'activ' }),
      this.utilizatori.cauta({ rol: 'chirias', stare: 'activ' }),
      this.planuri.getActive(),
    ]);
    const planuriPeRol = { proprietar: [], chirias: [] };
    active.forEach((p) => planuriPeRol[p.rol.nume]?.push(p));
    return { proprietari, chiriasi, planuriPeRol };
  }

  // Abonament nou. date = campurile formularului. Intoarce { model, erori } | { nou, u, plan }.
  async adauga(date, admin) {
    const model = AbonamentViewModel.dinFormular(date);
    const erori = model.valideaza();

    // Regulile care tin de alte tabele: utilizatorul si planul trebuie sa existe, sa fie activi si "pentru acelasi rol".
    const [u, plan] = await Promise.all([
      !erori.utilizator_id ? this.utilizatori.getPentruSesiune(model.utilizator_id) : null,
      !erori.plan_id ? this.planuri.getById(model.plan_id) : null,
    ]);
    if (!erori.utilizator_id && (!u || u.stare !== 'activ' || !ROLURI_CU_ABONAMENT.includes(u.rol.nume))) erori.utilizator_id = 'Alege un proprietar sau un chiriaș activ.';
    if (!erori.plan_id && (!plan || !plan.activ)) erori.plan_id = 'Planul ales nu mai este disponibil.';
    if (!erori.utilizator_id && !erori.plan_id && plan.rol.nume !== u.rol.nume) erori.plan_id = `Planul „${plan.nume}” nu este pentru ${u.rol.nume === 'chirias' ? 'chiriași' : 'proprietari'}.`;

    if (plan && !erori.plan_id) model.completeazaDinPlan(plan);
    if (Object.keys(erori).length === 0 && (await this.abonamente.seSuprapune(model.utilizator_id, model.data_inceput, model.data_sfarsit))) {
      erori.data_inceput = 'Utilizatorul are deja un abonament în această perioadă. Anulează-l întâi sau alege o dată după ce se termină.';
    }
    if (Object.keys(erori).length > 0) return { model, erori };

    // Plata pe loc are sens doar daca planul costa ceva.
    const plata = model.plata_acum && model.pret > 0 ? { suma: model.pret, metoda: model.metoda } : null;
    const nou = await this.abonamente.addEntity(model.catreEntitate(), plata);
    await this.jurnal.noteaza(admin, 'creare', 'abonament', nou.id, `${u.prenume} ${u.nume} – ${plan.nume}, ${model.perioadaAfisata.toLowerCase()}, ${model.pretAfisat}${plata ? ', plătit' : ''}`);
    return { nou, u, plan };
  }

  // O plata (ex. a platit prin transfer). Intoarce { negasit } | { refuzat: text } | { erori } | { plata }.
  async adaugaPlata(id, date, admin) {
    const entitate = await this.abonamente.getById(id);
    if (!entitate) return { negasit: true };
    const a = AbonamentViewModel.dinEntitate(entitate);
    if (!a.poatePrimiPlata) {
      return { refuzat: a.esteActiv ? 'Abonamentul este deja plătit integral.' : `Abonamentul nu mai este activ (${a.stareAfisata.toLowerCase()}).` };
    }
    const { erori, plata } = valideazaPlata(date, a);
    if (Object.keys(erori).length > 0) return { erori };
    await this.abonamente.adaugaPlata(id, plata);
    await this.jurnal.noteaza(admin, 'plata', 'abonament', id, `${AbonamentViewModel.lei(plata.suma)} (${AbonamentViewModel.METODE[plata.metoda].toLowerCase()})`);
    return { plata };
  }

  // Anularea (istoricul platilor ramane). Intoarce { negasit } | { nuSePoate } | { a }.
  async anuleaza(id, admin) {
    const entitate = await this.abonamente.getById(id);
    if (!entitate) return { negasit: true };
    const a = AbonamentViewModel.dinEntitate(entitate);
    if (!a.poateFiAnulat) return { nuSePoate: true };
    await this.abonamente.anuleaza(id);
    await this.jurnal.noteaza(admin, 'anulare', 'abonament', id, `${a.utilizator_nume} – ${a.plan_nume}`);
    return { a };
  }
}

module.exports = AbonamenteAdmin;
module.exports.ROLURI_CU_ABONAMENT = ROLURI_CU_ABONAMENT;
module.exports.SORTARI = SORTARI;
