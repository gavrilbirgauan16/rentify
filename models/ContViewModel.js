// ViewModel pentru datele contului: inregistrarea (cont nou) si profilul (modificarea datelor).
// Aceleasi reguli in ambele locuri, scrise o singura data.
const { verificaReguliParola } = require('../servicii/parole');

const ROLURI_INREGISTRARE = ['proprietar', 'chirias'];
const text = (v) => String(v ?? '').trim();

// Email: litere mici, fara spatii, forma nume@domeniu.tld (verificarea reala o face linkul de confirmare).
const normalizeazaEmail = (v) => text(v).toLowerCase();
const emailValid = (e) => e.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// Telefon romanesc: mobil sau fix, cu sau fara +40. Se salveaza in forma 07xxxxxxxx.
function normalizeazaTelefon(v) {
  const cifre = text(v).replace(/[\s.()-]/g, '');
  if (cifre === '') return '';
  const m = cifre.match(/^(?:\+40|0040|0)([237]\d{8})$/);
  return m ? `0${m[1]}` : null; // null = format gresit
}

const numeValid = (n) => n.length >= 2 && n.length <= 60 && /^[\p{L}][\p{L} .'-]*$/u.test(n);

class ContViewModel {
  constructor(date = {}) {
    this.rol = date.rol ?? 'chirias';
    this.prenume = date.prenume ?? '';
    this.nume = date.nume ?? '';
    this.email = date.email ?? '';
    this.telefon = date.telefon ?? '';
    this.oras = date.oras ?? '';
    this.parola = date.parola ?? '';
    this.confirmare = date.confirmare ?? '';
    this.termeni = date.termeni ?? false;
  }

  // Formularul de inregistrare
  static dinInregistrare(body) {
    return new ContViewModel({
      rol: text(body.rol),
      prenume: text(body.prenume),
      nume: text(body.nume),
      email: normalizeazaEmail(body.email),
      telefon: text(body.telefon),
      oras: text(body.oras),
      parola: String(body.parola ?? ''),
      confirmare: String(body.confirmare ?? ''),
      termeni: body.termeni === 'on',
    });
  }

  // Formularul de profil (fara rol, email si parola: acelea se schimba separat)
  static dinProfil(body, rol) {
    return new ContViewModel({ rol, prenume: text(body.prenume), nume: text(body.nume), telefon: text(body.telefon), oras: text(body.oras) });
  }

  static dinEntitate(u) {
    return new ContViewModel({ rol: u.rol?.nume ?? '', prenume: u.prenume, nume: u.nume, email: u.email, telefon: u.telefon ?? '', oras: u.oras ?? '' });
  }

  // Regulile comune: nume, prenume, telefon (obligatoriu pentru proprietari: chiriasii trebuie sa-i poata suna), oras.
  valideazaDate() {
    const erori = {};
    if (!numeValid(this.prenume)) erori.prenume = 'Scrie prenumele (cel puțin 2 litere).';
    if (!numeValid(this.nume)) erori.nume = 'Scrie numele (cel puțin 2 litere).';
    const tel = normalizeazaTelefon(this.telefon);
    if (tel === null) erori.telefon = 'Număr de telefon invalid. Exemplu: 0712 345 678.';
    else if (tel === '' && this.rol === 'proprietar') erori.telefon = 'Proprietarii trebuie să aibă un număr de telefon, ca să poată fi contactați.';
    if (this.oras.length > 50) erori.oras = 'Orașul poate avea cel mult 50 de caractere.';
    return erori;
  }

  valideazaInregistrare() {
    const erori = this.valideazaDate();
    if (!ROLURI_INREGISTRARE.includes(this.rol)) erori.rol = 'Alege dacă ești proprietar sau chiriaș.';
    if (!emailValid(this.email)) erori.email = 'Adresa de email nu este validă.';
    const reguli = verificaReguliParola(this.parola);
    if (reguli) erori.parola = reguli;
    else if (this.parola !== this.confirmare) erori.confirmare = 'Cele două parole nu se potrivesc.';
    if (!this.termeni) erori.termeni = 'Trebuie să accepți termenii și prelucrarea datelor.';
    return erori;
  }

  // Datele de salvat (telefonul deja adus la forma 07xxxxxxxx).
  catreDate() {
    return { prenume: this.prenume, nume: this.nume, telefon: normalizeazaTelefon(this.telefon) || null, oras: this.oras || null };
  }
}

ContViewModel.ROLURI_INREGISTRARE = ROLURI_INREGISTRARE;
ContViewModel.normalizeazaEmail = normalizeazaEmail;
ContViewModel.emailValid = emailValid;
ContViewModel.normalizeazaTelefon = normalizeazaTelefon;
module.exports = ContViewModel;
