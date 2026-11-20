// Controller-ul "Abonamentul meu" (zona proprietarului): planul curent, limitele folosite, planurile,
// schimbarea planului (upgrade imediat cu credit, downgrade la final de perioada) cu plata SIMULATA.
// Regulile (si calculul banilor, mereu pe server) sunt in servicii/abonamentProprietar.js, comune cu API-ul;
// aici doar se arata rezultatul (pagina, mesaj flash, redirect).
const abonament = require('../../servicii/abonamentProprietar');
const AbonamentViewModel = require('../../models/AbonamentViewModel');
const D = require('../../servicii/date');
const { mesajFlash } = require('../../utils/http');

const PAGINA = '/proprietar/abonament';
const lei = AbonamentViewModel.lei;

// GET /proprietar/abonament - planul curent, limitele, schimbarea programata, planurile si istoricul
async function index(req, res) {
  const s = await abonament.situatie(req.idUtilizator);
  res.render('proprietar/abonament/index', {
    ...s,
    // "eticheta", nu "text": situatie() are deja un camp text ("1 / 1") care l-ar suprascrie.
    limite: [
      { eticheta: 'Proprietăți active', ...s.limite.proprietati },
      { eticheta: 'Anunțuri publicate (active + în așteptare)', ...s.limite.anunturi },
    ],
    afiseaza: D.afiseaza,
  });
}

// GET /proprietar/abonament/schimba?plan=2&perioada=lunar - pagina de confirmare (nu schimba nimic)
async function schimbaGet(req, res) {
  const s = await abonament.pregatesteSchimbarea(req.idUtilizator, req.query.plan, req.query.perioada);
  if (s.eroare) {
    mesajFlash(req, s.eroare, 'warning');
    return res.redirect(PAGINA);
  }
  res.render('proprietar/abonament/confirmare', { ...s, lei, afiseaza: D.afiseaza });
}

// POST /proprietar/abonament/schimba - executa schimbarea; totul se RECALCULEAZA in serviciu, din baza de date
async function schimbaPost(req, res) {
  const r = await abonament.executaSchimbarea(req.idUtilizator, req.body.plan, req.body.perioada);
  if (r.eroare) mesajFlash(req, r.eroare, 'warning');
  else if (r.conflict) mesajFlash(req, 'Abonamentul tău s-a schimbat între timp. Verifică situația și încearcă din nou.', 'warning');
  else mesajFlash(req, r.mesaj);
  res.redirect(PAGINA); // Post/Redirect/Get: un refresh nu mai plateste a doua oara
}

// POST /proprietar/abonament/anuleaza-programat - renunta la schimbarea programata (inca neinceputa)
async function anuleazaProgramatPost(req, res) {
  const anulate = await abonament.anuleazaProgramate(req.idUtilizator);
  mesajFlash(req, anulate > 0 ? 'Schimbarea programată a fost anulată. Planul actual continuă.' : 'Nu ai nicio schimbare programată.', anulate > 0 ? 'success' : 'warning');
  res.redirect(PAGINA);
}

module.exports = { index, schimbaGet, schimbaPost, anuleazaProgramatPost };
