// ViewModel pentru anunturi (laboratorul 6).
// Combina campuri din 3 tabele: anunt + proprietate (denumire, oras) + utilizator (proprietarul).

const TIPURI = ['inchiriere', 'vanzare'];
const STARI = ['ciorna', 'activ', 'inactiv'];
const MONEDE = ['RON', 'EUR'];

// Cum apar valorile in pagini (in baza de date raman fara diacritice).
const ETICHETE_TIP = { inchiriere: 'Închiriere', vanzare: 'Vânzare' };
const ETICHETE_STARE = { ciorna: 'Ciornă', activ: 'Activ', inactiv: 'Inactiv' };
const CULORI_STARE = { ciorna: 'warning', activ: 'success', inactiv: 'secondary' }; // culori Bootstrap

// true daca textul e gol (campurile optionale pot ramane goale)
const eGol = (valoare) => valoare === undefined || valoare === null || String(valoare).trim() === '';

// Telefonul pentru link-ul "tel:" (format international, fara spatii): 0712 345 678 -> +40712345678
function telefonInternational(telefon) {
  if (!telefon) return '';
  const cifre = telefon.replace(/[^\d+]/g, ''); // pastram doar cifrele si semnul +
  if (cifre.startsWith('+')) return cifre;
  if (cifre.startsWith('0040')) return '+' + cifre.slice(2);
  if (cifre.startsWith('0') && cifre.length === 10) return '+40' + cifre.slice(1); // numar romanesc
  return cifre;
}

// Telefonul pentru afisare, grupat ca sa se citeasca usor: 0712345678 -> 0712 345 678
function telefonAfisat(telefon) {
  if (!telefon) return '';
  const cifre = telefon.replace(/\D/g, '');
  if (cifre.length === 10 && cifre.startsWith('0')) return `${cifre.slice(0, 4)} ${cifre.slice(4, 7)} ${cifre.slice(7)}`;
  return telefon.trim();
}

// Suma in format romanesc, cu 2 zecimale: 1250.5 -> "1.250,50"
const suma = (valoare) => Number(valoare).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Data din baza de date (ex. 2026-11-15) -> "15.11.2026" pentru afisare
function formateazaData(data) {
  if (!data) return '';
  const zi = String(data.getUTCDate()).padStart(2, '0');
  const luna = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${zi}.${luna}.${data.getUTCFullYear()}`;
}

class AnuntViewModel {
  constructor(date = {}) {
    this.id = date.id ?? null;
    // campuri din tabelul anunt
    this.proprietate_id = date.proprietate_id ?? '';
    this.tip = date.tip ?? 'inchiriere';
    this.titlu = date.titlu ?? '';
    this.descriere = date.descriere ?? '';
    this.pret = date.pret ?? '';                       // la inchiriere: chiria pe luna pentru TOATA locuinta
    this.pret_o_persoana = date.pret_o_persoana ?? ''; // optional: pretul redus cand sta o singura persoana
    this.moneda = date.moneda ?? 'RON';
    this.garantie = date.garantie ?? '';
    this.disponibil_de_la = date.disponibil_de_la ?? ''; // text "AAAA-LL-ZZ", ca in campul de tip date
    this.locuri_libere = date.locuri_libere ?? '';
    this.stare = date.stare ?? 'ciorna';
    this.promovat = date.promovat ?? false;
    // campuri din alte tabele (doar pentru afisare)
    this.proprietate_denumire = date.proprietate_denumire ?? '';
    this.proprietate_oras = date.proprietate_oras ?? '';
    this.proprietate_stare = date.proprietate_stare ?? '';
    this.proprietate_max_locatari = date.proprietate_max_locatari ?? 1;
    this.proprietar_nume = date.proprietar_nume ?? '';
    this.proprietar_id = date.proprietar_id ?? null;
    this.creat_la = date.creat_la ?? null;
    this.proprietar_telefon = date.proprietar_telefon ?? '';
    // imaginile anuntului (din tabelul fisier): [{ id, url, nume }]
    this.imagini = date.imagini ?? [];
  }

  // Texte si culori pentru afisare.
  get creatLaAfisat() { return this.creat_la ? new Date(this.creat_la).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' }) : '–'; }
  get tipAfisat() { return ETICHETE_TIP[this.tip] || this.tip; }
  get stareAfisata() { return ETICHETE_STARE[this.stare] || this.stare; }
  get culoareStare() { return CULORI_STARE[this.stare] || 'secondary'; }
  get pretAfisat() { return `${suma(this.pret)} ${this.moneda}`; }
  get garantieAfisata() { return this.garantie === '' ? '–' : `${suma(this.garantie)} ${this.moneda}`; }
  get esteInchiriere() { return this.tip === 'inchiriere'; }
  get areReducereOPersoana() { return this.esteInchiriere && this.pret_o_persoana !== ''; }

  // Cat plateste fiecare chirias, de la 1 persoana pana la numarul maxim de locatari al proprietatii.
  // 1 persoana: pretul redus (daca exista) sau pretul intreg; 2+ persoane: pretul intreg impartit egal.
  get preturiPePersoane() {
    if (!this.esteInchiriere || this.pret === '') return [];
    const maxim = Math.max(1, Number(this.proprietate_max_locatari) || 1);
    const lista = [];
    for (let persoane = 1; persoane <= maxim; persoane++) {
      const redus = persoane === 1 && this.areReducereOPersoana;
      const pePersoana = redus ? Number(this.pret_o_persoana) : Number(this.pret) / persoane;
      lista.push({ persoane, redus, pePersoana: `${suma(pePersoana)} ${this.moneda}`, total: `${suma(pePersoana * persoane)} ${this.moneda}` });
    }
    return lista;
  }

  // Cel mai mic pret pe persoana (cand locuinta e plina), ex. "de la 400,00 RON / pers."
  get pretMinimPePersoana() {
    const lista = this.preturiPePersoane;
    return lista.length > 1 ? lista[lista.length - 1].pePersoana : null;
  }

  get areTelefon() { return telefonInternational(this.proprietar_telefon) !== ''; }
  get telefonLink() { return `tel:${telefonInternational(this.proprietar_telefon)}`; }
  get telefonAfisat() { return telefonAfisat(this.proprietar_telefon); }
  get primaImagine() { return this.imagini.length > 0 ? this.imagini[0].url : null; }
  get esteActiv() { return this.stare === 'activ'; }
  get proprietateInactiva() { return this.proprietate_stare === 'inactiv'; }
  get disponibilAfisat() { return this.disponibil_de_la ? formateazaData(new Date(this.disponibil_de_la)) : 'imediat'; }

  // Din entitatea venita din baza de date (cu proprietatea si proprietarul incluse)
  // si, optional, imaginile ei din tabelul fisier.
  static dinEntitate(a, imagini = []) {
    const p = a.proprietate;
    return new AnuntViewModel({
      ...a,
      pret: a.pret.toString(),
      pret_o_persoana: a.pret_o_persoana === null || a.pret_o_persoana === undefined ? '' : a.pret_o_persoana.toString(),
      garantie: a.garantie === null ? '' : a.garantie.toString(),
      disponibil_de_la: a.disponibil_de_la ? a.disponibil_de_la.toISOString().slice(0, 10) : '',
      locuri_libere: a.locuri_libere ?? '',
      descriere: a.descriere ?? '',
      proprietate_denumire: p ? p.denumire : '',
      proprietate_oras: p ? p.oras : '',
      proprietate_stare: p ? p.stare : '',
      proprietate_max_locatari: p ? p.max_locatari : 1,
      proprietar_nume: p && p.utilizator ? `${p.utilizator.prenume} ${p.utilizator.nume}` : '',
      proprietar_id: p ? p.proprietar_id : null,
      creat_la: a.creat_la ?? null,
      proprietar_telefon: p && p.utilizator ? p.utilizator.telefon ?? '' : '',
      imagini: imagini.map((f) => ({ id: f.id, url: f.cale, nume: f.nume_fisier })),
    });
  }

  // Din datele trimise de formular (toate vin ca text).
  static dinFormular(body) {
    return new AnuntViewModel({
      proprietate_id: body.proprietate_id,
      tip: body.tip,
      titlu: (body.titlu || '').trim(),
      descriere: (body.descriere || '').trim(),
      pret: (body.pret || '').trim(),
      pret_o_persoana: (body.pret_o_persoana || '').trim(),
      moneda: body.moneda,
      garantie: (body.garantie || '').trim(),
      disponibil_de_la: body.disponibil_de_la || '',
      locuri_libere: (body.locuri_libere || '').trim(),
      stare: body.stare,
      promovat: body.promovat === 'on', // checkbox-ul bifat trimite "on"
    });
  }

  // Verifica datele si intoarce erorile pe fiecare camp. Obiect gol = totul e in regula.
  valideaza() {
    const erori = {};
    if (!this.proprietate_id) erori.proprietate_id = 'Alege proprietatea.';
    if (!this.titlu) erori.titlu = 'Titlul este obligatoriu.';
    else if (this.titlu.length > 120) erori.titlu = 'Titlul poate avea cel mult 120 de caractere.';
    if (!TIPURI.includes(this.tip)) erori.tip = 'Alege un tip valid.';
    if (!STARI.includes(this.stare)) erori.stare = 'Alege o stare validă.';
    if (!MONEDE.includes(this.moneda)) erori.moneda = 'Alege moneda.';
    if (!(Number(this.pret) > 0)) erori.pret = 'Prețul trebuie să fie un număr mai mare ca 0.';
    if (!eGol(this.pret_o_persoana)) {
      const redus = Number(this.pret_o_persoana);
      if (this.tip !== 'inchiriere') erori.pret_o_persoana = 'Prețul pentru o persoană se folosește doar la închiriere.';
      else if (!(redus > 0)) erori.pret_o_persoana = 'Prețul pentru o persoană trebuie să fie un număr mai mare ca 0.';
      else if (Number(this.pret) > 0 && redus >= Number(this.pret)) erori.pret_o_persoana = 'Trebuie să fie mai mic decât prețul întreg (altfel nu e o reducere).';
    }
    if (!eGol(this.garantie) && !(Number(this.garantie) >= 0)) erori.garantie = 'Garanția trebuie să fie un număr pozitiv.';
    if (!eGol(this.locuri_libere)) {
      const n = Number(this.locuri_libere);
      if (!Number.isInteger(n) || n < 0) erori.locuri_libere = 'Introdu un număr întreg, 0 sau mai mare.';
    }
    if (!eGol(this.disponibil_de_la) && Number.isNaN(new Date(this.disponibil_de_la).getTime())) {
      erori.disponibil_de_la = 'Data nu este validă.';
    }
    return erori;
  }

  // Datele in forma ceruta de baza de date (doar campurile tabelului anunt).
  catreEntitate() {
    return {
      proprietate_id: Number(this.proprietate_id),
      tip: this.tip,
      titlu: this.titlu,
      descriere: this.descriere || null,
      pret: Number(this.pret),
      pret_o_persoana: eGol(this.pret_o_persoana) ? null : Number(this.pret_o_persoana),
      moneda: this.moneda,
      garantie: eGol(this.garantie) ? null : Number(this.garantie),
      disponibil_de_la: eGol(this.disponibil_de_la) ? null : new Date(this.disponibil_de_la),
      locuri_libere: eGol(this.locuri_libere) ? null : Number(this.locuri_libere),
      stare: this.stare,
      promovat: this.promovat,
    };
  }
}

AnuntViewModel.TIPURI = TIPURI;
AnuntViewModel.STARI = STARI;
AnuntViewModel.MONEDE = MONEDE;
AnuntViewModel.ETICHETE_TIP = ETICHETE_TIP;
AnuntViewModel.ETICHETE_STARE = ETICHETE_STARE;

module.exports = AnuntViewModel;