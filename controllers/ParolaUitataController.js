// Controller-ul pentru "Am uitat parola": cererea linkului pe email si alegerea parolei noi din link.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const ContViewModel = require('../models/ContViewModel');
const { hashParola, verificaReguliParola } = require('../servicii/parole');
const tokenuri = require('../servicii/tokenuri');
const emailuri = require('../servicii/emailuri');
const { trimite } = require('../servicii/email');
const { mesajFlash } = require('../utils/http');

const utilizatori = new UtilizatorAccessor();

// Trimite linkul de resetare (folosit si de admin, din pagina utilizatorului).
async function trimiteLinkResetare(u) {
  const token = await tokenuri.creeaza(u.id, 'resetare_parola');
  const e = emailuri.resetareParola(u, token);
  return trimite({ catre: u.email, subiect: e.subiect, text: e.text, html: e.html });
}

const linkInvalid = (res) => res.status(400).render('cont/link-invalid', {
  titlu: 'Linkul de resetare nu mai este valabil',
  mesaj: 'Linkul a expirat (e valabil o oră), a fost deja folosit sau ai cerut între timp unul nou. Cere un link nou și folosește-l pe cel mai recent primit.',
  actiune: { href: '/parola-uitata', text: 'Cere un link nou' },
  sectiune: 'autentificare',
});

// GET /parola-uitata
function cerereGet(req, res) {
  res.render('cont/parola-uitata', { email: '', trimis: false, sectiune: 'autentificare' });
}

// POST /parola-uitata - acelasi mesaj daca adresa exista sau nu (nu se afla cine are cont)
async function cererePost(req, res) {
  const email = ContViewModel.normalizeazaEmail(req.body.email);
  const u = ContViewModel.emailValid(email) ? await utilizatori.getByEmail(email) : null;
  if (u && u.stare === 'activ') await trimiteLinkResetare(u);
  res.render('cont/parola-uitata', { email, trimis: true, sectiune: 'autentificare' });
}

// Pagina cu tokenul in adresa nu se pastreaza in cache si nu trimite adresa altor site-uri.
const faraCache = (res) => res.set('Cache-Control', 'no-store');

// GET /resetare/:token - formularul (tokenul doar se verifica, nu se consuma)
async function resetareGet(req, res) {
  faraCache(res);
  const t = await tokenuri.verifica(req.params.token, 'resetare_parola');
  if (!t) return linkInvalid(res);
  res.render('cont/resetare', { token: req.params.token, email: t.utilizator.email, erori: {}, sectiune: 'autentificare' });
}

// POST /resetare/:token
async function resetarePost(req, res) {
  faraCache(res);
  const noua = String(req.body.parola_noua || '');
  const erori = {};
  const reguli = verificaReguliParola(noua);
  if (reguli) erori.parola_noua = reguli;
  else if (noua !== String(req.body.confirmare || '')) erori.confirmare = 'Cele două parole nu se potrivesc.';
  if (Object.keys(erori).length > 0) {
    const t = await tokenuri.verifica(req.params.token, 'resetare_parola');
    if (!t) return linkInvalid(res);
    return res.status(400).render('cont/resetare', { token: req.params.token, email: t.utilizator.email, erori, sectiune: 'autentificare' });
  }

  const t = await tokenuri.foloseste(req.params.token, 'resetare_parola');
  if (!t) return linkInvalid(res);
  await utilizatori.reseteazaParola(t.utilizator.id, await hashParola(noua));
  await utilizatori.inchideSesiunile(t.utilizator.id); // cine era conectat cu parola veche e scos afara

  // Daca era conectat in browserul asta, il scoatem si de aici (sesiunea a fost stearsa).
  if (req.session.utilizatorId === t.utilizator.id) delete req.session.utilizatorId;
  mesajFlash(req, 'Parola a fost schimbată. Conectează-te cu parola nouă.');
  res.redirect('/autentificare');
}

module.exports = { cerereGet, cererePost, resetareGet, resetarePost, trimiteLinkResetare };
