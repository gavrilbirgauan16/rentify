// ViewModel pentru utilizatori in partea de administrare. Combina: utilizator + rol +
// numarul de proprietati + abonamentul curent (cu planul si limitele lui). Parola NU ajunge niciodata aici.
const AbonamentViewModel = require('./AbonamentViewModel');
const limite = require('../servicii/limite');

const ROLURI = { admin: 'Admin', proprietar: 'Proprietar', chirias: 'Chiriaș' };
const STARI = { activ: { text: 'Activ', culoare: 'success' }, blocat: { text: 'Blocat', culoare: 'danger' } };

const dataOra = (d) => (d ? new Date(d).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' }) : 'niciodată');

class UtilizatorViewModel {
  // e = utilizatorul din baza de date; abonamentCurent = entitatea abonamentului care ruleaza azi (sau null)
  constructor(e, abonamentCurent = null) {
    this.id = e.id;
    this.nume = e.nume;
    this.prenume = e.prenume;
    this.email = e.email;
    this.telefon = e.telefon ?? '';
    this.oras = e.oras ?? '';
    this.rol = e.rol?.nume ?? '';
    this.stare = e.stare;
    this.creat_la = e.creat_la;
    this.ultima_autentificare = e.ultima_autentificare;
    this.schimba_parola = e.schimba_parola ?? false;
    this.email_verificat = e.email_verificat ?? true;
    this.nrProprietati = e._count?.proprietate ?? 0;
    this.proprietati = e.proprietate ?? [];
    this.abonamentEntitate = abonamentCurent;
    this.abonament = abonamentCurent ? AbonamentViewModel.dinEntitate(abonamentCurent) : null;
  }

  get numeComplet() { return `${this.prenume} ${this.nume}`; }
  get rolAfisat() { return ROLURI[this.rol] || this.rol; }
  get stareAfisata() { return (STARI[this.stare] || STARI.activ).text; }
  get culoareStare() { return (STARI[this.stare] || STARI.activ).culoare; }
  get esteBlocat() { return this.stare === 'blocat'; }
  get areParolaTemporara() { return this.schimba_parola; }
  get emailConfirmat() { return this.email_verificat; }
  get areAbonamente() { return this.rol === 'proprietar' || this.rol === 'chirias'; }
  get ultimaAutentificareAfisata() { return dataOra(this.ultima_autentificare); }
  get creatLaAfisat() { return dataOra(this.creat_la); }

  // Doar pentru proprietari: cate proprietati are fata de cate ii permite planul.
  get situatieProprietati() {
    if (this.rol !== 'proprietar') return null;
    // Fara abonament in curs nu are voie la nicio proprietate activa.
    if (!this.abonamentEntitate) {
      return { folosit: this.nrProprietati, maxim: 0, depaseste: this.nrProprietati > 0, faraPlan: true, text: `${this.nrProprietati} / fără plan` };
    }
    return limite.situatie(this.nrProprietati, limite.limita(this.abonamentEntitate, 'max_proprietati'));
  }

  // Adminul poate bloca sau reseta parola oricui, in afara de el insusi si de alti admini
  // (parola proprie si-o schimba din "Schimba parola").
  poateFiAdministratDe(adminId) { return this.rol !== 'admin' && this.id !== adminId; }
}

UtilizatorViewModel.ROLURI = ROLURI;
UtilizatorViewModel.STARI = STARI;
module.exports = UtilizatorViewModel;
