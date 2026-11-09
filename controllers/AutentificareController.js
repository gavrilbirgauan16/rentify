// Controller-ul pentru autentificare: formularul de login, conectarea si iesirea din cont.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const { verificaParola } = require('../servicii/parole');
const { mesajFlash } = require('../utils/http');

const utilizatori = new UtilizatorAccessor();

// Pagina de start a fiecarui rol dupa conectare.
const PAGINA_ROL = { admin: '/admin/proprietati' };

// Acceptam doar adrese din aplicatia noastra (ex. "/admin/anunturi"), nu catre alte site-uri.
function adresaSigura(adresa) {
  return typeof adresa === 'string' && adresa.startsWith('/') && !adresa.startsWith('//') ? adresa : null;
}

// GET /autentificare - formularul
function autentificareGet(req, res) {
  if (res.locals.utilizator) return res.redirect('/');
  res.render('autentificare', { email: '', eroare: null, sectiune: 'autentificare' });
}

// POST /autentificare - verificarea emailului si a parolei
async function autentificarePost(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const parola = String(req.body.parola || '');
  const u = email && parola ? await utilizatori.getByEmail(email) : null;

  // Acelasi mesaj indiferent ce e gresit: nu spunem daca emailul exista in aplicatie.
  if (!u || !(await verificaParola(parola, u.parola_hash))) {
    return res.status(401).render('autentificare', { email, eroare: 'Email sau parolă greșită.', sectiune: 'autentificare' });
  }
  if (u.stare === 'blocat') {
    return res.status(403).render('autentificare', { email, eroare: 'Contul tău este blocat. Contactează administratorul.', sectiune: 'autentificare' });
  }

  // Sesiune noua dupa conectare (protectie impotriva furtului de sesiune), pastrand doar adresa dorita.
  const dupa = adresaSigura(req.session.dupaAutentificare);
  await new Promise((gata, esec) => req.session.regenerate((e) => (e ? esec(e) : gata())));
  req.session.utilizatorId = u.id;
  mesajFlash(req, `Bine ai venit, ${u.prenume}!`);
  await new Promise((gata, esec) => req.session.save((e) => (e ? esec(e) : gata())));
  await utilizatori.inregistreazaAutentificare(u.id);
  res.redirect(dupa || PAGINA_ROL[u.rol.nume] || '/');
}

// POST /iesire - iesirea din cont (POST, nu link: un link s-ar putea apasa fara voie)
function iesire(req, res) {
  req.session.destroy(() => {
    res.clearCookie('rentify.sid');
    res.redirect('/autentificare');
  });
}

module.exports = { autentificareGet, autentificarePost, iesire };