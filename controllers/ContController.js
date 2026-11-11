// Controller-ul pentru contul utilizatorului conectat (orice rol). Momentan: schimbarea parolei.
// Mai tarziu aici vin si profilul, datele de contact etc.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const { hashParola, verificaParola, verificaReguliParola } = require('../servicii/parole');
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

module.exports = { parolaGet, parolaPost };
