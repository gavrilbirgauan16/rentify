// Controller-ul pentru conturile noi: inregistrarea, confirmarea emailului si retrimiterea linkului.
// Regulile sunt in servicii/conturi.js (comune cu API-ul); aici doar paginile.
const ContViewModel = require('../models/ContViewModel');
const conturi = require('../servicii/conturi');
const { mesajFlash } = require('../utils/http');

const afiseazaFormular = (res, model, erori = {}, status = 200) =>
  res.status(status).render('cont/inregistrare', { model, erori, sectiune: 'inregistrare' });

// GET /inregistrare (optional ?rol=proprietar)
function inregistrareGet(req, res) {
  if (res.locals.utilizator) return res.redirect('/');
  afiseazaFormular(res, new ContViewModel({ rol: req.query.rol === 'proprietar' ? 'proprietar' : 'chirias' }));
}

// POST /inregistrare
async function inregistrarePost(req, res) {
  if (res.locals.utilizator) return res.redirect('/');
  const model = ContViewModel.dinInregistrare(req.body);
  const erori = model.valideazaInregistrare();
  if (Object.keys(erori).length > 0) {
    model.parola = ''; model.confirmare = ''; // parolele nu se trimit inapoi in pagina
    return afiseazaFormular(res, model, erori, 400);
  }

  // Pagina arata ACELASI mesaj daca adresa e noua sau deja folosita (nu se poate afla cine are cont).
  await conturi.inregistreaza(model);
  req.session.emailTrimis = model.email;
  res.redirect('/inregistrare/trimis');
}

// GET /inregistrare/trimis - "Verifica-ti emailul"
function trimis(req, res) {
  const email = req.session.emailTrimis;
  if (!email) return res.redirect('/inregistrare');
  res.render('cont/verifica-email', { email, sectiune: 'inregistrare' });
}

// GET /confirmare/:token - linkul din email
async function confirmare(req, res) {
  if (!(await conturi.confirmaEmailul(req.params.token))) {
    return res.status(400).render('cont/link-invalid', {
      titlu: 'Linkul de confirmare nu mai este valabil',
      mesaj: 'Linkul a expirat, a fost deja folosit sau ai cerut între timp unul nou. Poți primi un link nou mai jos. Dacă ți-ai confirmat deja contul, te poți conecta direct.',
      actiune: { href: '/confirmare/retrimite', text: 'Trimite-mi un link nou' },
      sectiune: 'autentificare',
    });
  }
  delete req.session.emailTrimis;
  mesajFlash(req, 'Adresa de email a fost confirmată. Acum te poți conecta.');
  res.redirect(res.locals.utilizator ? '/' : '/autentificare');
}

// GET /confirmare/retrimite
function retrimiteGet(req, res) {
  res.render('cont/retrimite', { email: req.session.emailTrimis || '', trimis: false, sectiune: 'autentificare' });
}

// POST /confirmare/retrimite - mesaj identic oricare ar fi adresa (nu se afla cine are cont)
async function retrimitePost(req, res) {
  const email = await conturi.retrimiteConfirmarea(req.body.email);
  res.render('cont/retrimite', { email, trimis: true, sectiune: 'autentificare' });
}

module.exports = { inregistrareGet, inregistrarePost, trimis, confirmare, retrimiteGet, retrimitePost };
