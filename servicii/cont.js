// Regulile contului unui utilizator conectat: profilul, schimbarea parolei si a emailului. Scrise O SINGURA DATA,
// folosite de paginile "Contul meu" (EJS) si de API (interfata React).
// Dependintele (accesorul, tokenurile) vin prin constructor, de la containerul DI (laboratorul 10).
const ContViewModel = require('../models/ContViewModel');
const { hashParola, verificaParola, verificaReguliParola } = require('./parole');
const emailuri = require('./emailuri');
const { trimite } = require('./email');

const Evenimente = require('./evenimente');

class Cont {
  constructor({ utilizatorAccessor, tokenuri, evenimente }) {
    this.utilizatori = utilizatorAccessor;
    this.tokenuri = tokenuri;
    this.evenimente = evenimente; // Singleton: anuntam "parola a fost schimbata" (alerta pe email o trimite un consumator)
  }

  // Datele de profil ale contului (nume, prenume, telefon, oras, email, rol).
  profil(utilizatorId) {
    return this.utilizatori.getProfil(utilizatorId);
  }

  // Salveaza profilul. model = ContViewModel deja validat (valideazaDate fara erori).
  modificaProfil(utilizatorId, model) {
    return this.utilizatori.actualizeazaProfil(utilizatorId, model.catreDate());
  }

  // Cerem parola curenta la orice schimbare sensibila: cine gaseste calculatorul deschis tot nu poate schimba nimic.
  async parolaCurentaCorecta(utilizatorId, parola) {
    return verificaParola(String(parola || ''), await this.utilizatori.getParolaHash(utilizatorId));
  }

  // Schimbarea parolei. Intoarce { erori } sau {} daca s-a schimbat.
  // Sesiunile (noua sesiune + inchiderea celorlalte) le face cine apeleaza, cu pastreazaDoarSesiuneaAsta.
  async schimbaParola(utilizatorId, curenta, noua, confirmare) {
    const parolaNoua = String(noua || '');
    const erori = {};
    if (!(await this.parolaCurentaCorecta(utilizatorId, curenta))) erori.parola_curenta = 'Parola curentă nu este corectă.';
    const eroareReguli = verificaReguliParola(parolaNoua);
    if (eroareReguli) erori.parola_noua = eroareReguli;
    else if (parolaNoua === String(curenta || '')) erori.parola_noua = 'Parola nouă trebuie să fie diferită de cea curentă.';
    if (!erori.parola_noua && parolaNoua !== String(confirmare || '')) erori.confirmare = 'Cele două parole nu se potrivesc.';
    if (Object.keys(erori).length > 0) return { erori };
    await this.utilizatori.seteazaParola(utilizatorId, await hashParola(parolaNoua));
    const u = await this.utilizatori.getProfil(utilizatorId);
    await this.evenimente.publica(Evenimente.PAROLA_SCHIMBATA, { utilizator: { email: u.email, prenume: u.prenume }, cum: 'schimbare', cand: new Date() });
    return {};
  }

  // Dupa schimbarea parolei: sesiune NOUA in acest browser si inchiderea tuturor celorlalte sesiuni ale contului
  // (ex. de pe alt calculator, unde cineva poate stia parola veche). pastreaza = campuri de pus in sesiunea noua.
  async pastreazaDoarSesiuneaAsta(req, utilizatorId, pastreaza = {}) {
    await new Promise((gata, esec) => req.session.regenerate((e) => (e ? esec(e) : gata())));
    Object.assign(req.session, pastreaza, { utilizatorId });
    await this.utilizatori.inchideSesiunile(utilizatorId, req.sessionID);
    await new Promise((gata, esec) => req.session.save((e) => (e ? esec(e) : gata())));
  }

  // Cererea de schimbare a emailului: adresa se schimba abia dupa confirmarea linkului trimis pe adresa NOUA
  // (asa stim ca e a lui si ca nu are greseli de scriere). u = { id, email } (utilizatorul conectat).
  // Intoarce { email, erori } sau { email } daca linkul a fost trimis.
  async cereSchimbareaEmailului(u, emailBrut, parolaCurenta) {
    const email = ContViewModel.normalizeazaEmail(emailBrut);
    const erori = {};
    if (!(await this.parolaCurentaCorecta(u.id, parolaCurenta))) erori.parola_curenta = 'Parola curentă nu este corectă.';
    if (!ContViewModel.emailValid(email)) erori.email = 'Adresa de email nu este validă.';
    else if (email === u.email) erori.email = 'Aceasta este deja adresa contului tău.';
    else if (await this.utilizatori.emailFolosit(email, u.id)) erori.email = 'Adresa este folosită de alt cont.';
    if (Object.keys(erori).length > 0) return { email, erori };

    const profil = await this.utilizatori.getProfil(u.id);
    const token = await this.tokenuri.creeaza(u.id, 'schimbare_email', email);
    const e = emailuri.schimbareEmail(profil, token);
    await trimite({ catre: email, subiect: e.subiect, text: e.text, html: e.html });
    return { email };
  }

  // Confirmarea noului email din link (merge si fara sa fii conectat). Adresa veche primeste un anunt:
  // daca nu el a facut schimbarea, afla imediat. Intoarce { eroare } sau { emailNou }.
  async confirmaSchimbareaEmailului(token) {
    const t = await this.tokenuri.foloseste(token, 'schimbare_email');
    if (!t) return { eroare: 'Linkul a expirat, a fost deja folosit sau ai cerut între timp altă schimbare. Cere un link nou din contul tău.' };
    const folosita = 'Între timp, adresa a fost folosită pentru alt cont.';
    if (await this.utilizatori.emailFolosit(t.email_nou, t.utilizator.id)) return { eroare: folosita };
    try {
      await this.utilizatori.schimbaEmail(t.utilizator.id, t.email_nou);
    } catch (eroare) {
      if (eroare.code === 'P2002') return { eroare: folosita }; // doua conturi au confirmat aceeasi adresa in acelasi timp
      throw eroare;
    }
    const e = emailuri.emailSchimbat(t.utilizator, t.email_nou);
    await trimite({ catre: t.utilizator.email, subiect: e.subiect, text: e.text, html: e.html });
    return { emailNou: t.email_nou };
  }
}

module.exports = Cont;
