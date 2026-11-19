// Regulile contului unui utilizator conectat: schimbarea parolei si a emailului. Scrise O SINGURA DATA,
// folosite de paginile "Contul meu" (EJS) si de API (interfata React).
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const ContViewModel = require('../models/ContViewModel');
const { hashParola, verificaParola, verificaReguliParola } = require('./parole');
const tokenuri = require('./tokenuri');
const emailuri = require('./emailuri');
const { trimite } = require('./email');

const utilizatori = new UtilizatorAccessor();

// Cerem parola curenta la orice schimbare sensibila: cine gaseste calculatorul deschis tot nu poate schimba nimic.
const parolaCurentaCorecta = async (utilizatorId, parola) => verificaParola(String(parola || ''), await utilizatori.getParolaHash(utilizatorId));

// Schimbarea parolei. Intoarce { erori } sau {} daca s-a schimbat.
// Sesiunile (noua sesiune + inchiderea celorlalte) le face cine apeleaza, cu pastreazaDoarSesiuneaAsta.
async function schimbaParola(utilizatorId, curenta, noua, confirmare) {
  const parolaNoua = String(noua || '');
  const erori = {};
  if (!(await parolaCurentaCorecta(utilizatorId, curenta))) erori.parola_curenta = 'Parola curentă nu este corectă.';
  const eroareReguli = verificaReguliParola(parolaNoua);
  if (eroareReguli) erori.parola_noua = eroareReguli;
  else if (parolaNoua === String(curenta || '')) erori.parola_noua = 'Parola nouă trebuie să fie diferită de cea curentă.';
  if (!erori.parola_noua && parolaNoua !== String(confirmare || '')) erori.confirmare = 'Cele două parole nu se potrivesc.';
  if (Object.keys(erori).length > 0) return { erori };
  await utilizatori.seteazaParola(utilizatorId, await hashParola(parolaNoua));
  return {};
}

// Dupa schimbarea parolei: sesiune NOUA in acest browser si inchiderea tuturor celorlalte sesiuni ale contului
// (ex. de pe alt calculator, unde cineva poate stia parola veche). pastreaza = campuri de pus in sesiunea noua.
async function pastreazaDoarSesiuneaAsta(req, utilizatorId, pastreaza = {}) {
  await new Promise((gata, esec) => req.session.regenerate((e) => (e ? esec(e) : gata())));
  Object.assign(req.session, pastreaza, { utilizatorId });
  await utilizatori.inchideSesiunile(utilizatorId, req.sessionID);
  await new Promise((gata, esec) => req.session.save((e) => (e ? esec(e) : gata())));
}

// Cererea de schimbare a emailului: adresa se schimba abia dupa confirmarea linkului trimis pe adresa NOUA
// (asa stim ca e a lui si ca nu are greseli de scriere). u = { id, email } (utilizatorul conectat).
// Intoarce { email, erori } sau { email } daca linkul a fost trimis.
async function cereSchimbareaEmailului(u, emailBrut, parolaCurenta) {
  const email = ContViewModel.normalizeazaEmail(emailBrut);
  const erori = {};
  if (!(await parolaCurentaCorecta(u.id, parolaCurenta))) erori.parola_curenta = 'Parola curentă nu este corectă.';
  if (!ContViewModel.emailValid(email)) erori.email = 'Adresa de email nu este validă.';
  else if (email === u.email) erori.email = 'Aceasta este deja adresa contului tău.';
  else if (await utilizatori.emailFolosit(email, u.id)) erori.email = 'Adresa este folosită de alt cont.';
  if (Object.keys(erori).length > 0) return { email, erori };

  const profil = await utilizatori.getProfil(u.id);
  const token = await tokenuri.creeaza(u.id, 'schimbare_email', email);
  const e = emailuri.schimbareEmail(profil, token);
  await trimite({ catre: email, subiect: e.subiect, text: e.text, html: e.html });
  return { email };
}

// Confirmarea noului email din link (merge si fara sa fii conectat). Adresa veche primeste un anunt:
// daca nu el a facut schimbarea, afla imediat. Intoarce { eroare } sau { emailNou }.
async function confirmaSchimbareaEmailului(token) {
  const t = await tokenuri.foloseste(token, 'schimbare_email');
  if (!t) return { eroare: 'Linkul a expirat, a fost deja folosit sau ai cerut între timp altă schimbare. Cere un link nou din contul tău.' };
  const folosita = 'Între timp, adresa a fost folosită pentru alt cont.';
  if (await utilizatori.emailFolosit(t.email_nou, t.utilizator.id)) return { eroare: folosita };
  try {
    await utilizatori.schimbaEmail(t.utilizator.id, t.email_nou);
  } catch (eroare) {
    if (eroare.code === 'P2002') return { eroare: folosita }; // doua conturi au confirmat aceeasi adresa in acelasi timp
    throw eroare;
  }
  const e = emailuri.emailSchimbat(t.utilizator, t.email_nou);
  await trimite({ catre: t.utilizator.email, subiect: e.subiect, text: e.text, html: e.html });
  return { emailNou: t.email_nou };
}

module.exports = { schimbaParola, pastreazaDoarSesiuneaAsta, cereSchimbareaEmailului, confirmaSchimbareaEmailului };
