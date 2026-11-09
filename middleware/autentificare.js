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
  res.locals.utilizator = { id: u.id, nume: `${u.prenume} ${u.nume}`, email: u.email, rol: u.rol.nume };
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

module.exports = { incarcaUtilizator, cereAutentificare, cereRol };