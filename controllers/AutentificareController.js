// Controller-ul pentru autentificare: formularul de login, conectarea si iesirea din cont.

// Pagina de start a fiecarui rol dupa conectare.
// Proprietarul ajunge direct la anunturile lui (pentru asta vine pe site); profilul ramane in meniu.
const PAGINA_ROL = { admin: '/admin', proprietar: '/proprietar/anunturi', chirias: '/cont' };

// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - la fiecare cerere, containerul o apeleaza
// cu serviciul de care are nevoie (primit prin parametru, nu creat aici) si primeste inapoi actiunile.
module.exports = function AutentificareController({ autentificare: autentificare }) {
  // Acceptam doar adrese din aplicatia noastra (ex. "/admin/anunturi"), nu catre alte site-uri.
  function adresaSigura(adresa) {
    return typeof adresa === 'string' && adresa.startsWith('/') && !adresa.startsWith('//') ? adresa : null;
  }

  // GET /autentificare - formularul
  function autentificareGet(req, res) {
    if (res.locals.utilizator) return res.redirect('/');
    res.render('autentificare', { email: '', eroare: null, sectiune: 'autentificare' });
  }

  // POST /autentificare - verificarea emailului si a parolei (regulile sunt in servicii/autentificare.js, comune cu API-ul)
  async function autentificarePost(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { u, eroare, cod, neconfirmat } = await autentificare.verificaConectarea(email, req.body.parola);
    if (eroare) return res.status(cod).render('autentificare', { email, eroare, neconfirmat, sectiune: 'autentificare' });

    // Sesiune noua dupa conectare, pastrand doar adresa dorita si mesajul de bun venit.
    const dupa = adresaSigura(req.session.dupaAutentificare);
    await autentificare.deschideSesiunea(req, u.id, { mesaj: `Bine ai venit, ${u.prenume}!`, tipMesaj: 'success' });
    res.redirect(dupa || PAGINA_ROL[u.rol.nume] || '/');
  }

  // POST /iesire - iesirea din cont (POST, nu link: un link s-ar putea apasa fara voie)
  function iesire(req, res) {
    req.session.destroy(() => {
      res.clearCookie('rentify.sid');
      res.redirect('/autentificare');
    });
  }

  return { autentificareGet, autentificarePost, iesire };
};
