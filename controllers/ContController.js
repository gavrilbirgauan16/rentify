// Controller-ul pentru contul utilizatorului conectat (orice rol): profilul, schimbarea parolei si a emailului.
// Regulile pentru parola si email sunt in servicii/cont.js (comune cu API-ul); aici doar paginile.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const ContViewModel = require('../models/ContViewModel');
const cont = require('../servicii/cont');
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
  const { erori } = await cont.schimbaParola(u.id, req.body.parola_curenta, req.body.parola_noua, req.body.confirmare);
  if (erori) return afiseaza(res, erori, 400);
  // Sesiune noua aici si inchiderea celorlalte sesiuni ale contului (ex. de pe alt calculator).
  await cont.pastreazaDoarSesiuneaAsta(req, u.id, {
    mesaj: 'Parola a fost schimbată. Ai fost deconectat de pe celelalte dispozitive.', tipMesaj: 'success',
  });
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
  const { email, erori } = await cont.cereSchimbareaEmailului(res.locals.utilizator, req.body.email, req.body.parola_curenta);
  if (erori) return afiseazaEmail(res, email, erori, 400);
  mesajFlash(req, `Ți-am trimis un link de confirmare pe ${email}. Adresa se schimbă după ce apeși pe el.`);
  res.redirect('/cont');
}

// GET /cont/email/confirmare/:token - linkul din email (merge si fara sa fii conectat)
async function emailConfirmare(req, res) {
  const { eroare, emailNou } = await cont.confirmaSchimbareaEmailului(req.params.token);
  if (eroare) {
    return res.status(400).render('cont/link-invalid', {
      titlu: 'Adresa de email nu a fost schimbată', mesaj: eroare, actiune: { href: '/cont/email', text: 'Încearcă din nou' }, sectiune: 'cont',
    });
  }
  mesajFlash(req, `Adresa de email a fost schimbată în ${emailNou}.`);
  res.redirect(res.locals.utilizator ? '/cont' : '/autentificare');
}

module.exports = { parolaGet, parolaPost, profilGet, profilPost, emailGet, emailPost, emailConfirmare };
