// Controller-ul "Proprietatile mele" (zona proprietarului): lista, adaugare, modificare, dezactivare / activare.
// Regulile (doar proprietatile lui, proprietarul din sesiune, limita din plan) sunt in servicii/proprietatiProprietar.js,
// comune cu API-ul; aici doar paginile si mesajele.
const ProprietateViewModel = require('../../models/ProprietateViewModel');
const { citesteId, negasit, mesajFlash } = require('../../utils/http');
const { STARI_FORMULAR } = require('../../servicii/proprietatiProprietar');

const LISTA = '/proprietar/proprietati';

const proprietateNegasita = (res) => negasit(res, 'Proprietatea nu există', 'Proprietatea căutată nu a fost găsită printre proprietățile tale.');

// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - la fiecare cerere, containerul o apeleaza
// cu serviciul de care are nevoie (primit prin parametru, nu creat aici) si primeste inapoi actiunile.
module.exports = function ProprietatiProprietarController({ proprietatiProprietar: serviciu }) {
  // Textul despre anunturi pentru mesajul verde, de ex. " 2 anunțuri ale ei au fost dezactivate."
  function textAnunturi(numar) {
    if (!numar) return '';
    return numar === 1 ? ' Un anunț al ei a fost dezactivat.' : ` ${numar} anunțuri ale ei au fost dezactivate.`;
  }

  // Datele pentru formular (Create si Edit au aceeasi pagina, doar titlul si adresa difera).
  // La o proprietate inactiva starea nu se poate schimba din formular (doar din butonul Activeaza).
  function afiseazaFormular(res, { p, erori = {}, status = 200 }) {
    const editare = Boolean(p.id);
    res.status(status).render('proprietar/proprietati/formular', {
      p,
      erori,
      titlu: editare ? 'Editează proprietatea' : 'Adaugă proprietate',
      actiune: editare ? `${LISTA}/${p.id}/edit` : `${LISTA}/create`,
      tipuri: ProprietateViewModel.TIPURI,
      stari: p.stare === 'inactiv' ? ['inactiv'] : STARI_FORMULAR,
      eticheteTip: ProprietateViewModel.ETICHETE_TIP,
      eticheteStare: ProprietateViewModel.ETICHETE_STARE,
    });
  }

  // GET /proprietar/proprietati - lista mea, cu cate proprietati mai permite planul
  async function index(req, res) {
    const { proprietati, limita, textLimita } = await serviciu.lista(req.idUtilizator);
    res.render('proprietar/proprietati/index', { proprietati: proprietati.map(ProprietateViewModel.dinEntitate), limita, textLimita });
  }

  // GET /proprietar/proprietati/create - formularul gol (doar daca planul mai permite)
  async function createGet(req, res) {
    const blocat = await serviciu.verificaLimita(req.idUtilizator);
    if (blocat) {
      mesajFlash(req, blocat, 'warning');
      return res.redirect(LISTA);
    }
    afiseazaFormular(res, { p: new ProprietateViewModel({ stare: 'liber' }) });
  }

  // POST /proprietar/proprietati/create
  async function createPost(req, res) {
    const r = await serviciu.adauga(req.idUtilizator, req.body);
    if (r.blocat) {
      mesajFlash(req, r.blocat, 'warning');
      return res.redirect(LISTA);
    }
    if (r.erori) return afiseazaFormular(res, { p: r.model, erori: r.erori, status: 400 });
    mesajFlash(req, `Proprietatea „${r.proprietate.denumire}” a fost adăugată.`);
    res.redirect(LISTA); // Post/Redirect/Get: refresh-ul nu mai trimite formularul a doua oara
  }

  // GET /proprietar/proprietati/:id/edit - formularul completat (doar pentru proprietatile mele)
  async function editGet(req, res) {
    const entitate = await serviciu.getALui(req.idUtilizator, citesteId(req));
    if (!entitate) return proprietateNegasita(res);
    afiseazaFormular(res, { p: ProprietateViewModel.dinEntitate(entitate) });
  }

  // POST /proprietar/proprietati/:id/edit
  async function editPost(req, res) {
    const r = await serviciu.modifica(req.idUtilizator, citesteId(req), req.body);
    if (r.negasita) return proprietateNegasita(res);
    if (r.erori) return afiseazaFormular(res, { p: r.model, erori: r.erori, status: 400 });
    mesajFlash(req, `Modificările la „${r.model.denumire}” au fost salvate.`);
    res.redirect(LISTA);
  }

  // POST /proprietar/proprietati/:id/dezactiveaza - o scoate din uz (si anunturile ei)
  async function dezactiveaza(req, res) {
    const r = await serviciu.dezactiveaza(req.idUtilizator, citesteId(req));
    if (r.negasita) return proprietateNegasita(res);
    if (r.schimbat) mesajFlash(req, `Proprietatea „${r.proprietate.denumire}” a fost dezactivată.` + textAnunturi(r.anunturiDezactivate));
    res.redirect(LISTA);
  }

  // POST /proprietar/proprietati/:id/activeaza - doar daca planul mai permite; anunturile ei raman inactive
  async function activeaza(req, res) {
    const r = await serviciu.activeaza(req.idUtilizator, citesteId(req));
    if (r.negasita) return proprietateNegasita(res);
    if (r.blocat) mesajFlash(req, r.blocat, 'warning');
    else if (r.schimbat) {
      mesajFlash(req, `Proprietatea „${r.proprietate.denumire}” a fost activată. Anunțurile ei au rămas inactive: le poți activa din „Anunțurile mele”.`);
    }
    res.redirect(LISTA);
  }

  return { index, createGet, createPost, editGet, editPost, dezactiveaza, activeaza };
};
