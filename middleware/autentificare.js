// Middleware-uri pentru autentificare si roluri.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const { mesajFlash } = require('../utils/http');

const utilizatori = new UtilizatorAccessor();

// La fiecare cerere: daca in sesiune e un utilizator, il incarcam din baza de date
// (asa vedem imediat daca intre timp a fost blocat) si il punem la dispozitia paginilor.
async function incarcaUtilizator(req, res, next) {
  res.locals.utilizator = null;
  const id = req.session.utilizatorId;
  if (!id) return next();

  const u = await utilizatori.getPentruSesiune(id);
  if (!u || u.stare === 'blocat') {
    delete req.session.utilizatorId; // contul nu mai exista sau a fost blocat: il deconectam
    return next();
  }
  // nume = numele complet pentru afisare; prenume / numeFamilie separat (ex. pentru API: "Ana Maria" + "Popescu").
  res.locals.utilizator = {
    id: u.id, nume: `${u.prenume} ${u.nume}`, prenume: u.prenume, numeFamilie: u.nume,
    email: u.email, rol: u.rol.nume, schimbaParola: u.schimba_parola,
  };
  next();
}

// Pagina cere un utilizator conectat; altfel trimitem la autentificare si tinem minte unde voia sa ajunga.
function cereAutentificare(req, res, next) {
  if (res.locals.utilizator) return next();
  if (req.method === 'GET') req.session.dupaAutentificare = req.originalUrl;
  mesajFlash(req, 'Conectează-te ca să continui.', 'warning');
  res.redirect('/autentificare');
}

// Pagina cere unul dintre rolurile date, ex. cereRol('admin').
function cereRol(...roluri) {
  return (req, res, next) => {
    if (roluri.includes(res.locals.utilizator.rol)) return next();
    res.status(403).render('eroare', { titlu: 'Nu ai acces', mesaj_eroare: 'Contul tău nu are drept să vadă această pagină.' });
  };
}

// Cine s-a conectat cu o parola temporara (data de admin la resetare) trebuie sa-si aleaga una noua
// inainte de orice altceva. Are voie doar pe pagina de schimbare a parolei si la iesire.
const PERMISE_CU_PAROLA_TEMPORARA = ['/cont/parola', '/iesire'];
function cereParolaNoua(req, res, next) {
  const u = res.locals.utilizator;
  if (!u || !u.schimbaParola || PERMISE_CU_PAROLA_TEMPORARA.includes(req.path)) return next();
  mesajFlash(req, 'Ai primit o parolă temporară. Alege-ți acum o parolă nouă.', 'warning');
  res.redirect('/cont/parola');
}

// ===== Variantele pentru API: raspund cu JSON (401 / 403), nu cu redirect, ca interfata React sa stie ce sa faca =====

// Cerere API care are nevoie de un cont conectat (si de o parola aleasa de el, nu una temporara de la admin).
function cereAutentificareApi(req, res, next) {
  const u = res.locals.utilizator;
  if (!u) return res.status(401).json({ eroare: 'Trebuie să fii conectat.' });
  if (u.schimbaParola) return res.status(403).json({ eroare: 'Ai primit o parolă temporară. Alege-ți întâi o parolă nouă.', schimba_parola: true });
  next();
}

// Cerere API pentru anumite roluri, ex. cereRolApi('chirias'). Se pune DUPA cereAutentificareApi.
function cereRolApi(...roluri) {
  return (req, res, next) => {
    if (roluri.includes(res.locals.utilizator.rol)) return next();
    res.status(403).json({ eroare: 'Contul tău nu are acces la această acțiune.' });
  };
}

module.exports = { incarcaUtilizator, cereAutentificare, cereRol, cereParolaNoua, cereAutentificareApi, cereRolApi };