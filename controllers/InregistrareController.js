// Controller-ul pentru conturile noi: inregistrarea, confirmarea emailului si retrimiterea linkului.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const PlanAccessor = require('../src/NivelAccesDate/PlanAccessor');
const ContViewModel = require('../models/ContViewModel');
const { hashParola } = require('../servicii/parole');
const tokenuri = require('../servicii/tokenuri');
const emailuri = require('../servicii/emailuri');
const { trimite } = require('../servicii/email');
const { azi, sfarsitPerioada, catreDate } = require('../servicii/date');
const { mesajFlash } = require('../utils/http');

const utilizatori = new UtilizatorAccessor();
const planuri = new PlanAccessor();

// Trimite linkul de confirmare (unul nou; cel vechi nu mai merge).
async function trimiteConfirmarea(u) {
  const token = await tokenuri.creeaza(u.id, 'confirmare_email');
  const e = emailuri.confirmareCont(u, token);
  await trimite({ catre: u.email, subiect: e.subiect, text: e.text, html: e.html });
}

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
  // Diferenta e doar in emailul primit de proprietarul adresei.
  const existent = await utilizatori.getByEmail(model.email);
  if (existent) {
    if (!existent.email_verificat && existent.stare === 'activ') await trimiteConfirmarea(existent);
    else if (existent.stare === 'activ') {
      const e = emailuri.contExistent(existent);
      await trimite({ catre: existent.email, subiect: e.subiect, text: e.text, html: e.html });
    }
  } else {
    try {
      const u = await utilizatori.creeazaCont(model.rol, { ...model.catreDate(), email: model.email }, await hashParola(model.parola));
      await trimiteConfirmarea(u);
    } catch (eroare) {
      if (eroare.code !== 'P2002') throw eroare; // P2002: s-a creat chiar acum un cont cu aceeasi adresa (doua trimiteri simultane)
    }
  }

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
  const t = await tokenuri.foloseste(req.params.token, 'confirmare_email');
  if (!t) {
    return res.status(400).render('cont/link-invalid', {
      titlu: 'Linkul de confirmare nu mai este valabil',
      mesaj: 'Linkul a expirat, a fost deja folosit sau ai cerut între timp unul nou. Poți primi un link nou mai jos. Dacă ți-ai confirmat deja contul, te poți conecta direct.',
      actiune: { href: '/confirmare/retrimite', text: 'Trimite-mi un link nou' },
      sectiune: 'autentificare',
    });
  }

  // Chiriasul primeste automat planul gratuit (proprietarul isi alege planul din contul lui).
  let abonament = null;
  if (t.utilizator.rol.nume === 'chirias') {
    const plan = await planuri.getGratuitChirias();
    if (plan) {
      const inceput = azi();
      abonament = {
        plan_id: plan.id, perioada: 'anual', pret: 0, reinnoire_automata: true, stare: 'activ',
        data_inceput: catreDate(inceput), data_sfarsit: catreDate(sfarsitPerioada(inceput, 'anual')),
      };
    } else console.error('Nu exista un plan gratuit activ pentru chiriasi: contul a fost confirmat fara abonament.');
  }
  await utilizatori.confirmaEmail(t.utilizator.id, abonament);

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
  const email = ContViewModel.normalizeazaEmail(req.body.email);
  const u = ContViewModel.emailValid(email) ? await utilizatori.getByEmail(email) : null;
  if (u && !u.email_verificat && u.stare === 'activ') await trimiteConfirmarea(u);
  res.render('cont/retrimite', { email, trimis: true, sectiune: 'autentificare' });
}

module.exports = { inregistrareGet, inregistrarePost, trimis, confirmare, retrimiteGet, retrimitePost, trimiteConfirmarea };
