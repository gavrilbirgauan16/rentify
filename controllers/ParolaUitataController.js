// Controller-ul pentru "Am uitat parola": cererea linkului pe email si alegerea parolei noi din link.
// Regulile sunt in servicii/conturi.js (comune cu API-ul); aici doar paginile.
const { mesajFlash } = require('../utils/http');

const linkInvalid = (res) => res.status(400).render('cont/link-invalid', {
  titlu: 'Linkul de resetare nu mai este valabil',
  mesaj: 'Linkul a expirat (e valabil o oră), a fost deja folosit sau ai cerut între timp unul nou. Cere un link nou și folosește-l pe cel mai recent primit.',
  actiune: { href: '/parola-uitata', text: 'Cere un link nou' },
  sectiune: 'autentificare',
});

// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - la fiecare cerere, containerul o apeleaza
// cu serviciul de care are nevoie (primit prin parametru, nu creat aici) si primeste inapoi actiunile.
module.exports = function ParolaUitataController({ conturi: conturi }) {
  // GET /parola-uitata
  function cerereGet(req, res) {
    res.render('cont/parola-uitata', { email: '', trimis: false, sectiune: 'autentificare' });
  }

  // POST /parola-uitata - acelasi mesaj daca adresa exista sau nu (nu se afla cine are cont)
  async function cererePost(req, res) {
    const email = await conturi.cereResetarea(req.body.email);
    res.render('cont/parola-uitata', { email, trimis: true, sectiune: 'autentificare' });
  }

  // Pagina cu tokenul in adresa nu se pastreaza in cache si nu trimite adresa altor site-uri.
  const faraCache = (res) => res.set('Cache-Control', 'no-store');

  // GET /resetare/:token - formularul (tokenul doar se verifica, nu se consuma)
  async function resetareGet(req, res) {
    faraCache(res);
    const email = await conturi.emailDinLinkResetare(req.params.token);
    if (!email) return linkInvalid(res);
    res.render('cont/resetare', { token: req.params.token, email, erori: {}, sectiune: 'autentificare' });
  }

  // POST /resetare/:token
  async function resetarePost(req, res) {
    faraCache(res);
    const r = await conturi.reseteazaParola(req.params.token, req.body.parola_noua, req.body.confirmare);
    if (r.linkInvalid) return linkInvalid(res);
    if (r.erori) {
      const email = await conturi.emailDinLinkResetare(req.params.token);
      return res.status(400).render('cont/resetare', { token: req.params.token, email, erori: r.erori, sectiune: 'autentificare' });
    }
    // Daca era conectat in browserul asta, il scoatem si de aici (sesiunile lui au fost sterse).
    if (req.session.utilizatorId === r.utilizatorId) delete req.session.utilizatorId;
    mesajFlash(req, 'Parola a fost schimbată. Conectează-te cu parola nouă.');
    res.redirect('/autentificare');
  }

  return { cerereGet, cererePost, resetareGet, resetarePost };
};
