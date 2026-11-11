// ViewModel: datele unei proprietati, asa cum apar in paginile aplicatiei.
// Face legatura dintre formular (text) si baza de date (numere, da/nu).

const TIPURI = ['apartament', 'garsoniera', 'casa', 'camera'];
const STARI = ['liber', 'ocupat', 'inactiv'];

// Cum apar valorile in pagini (in baza de date raman fara diacritice).
const ETICHETE_TIP = { apartament: 'Apartament', garsoniera: 'Garsonieră', casa: 'Casă', camera: 'Cameră' };
const ETICHETE_STARE = { liber: 'Liber', ocupat: 'Ocupat', inactiv: 'Inactiv' };
const CULORI_STARE = { liber: 'success', ocupat: 'warning', inactiv: 'secondary' }; // culori Bootstrap

// true daca valoarea (text sau numar) este un numar intreg mai mare sau egal cu 1
function esteIntregPozitiv(valoare) {
  const n = Number(valoare);
  return Number.isInteger(n) && n >= 1;
}

class ProprietateViewModel {
  constructor(date = {}) {
    this.id = date.id ?? null;
    this.denumire = date.denumire ?? '';
    this.tip = date.tip ?? 'apartament';
    this.judet = date.judet ?? 'Suceava';
    this.oras = date.oras ?? '';
    this.zona = date.zona ?? '';
    this.nr_camere = date.nr_camere ?? 1;
    this.suprafata_mp = date.suprafata_mp ?? '';
    this.max_locatari = date.max_locatari ?? 1;
    this.are_balcon = date.are_balcon ?? false;
    this.stare = date.stare ?? 'liber';
    this.proprietar_id = date.proprietar_id ?? '';
    this.proprietar_nume = date.proprietar_nume ?? '';
    this.anunturi_active = date.anunturi_active ?? null; // doar in liste (cate anunturi active are)
  }

  // Texte si culori pentru afisare.
  get tipAfisat() { return ETICHETE_TIP[this.tip] || this.tip; }
  get stareAfisata() { return ETICHETE_STARE[this.stare] || this.stare; }
  get culoareStare() { return CULORI_STARE[this.stare] || 'secondary'; }

  // Din entitatea venita din baza de date.
  static dinEntitate(p) {
    return new ProprietateViewModel({
      ...p,
      suprafata_mp: p.suprafata_mp === null ? '' : p.suprafata_mp.toString(),
      proprietar_nume: p.utilizator ? `${p.utilizator.prenume} ${p.utilizator.nume}` : '',
      anunturi_active: p._count?.anunt ?? null,
    });
  }

  // Din datele trimise de formular (toate vin ca text).
  static dinFormular(body) {
    return new ProprietateViewModel({
      denumire: (body.denumire || '').trim(),
      tip: body.tip,
      judet: (body.judet || '').trim(),
      oras: (body.oras || '').trim(),
      zona: (body.zona || '').trim(),
      nr_camere: body.nr_camere,
      suprafata_mp: body.suprafata_mp,
      max_locatari: body.max_locatari,
      are_balcon: body.are_balcon === 'on', // checkbox-ul bifat trimite "on", nebifat nu trimite nimic
      stare: body.stare,
      proprietar_id: body.proprietar_id,
    });
  }

  // Verifica datele si intoarce erorile pe fiecare camp, de exemplu { oras: 'Orașul este obligatoriu.' }.
  // Un obiect gol inseamna ca totul e in regula.
  valideaza() {
    const erori = {};
    if (!this.denumire) erori.denumire = 'Denumirea este obligatorie.';
    if (!this.judet) erori.judet = 'Județul este obligatoriu.';
    if (!this.oras) erori.oras = 'Orașul este obligatoriu.';
    if (!TIPURI.includes(this.tip)) erori.tip = 'Alege un tip valid.';
    if (!STARI.includes(this.stare)) erori.stare = 'Alege o stare validă.';
    if (!esteIntregPozitiv(this.nr_camere)) erori.nr_camere = 'Introdu un număr întreg, cel puțin 1.';
    if (!esteIntregPozitiv(this.max_locatari)) erori.max_locatari = 'Introdu un număr întreg, cel puțin 1.';
    if (this.suprafata_mp !== '' && !(Number(this.suprafata_mp) > 0)) erori.suprafata_mp = 'Suprafața trebuie să fie un număr pozitiv.';
    if (!this.proprietar_id) erori.proprietar_id = 'Alege proprietarul.';
    return erori;
  }

  // Datele in forma ceruta de baza de date.
  catreEntitate() {
    return {
      denumire: this.denumire,
      tip: this.tip,
      judet: this.judet,
      oras: this.oras,
      zona: this.zona || null,
      nr_camere: Number(this.nr_camere),
      suprafata_mp: this.suprafata_mp === '' ? null : Number(this.suprafata_mp),
      max_locatari: Number(this.max_locatari),
      are_balcon: this.are_balcon,
      stare: this.stare,
      proprietar_id: Number(this.proprietar_id),
    };
  }
}

ProprietateViewModel.TIPURI = TIPURI;
ProprietateViewModel.STARI = STARI;
ProprietateViewModel.ETICHETE_TIP = ETICHETE_TIP;
ProprietateViewModel.ETICHETE_STARE = ETICHETE_STARE;

module.exports = ProprietateViewModel;