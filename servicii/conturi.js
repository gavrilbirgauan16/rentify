// Regulile conturilor: inregistrarea, confirmarea emailului, parola uitata. Scrise O SINGURA DATA si folosite
// de paginile EJS, de API (interfata React) si de admin (retrimiterea linkurilor).
// Regula comuna: raspunsurile publice NU spun daca o adresa de email are cont (diferenta e doar in emailul trimis).
// Dependintele (accesorii, tokenurile) vin prin constructor, de la containerul DI (laboratorul 10).
const ContViewModel = require('../models/ContViewModel');
const { hashParola, verificaReguliParola } = require('./parole');
const emailuri = require('./emailuri');
const { trimite } = require('./email');
const { abonamentGratuit } = require('../models/AbonamentViewModel');
const Evenimente = require('./evenimente');
const { azi } = require('./date');

class Conturi {
  constructor({ utilizatorAccessor, planAccessor, tokenuri, evenimente }) {
    this.utilizatori = utilizatorAccessor;
    this.planuri = planAccessor;
    this.tokenuri = tokenuri;
    this.evenimente = evenimente; // Singleton: anuntam "parola a fost schimbata" (alerta pe email o trimite un consumator)
  }

  // Trimite linkul de confirmare (unul nou; cel vechi nu mai merge).
  async trimiteConfirmarea(u) {
    const token = await this.tokenuri.creeaza(u.id, 'confirmare_email');
    const e = emailuri.confirmareCont(u, token);
    await trimite({ catre: u.email, subiect: e.subiect, text: e.text, html: e.html });
  }

  // Trimite linkul de resetare a parolei. Intoarce true daca emailul a plecat.
  async trimiteLinkResetare(u) {
    const token = await this.tokenuri.creeaza(u.id, 'resetare_parola');
    const e = emailuri.resetareParola(u, token);
    return trimite({ catre: u.email, subiect: e.subiect, text: e.text, html: e.html });
  }

  // Inregistrarea unui cont nou. model = ContViewModel deja validat (valideazaInregistrare fara erori).
  // Acelasi rezultat pentru o adresa noua sau una deja folosita; diferenta e doar in emailul primit:
  //  - adresa noua: cont nou + link de confirmare;
  //  - cont neconfirmat: link de confirmare nou;
  //  - cont confirmat: email "ai deja un cont" (cu link spre parola uitata).
  async inregistreaza(model) {
    const existent = await this.utilizatori.getByEmail(model.email);
    if (existent) {
      if (!existent.email_verificat && existent.stare === 'activ') await this.trimiteConfirmarea(existent);
      else if (existent.stare === 'activ') {
        const e = emailuri.contExistent(existent);
        await trimite({ catre: existent.email, subiect: e.subiect, text: e.text, html: e.html });
      }
      return;
    }
    try {
      const u = await this.utilizatori.creeazaCont(model.rol, { ...model.catreDate(), email: model.email }, await hashParola(model.parola));
      await this.trimiteConfirmarea(u);
    } catch (eroare) {
      if (eroare.code !== 'P2002') throw eroare; // P2002: s-a creat chiar acum un cont cu aceeasi adresa (doua trimiteri simultane)
    }
  }

  // Confirma emailul din link. Contul primeste automat planul gratuit al rolului lui.
  // Intoarce true daca s-a confirmat, false daca linkul e expirat / folosit / inlocuit.
  async confirmaEmailul(token) {
    const t = await this.tokenuri.foloseste(token, 'confirmare_email');
    if (!t) return false;
    const rol = t.utilizator.rol.nume;
    const plan = await this.planuri.getGratuit(rol);
    if (!plan) console.error(`Nu exista un plan gratuit activ pentru rolul "${rol}": contul a fost confirmat fara abonament.`);
    await this.utilizatori.confirmaEmail(t.utilizator.id, plan ? abonamentGratuit(plan.id, azi()) : null);
    return true;
  }

  // Retrimite linkul de confirmare, doar unui cont activ si neconfirmat. Intoarce adresa curatata (pentru afisare).
  async retrimiteConfirmarea(emailBrut) {
    const email = ContViewModel.normalizeazaEmail(emailBrut);
    const u = ContViewModel.emailValid(email) ? await this.utilizatori.getByEmail(email) : null;
    if (u && !u.email_verificat && u.stare === 'activ') await this.trimiteConfirmarea(u);
    return email;
  }

  // "Am uitat parola": trimite linkul doar unui cont activ. Intoarce adresa curatata.
  async cereResetarea(emailBrut) {
    const email = ContViewModel.normalizeazaEmail(emailBrut);
    const u = ContViewModel.emailValid(email) ? await this.utilizatori.getByEmail(email) : null;
    if (u && u.stare === 'activ') await this.trimiteLinkResetare(u);
    return email;
  }

  // Linkul de resetare e inca valabil? Intoarce emailul contului sau null. (Doar verifica, nu consuma linkul.)
  async emailDinLinkResetare(token) {
    const t = await this.tokenuri.verifica(token, 'resetare_parola');
    return t ? t.utilizator.email : null;
  }

  // Parola noua din linkul de resetare. Intoarce:
  //   { erori }            - parola nu respecta regulile / nu se potrivesc (linkul ramane valabil);
  //   { linkInvalid: true } - linkul a expirat / a fost folosit;
  //   { utilizatorId }      - parola schimbata; TOATE sesiunile contului au fost inchise.
  async reseteazaParola(token, parolaNoua, confirmare) {
    const noua = String(parolaNoua || '');
    const erori = {};
    const reguli = verificaReguliParola(noua);
    if (reguli) erori.parola_noua = reguli;
    else if (noua !== String(confirmare || '')) erori.confirmare = 'Cele două parole nu se potrivesc.';
    if (Object.keys(erori).length > 0) {
      return (await this.emailDinLinkResetare(token)) ? { erori } : { linkInvalid: true };
    }
    const t = await this.tokenuri.foloseste(token, 'resetare_parola');
    if (!t) return { linkInvalid: true };
    await this.utilizatori.reseteazaParola(t.utilizator.id, await hashParola(noua));
    await this.utilizatori.inchideSesiunile(t.utilizator.id); // cine era conectat cu parola veche e scos afara
    await this.evenimente.publica(Evenimente.PAROLA_SCHIMBATA, { utilizator: { email: t.utilizator.email, prenume: t.utilizator.prenume }, cum: 'resetare', cand: new Date() });
    return { utilizatorId: t.utilizator.id };
  }
}

module.exports = Conturi;
