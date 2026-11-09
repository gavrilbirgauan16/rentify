// ViewModel pentru planurile de abonament (pentru proprietari si pentru chiriasi).
// Combina campuri din 3 tabele: plan_abonament + rol (pentru cine e planul) + limita_plan (limitele si beneficiile).

// Pentru cine poate fi un plan (numele rolurilor din tabelul "rol").
const ROLURI = ['proprietar', 'chirias'];
const ETICHETE_ROL = { proprietar: 'Proprietari', chirias: 'Chiriași' };

// Ce poate contine un plan, pe roluri. Scrise o singura data aici: din ele se fac si cardurile, si formularul.
//  - "limita": un numar maxim; daca lipseste din baza de date inseamna NELIMITAT
//  - "beneficiu": 1 = inclus, 0 sau lipsa = neinclus
const CARACTERISTICI = {
  proprietar: [
    {
      cheie: 'max_proprietati', tip: 'limita', min: 1, campFormular: 'Număr maxim de proprietăți',
      text: (v) => (v === null ? 'Proprietăți nelimitate, cu anunțurile lor' : v === 1 ? '1 proprietate, cu anunțurile ei' : `Până la ${v} proprietăți, cu anunțurile lor`),
    },
  ],
  chirias: [
    {
      cheie: 'max_contactari_luna', tip: 'limita', min: 0, campFormular: 'Contactări de proprietari pe lună',
      text: (v) => (v === null ? 'Contactezi proprietari fără limită' : `${v} contactări de proprietari pe lună`),
    },
    { cheie: 'chirie_impartita', tip: 'beneficiu', text: () => 'Chiria împărțită cu colegii, fiecare își vede partea' },
    { cheie: 'dovezi_utilitati', tip: 'beneficiu', text: () => 'Încarci dovezi de plată pentru utilități' },
    { cheie: 'amanare_plata', tip: 'beneficiu', text: () => 'Ceri amânarea plății la proprietar' },
    { cheie: 'raport_pdf', tip: 'beneficiu', text: () => 'Raport PDF cu plățile tale, pe mail' },
    { cheie: 'sesizari', tip: 'beneficiu', text: () => 'Sesizări pentru apartament sau bloc' },
  ],
};

// Ce primeste oricine are un plan pentru rolul respectiv (functii care exista deja in aplicatie).
const INCLUSE_MEREU = {
  proprietar: ['Anunțuri cu până la 6 imagini', 'Buton „Sună” pe fiecare anunț', 'Chiria împărțită automat pe chiriași'],
  chirias: ['Vezi toate anunțurile'],
};

const eGol = (valoare) => valoare === undefined || valoare === null || String(valoare).trim() === '';
const lei = (valoare) => `${Number(valoare).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} lei`;

class PlanViewModel {
  constructor(date = {}) {
    this.id = date.id ?? null;
    this.rol = date.rol ?? 'proprietar';
    this.nume = date.nume ?? '';
    this.descriere = date.descriere ?? '';
    this.pret_lunar = date.pret_lunar ?? '';
    this.pret_anual = date.pret_anual ?? '';
    this.activ = date.activ ?? true;
    this.recomandat = date.recomandat ?? false;
    this.limite = date.limite ?? {}; // { cheie: valoare text } - gol = nelimitat / neinclus
    this.abonati = date.abonati ?? 0; // cate abonamente active are planul (doar pentru afisare)
  }

  // Afisare
  get rolAfisat() { return ETICHETE_ROL[this.rol] || this.rol; }
  get esteGratuit() { return Number(this.pret_lunar) === 0 && Number(this.pret_anual) === 0; }
  get pretLunarAfisat() { return lei(this.pret_lunar); }
  get pretAnualAfisat() { return lei(this.pret_anual); }
  get economieAnuala() {
    const economie = Number(this.pret_lunar) * 12 - Number(this.pret_anual);
    return economie > 0 ? lei(economie) : null;
  }

  // Lista pentru card: ce include planul (✓) si ce nu (✕).
  get caracteristici() {
    const lista = (INCLUSE_MEREU[this.rol] || []).map((text) => ({ text, inclus: true }));
    for (const c of CARACTERISTICI[this.rol] || []) {
      const v = this.limite[c.cheie];
      if (c.tip === 'limita') lista.push({ text: c.text(eGol(v) ? null : Number(v)), inclus: eGol(v) || Number(v) > 0 });
      else lista.push({ text: c.text(), inclus: String(v) === '1' });
    }
    return lista;
  }

  // Din baza de date (planul cu rolul si randurile din limita_plan).
  static dinEntitate(p) {
    const limite = {};
    for (const l of p.limita_plan || []) limite[l.cheie] = String(l.valoare);
    return new PlanViewModel({
      ...p,
      rol: p.rol ? p.rol.nume : undefined,
      descriere: p.descriere ?? '',
      pret_lunar: p.pret_lunar.toString(),
      pret_anual: p.pret_anual.toString(),
      limite,
      abonati: p._count ? p._count.abonament : 0,
    });
  }

  // Din formular. Beneficiile sunt checkbox-uri (bifat = "on"), limitele sunt numere (gol = nelimitat).
  static dinFormular(body, rol) {
    const limite = {};
    for (const c of CARACTERISTICI[rol] || []) {
      const valoare = body[`limita_${c.cheie}`];
      limite[c.cheie] = c.tip === 'beneficiu' ? (valoare === 'on' ? '1' : '0') : String(valoare ?? '').trim();
    }
    return new PlanViewModel({
      rol,
      nume: String(body.nume || '').trim(),
      descriere: String(body.descriere || '').trim(),
      pret_lunar: String(body.pret_lunar ?? '').trim(),
      pret_anual: String(body.pret_anual ?? '').trim(),
      activ: body.activ === 'on',
      recomandat: body.recomandat === 'on',
      limite,
    });
  }

  valideaza() {
    const erori = {};
    if (!ROLURI.includes(this.rol)) erori.rol = 'Rol necunoscut.';
    if (!this.nume) erori.nume = 'Numele este obligatoriu.';
    else if (this.nume.length > 50) erori.nume = 'Numele poate avea cel mult 50 de caractere.';
    if (this.descriere.length > 300) erori.descriere = 'Descrierea poate avea cel mult 300 de caractere.';

    const lunar = Number(this.pret_lunar);
    const anual = Number(this.pret_anual);
    if (eGol(this.pret_lunar) || !(lunar >= 0)) erori.pret_lunar = 'Introdu un preț de 0 sau mai mare.';
    if (eGol(this.pret_anual) || !(anual >= 0)) erori.pret_anual = 'Introdu un preț de 0 sau mai mare.';
    else if (!erori.pret_lunar && anual > lunar * 12) erori.pret_anual = `Plata anuală nu poate costa mai mult decât 12 luni (${lei(lunar * 12)}).`;

    for (const c of CARACTERISTICI[this.rol] || []) {
      if (c.tip !== 'limita' || eGol(this.limite[c.cheie])) continue;
      const n = Number(this.limite[c.cheie]);
      if (!Number.isInteger(n) || n < c.min) erori[`limita_${c.cheie}`] = `Introdu un număr întreg de la ${c.min} în sus, sau lasă gol pentru nelimitat.`;
    }
    if (this.recomandat && !this.activ) erori.recomandat = 'Un plan inactiv nu poate fi recomandat.';
    return erori;
  }

  // Datele pentru tabelul plan_abonament.
  catreEntitate() {
    return {
      nume: this.nume,
      descriere: this.descriere || null,
      pret_lunar: Number(this.pret_lunar),
      pret_anual: Number(this.pret_anual),
      activ: this.activ,
      recomandat: this.recomandat,
    };
  }

  // Randurile pentru tabelul limita_plan (limitele goale = nelimitat, deci fara rand).
  catreLimite() {
    return (CARACTERISTICI[this.rol] || [])
      .filter((c) => !eGol(this.limite[c.cheie]))
      .map((c) => ({ cheie: c.cheie, valoare: Number(this.limite[c.cheie]) }));
  }
}

PlanViewModel.ROLURI = ROLURI;
PlanViewModel.ETICHETE_ROL = ETICHETE_ROL;
PlanViewModel.CARACTERISTICI = CARACTERISTICI;

module.exports = PlanViewModel;