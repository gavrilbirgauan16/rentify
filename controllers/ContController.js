// Controller-ul pentru contul utilizatorului conectat (orice rol): profilul, schimbarea parolei si a emailului.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const ContViewModel = require('../models/ContViewModel');
const { hashParola, verificaParola, verificaReguliParola } = require('../servicii/parole');
const tokenuri = require('../servicii/tokenuri');
const emailuri = require('../servicii/emailuri');
const { trimite } = require('../servicii/email');
const { mesajFlash } = require('../utils/http');

const utilizatori = new UtilizatorAccessor();

const afiseaza = (res, erori = {}, status = 200) =>
  res.status(status).render('cont/parola', { erori, obligatoriu: res.locals.utilizator.schimbaParola, sectiune: 'cont' });

// GET /cont/parola
function parolaGet(req, res) {
  afiseaza(res);
}

// POST /cont/parola
async function parolaPost(req, res) {
  const u = res.locals.utilizator;
  const curenta = String(req.body.parola_curenta || '');
  const noua = String(req.body.parola_noua || '');
  const confirmare = String(req.body.confirmare || '');

  // Cerem parola curenta: daca cineva gaseste calculatorul deschis, tot nu poate schimba parola.
  const erori = {};
  if (!(await verificaParola(curenta, await utilizatori.getParolaHash(u.id)))) erori.parola_curenta = 'Parola curentă nu este corectă.';
  const eroareReguli = verificaReguliParola(noua);
  if (eroareReguli) erori.parola_noua = eroareReguli;
  else if (noua === curenta) erori.parola_noua = 'Parola nouă trebuie să fie diferită de cea curentă.';
  if (!erori.parola_noua && noua !== confirmare) erori.confirmare = 'Cele două parole nu se potrivesc.';
  if (Object.keys(erori).length > 0) return afiseaza(res, erori, 400);

  await utilizatori.seteazaParola(u.id, await hashParola(noua));

  // Sesiune noua si inchiderea celorlalte sesiuni ale contului (ex. de pe alt calculator).
  await new Promise((gata, esec) => req.session.regenerate((e) => (e ? esec(e) : gata())));
  req.session.utilizatorId = u.id;
  await utilizatori.inchideSesiunile(u.id, req.sessionID);
  mesajFlash(req, 'Parola a fost schimbată. Ai fost deconectat de pe celelalte dispozitive.');
  await new Promise((gata, esec) => req.session.save((e) => (e ? esec(e) : gata())));
  res.redirect('/');
}

// ---- Profilul ----

const afiseazaProfil = (res, profil, model, erori = {}, status = 200) =>
  res.status(status).render('cont/profil', { profil, model, erori, sectiune: 'cont' });

// GET /cont
async function profilGet(req, res) {
  const profil = await utilizatori.getProfil(res.locals.utilizator.id);
  afiseazaProfil(res, profil, ContViewModel.dinEntitate(profil));
}

// POST /cont - nume, prenume, telefon, oras
async function profilPost(req, res) {
  const u = res.locals.utilizator;
  const model = ContViewModel.dinProfil(req.body, u.rol);
  const erori = model.valideazaDate();
  if (Object.keys(erori).length > 0) return afiseazaProfil(res, await utilizatori.getProfil(u.id), model, erori, 400);
  await utilizatori.actualizeazaProfil(u.id, model.catreDate());
  mesajFlash(req, 'Datele contului au fost salvate.');
  res.redirect('/cont');
}

// ---- Schimbarea emailului (cu confirmare pe adresa noua) ----

const afiseazaEmail = (res, email = '', erori = {}, status = 200) =>
  res.status(status).render('cont/email', { email, erori, sectiune: 'cont' });

// GET /cont/email
function emailGet(req, res) {
  afiseazaEmail(res);
}

// POST /cont/email
async function emailPost(req, res) {
  const u = res.locals.utilizator;
  const email = ContViewModel.normalizeazaEmail(req.body.email);
  const erori = {};
  if (!(await verificaParola(String(req.body.parola_curenta || ''), await utilizatori.getParolaHash(u.id)))) erori.parola_curenta = 'Parola curentă nu este corectă.';
  if (!ContViewModel.emailValid(email)) erori.email = 'Adresa de email nu este validă.';
  else if (email === u.email) erori.email = 'Aceasta este deja adresa contului tău.';
  else if (await utilizatori.emailFolosit(email, u.id)) erori.email = 'Adresa este folosită de alt cont.';
  if (Object.keys(erori).length > 0) return afiseazaEmail(res, email, erori, 400);

  // Adresa se schimba abia dupa ce o confirma (asa stim ca e a lui si ca nu are greseli de scriere).
  const profil = await utilizatori.getProfil(u.id);
  const token = await tokenuri.creeaza(u.id, 'schimbare_email', email);
  const e = emailuri.schimbareEmail(profil, token);
  await trimite({ catre: email, subiect: e.subiect, text: e.text, html: e.html });
  mesajFlash(req, `Ți-am trimis un link de confirmare pe ${email}. Adresa se schimbă după ce apeși pe el.`);
  res.redirect('/cont');
}

// GET /cont/email/confirmare/:token - linkul din email (merge si fara sa fii conectat)
async function emailConfirmare(req, res) {
  const t = await tokenuri.foloseste(req.params.token, 'schimbare_email');
  const invalid = (mesaj) => res.status(400).render('cont/link-invalid', {
    titlu: 'Adresa de email nu a fost schimbată', mesaj, actiune: { href: '/cont/email', text: 'Încearcă din nou' }, sectiune: 'cont',
  });
  if (!t) return invalid('Linkul a expirat, a fost deja folosit sau ai cerut între timp altă schimbare. Cere un link nou din contul tău.');
  if (await utilizatori.emailFolosit(t.email_nou, t.utilizator.id)) return invalid('Între timp, adresa a fost folosită pentru alt cont.');

  try {
    await utilizatori.schimbaEmail(t.utilizator.id, t.email_nou);
  } catch (eroare) {
    if (eroare.code === 'P2002') return invalid('Între timp, adresa a fost folosită pentru alt cont.');
    throw eroare;
  }
  // Anuntam si adresa veche: daca nu el a facut schimbarea, afla imediat.
  const e = emailuri.emailSchimbat(t.utilizator, t.email_nou);
  await trimite({ catre: t.utilizator.email, subiect: e.subiect, text: e.text, html: e.html });

  mesajFlash(req, `Adresa de email a fost schimbată în ${t.email_nou}.`);
  res.redirect(res.locals.utilizator ? '/cont' : '/autentificare');
}

module.exports = { parolaGet, parolaPost, profilGet, profilPost, emailGet, emailPost, emailConfirmare };
