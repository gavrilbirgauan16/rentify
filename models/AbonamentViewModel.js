// ViewModel pentru abonamente. Combina campuri din 5 tabele:
// abonament + utilizator (cine) + rol + plan_abonament (ce plan) + plata_abonament (ce a platit).
const D = require('../servicii/date');

const PERIOADE = { lunar: 'Lunar', anual: 'Anual' };
const METODE = { card: 'Card', transfer: 'Transfer bancar', numerar: 'Numerar' };
const ZILE_AVERTIZARE = 7; // "expira curand" = mai are cel mult atatea zile

// Starea afisata a unui abonament. In baza de date tinem doar 'activ' / 'anulat';
// restul (expirat, neplatit...) se CALCULEAZA din date si plati, ca sa nu poata fi niciodata gresit.
const STARI = {
  anulat: { text: 'Anulat', culoare: 'secondary' },
  expirat: { text: 'Expirat', culoare: 'dark' },
  programat: { text: 'Începe curând', culoare: 'info' },
  neplatit: { text: 'Neplătit', culoare: 'danger' },
  platit: { text: 'Activ, plătit', culoare: 'success' },
};

const eGol = (v) => v === undefined || v === null || String(v).trim() === '';
const lei = (v) => `${Number(v).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;
const bani = (v) => Math.round(Number(v) * 100); // calculele cu bani le facem in bani (intregi), nu cu zecimale

class AbonamentViewModel {
  constructor(date = {}) {
    this.id = date.id ?? null;
    this.utilizator_id = date.utilizator_id ?? '';
    this.plan_id = date.plan_id ?? '';
    this.perioada = date.perioada ?? 'lunar';
    this.pret = date.pret ?? 0;
    this.data_inceput = date.data_inceput ?? D.azi();
    this.data_sfarsit = date.data_sfarsit ?? '';
    this.reinnoire_automata = date.reinnoire_automata ?? false;
    this.stare = date.stare ?? 'activ';
    this.creat_la = date.creat_la ?? null;
    // din formular: platit pe loc?
    this.plata_acum = date.plata_acum ?? false;
    this.metoda = date.metoda ?? 'card';
    // din tabelele legate (doar pentru afisare)
    this.utilizator_nume = date.utilizator_nume ?? '';
    this.utilizator_email = date.utilizator_email ?? '';
    this.rol = date.rol ?? '';
    this.plan_nume = date.plan_nume ?? '';
    this.plati = date.plati ?? [];
  }

  // Din baza de date (cu utilizator, rol, plan si plati incluse)
  static dinEntitate(e) {
    return new AbonamentViewModel({
      id: e.id,
      utilizator_id: e.utilizator_id,
      plan_id: e.plan_id,
      perioada: e.perioada,
      pret: Number(e.pret),
      data_inceput: D.dinDate(e.data_inceput),
      data_sfarsit: D.dinDate(e.data_sfarsit),
      reinnoire_automata: e.reinnoire_automata,
      stare: e.stare,
      creat_la: e.creat_la,
      utilizator_nume: e.utilizator ? `${e.utilizator.prenume} ${e.utilizator.nume}` : '',
      utilizator_email: e.utilizator?.email ?? '',
      rol: e.utilizator?.rol?.nume ?? '',
      plan_nume: e.plan_abonament?.nume ?? '',
      plati: (e.plata_abonament ?? []).map((p) => ({
        id: p.id, suma: Number(p.suma), metoda: p.metoda, stare: p.stare, data_platii: p.data_platii, referinta: p.referinta,
      })),
    });
  }

  // Din formularul de Create
  static dinFormular(body) {
    return new AbonamentViewModel({
      utilizator_id: eGol(body.utilizator_id) ? '' : Number(body.utilizator_id),
      plan_id: eGol(body.plan_id) ? '' : Number(body.plan_id),
      perioada: body.perioada,
      data_inceput: String(body.data_inceput ?? '').trim(),
      reinnoire_automata: body.reinnoire_automata === 'on',
      plata_acum: body.plata_acum === 'on',
      metoda: body.metoda,
    });
  }

  // Validarea campurilor (regulile care tin de alte inregistrari - plan potrivit, suprapuneri - sunt in controller)
  valideaza() {
    const erori = {};
    if (!Number.isInteger(this.utilizator_id)) erori.utilizator_id = 'Alege utilizatorul.';
    if (!Number.isInteger(this.plan_id)) erori.plan_id = 'Alege planul.';
    if (!PERIOADE[this.perioada]) erori.perioada = 'Alege perioada (lunar sau anual).';
    if (!D.eDataValida(this.data_inceput)) erori.data_inceput = 'Data de început nu este validă.';
    else if (D.zileIntre(D.azi(), this.data_inceput) < -31) erori.data_inceput = 'Data de început poate fi cel mult cu o lună în urmă.';
    if (this.plata_acum && !METODE[this.metoda]) erori.metoda = 'Alege metoda de plată.';
    return erori;
  }

  // Pretul si data de sfarsit se calculeaza din plan si perioada: adminul nu le scrie de mana.
  completeazaDinPlan(plan) {
    this.pret = Number(this.perioada === 'anual' ? plan.pret_anual : plan.pret_lunar);
    if (D.eDataValida(this.data_inceput)) this.data_sfarsit = D.sfarsitPerioada(this.data_inceput, this.perioada);
  }

  catreEntitate() {
    return {
      utilizator_id: this.utilizator_id,
      plan_id: this.plan_id,
      perioada: this.perioada,
      pret: this.pret,
      data_inceput: D.catreDate(this.data_inceput),
      data_sfarsit: D.catreDate(this.data_sfarsit),
      reinnoire_automata: this.reinnoire_automata,
    };
  }

  // ---- Bani ----
  get totalPlatit() { return this.plati.filter((p) => p.stare === 'reusita').reduce((s, p) => s + bani(p.suma), 0) / 100; }
  get restDePlata() { return Math.max(0, bani(this.pret) - bani(this.totalPlatit)) / 100; }
  get estePlatit() { return bani(this.totalPlatit) >= bani(this.pret); }
  get pretAfisat() { return Number(this.pret) === 0 ? 'Gratuit' : lei(this.pret); }
  get totalPlatitAfisat() { return lei(this.totalPlatit); }
  get restDePlataAfisat() { return lei(this.restDePlata); }

  // ---- Starea ----
  stareCod(astazi = D.azi()) {
    if (this.stare === 'anulat') return 'anulat';
    if (this.data_sfarsit && this.data_sfarsit < astazi) return 'expirat';
    if (this.data_inceput > astazi) return 'programat';
    return this.estePlatit ? 'platit' : 'neplatit';
  }
  get stareAfisata() { return STARI[this.stareCod()].text; }
  get culoareStare() { return STARI[this.stareCod()].culoare; }
  get zileRamase() { return D.zileIntre(D.azi(), this.data_sfarsit); }
  get esteInDesfasurare() { return ['platit', 'neplatit'].includes(this.stareCod()); }
  get expiraCurand() { return this.esteInDesfasurare && this.zileRamase <= ZILE_AVERTIZARE; }
  get poateFiAnulat() { return this.stare !== 'anulat' && this.stareCod() !== 'expirat'; }
  get poatePrimiPlata() { return this.stare !== 'anulat' && !this.estePlatit; }

  // ---- Afisare ----
  get perioadaAfisata() { return PERIOADE[this.perioada] || this.perioada; }
  get intervalAfisat() { return `${D.afiseaza(this.data_inceput)} – ${D.afiseaza(this.data_sfarsit)}`; }
  get rolAfisat() { return { proprietar: 'Proprietar', chirias: 'Chiriaș' }[this.rol] || this.rol; }
}

// Valideaza o plata noua pentru un abonament (suma intre 0,01 si restul de plata).
function valideazaPlata(body, abonament) {
  const erori = {};
  const text = String(body.suma ?? '').trim().replace(',', '.');
  const suma = Number(text);
  if (text === '' || !Number.isFinite(suma) || suma <= 0) erori.suma = 'Scrie o sumă mai mare decât 0.';
  else if (!/^\d+(\.\d{1,2})?$/.test(text)) erori.suma = 'Suma poate avea cel mult 2 zecimale.';
  else if (bani(suma) > bani(abonament.restDePlata)) erori.suma = `Suma depășește restul de plată (${abonament.restDePlataAfisat}).`;
  if (!METODE[body.metoda]) erori.metoda = 'Alege metoda de plată.';
  const referinta = String(body.referinta ?? '').trim();
  if (referinta.length > 100) erori.referinta = 'Referința poate avea cel mult 100 de caractere.';
  return { erori, plata: { suma, metoda: body.metoda, referinta: referinta || null } };
}

AbonamentViewModel.PERIOADE = PERIOADE;
AbonamentViewModel.METODE = METODE;
AbonamentViewModel.STARI = STARI;
AbonamentViewModel.lei = lei;
module.exports = AbonamentViewModel;
module.exports.valideazaPlata = valideazaPlata;