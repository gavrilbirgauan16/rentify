// Mici ajutoare folosite de mai multe controllere (scrise o singura data, nu copiate).

// Transforma id-ul din adresa in numar; intoarce null daca nu e un id valid (ex. /admin/anunturi/abc).
function citesteId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Pagina 404 "nu exista", cu titlul si mesajul potrivite.
function negasit(res, titlu, mesaj) {
  return res.status(404).render('eroare', { titlu, mesaj_eroare: mesaj });
}

// Pune un mesaj care apare o singura data pe pagina urmatoare (verde implicit, galben cu 'warning').
function mesajFlash(req, text, tip = 'success') {
  req.session.mesaj = text;
  req.session.tipMesaj = tip;
}

module.exports = { citesteId, negasit, mesajFlash };