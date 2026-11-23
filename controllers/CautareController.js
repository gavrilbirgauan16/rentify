// Cautarea rapida din antet (doar admin): un singur camp care cauta deodata in utilizatori,
// proprietati si anunturi. Arata primele rezultate din fiecare, cu link catre lista completa filtrata.
// Cautarea propriu-zisa e in serviciul cautareAdmin (primit prin injectie, laboratorul 10).
module.exports = function CautareController({ cautareAdmin }) {
  // GET /admin/cautare?q=...
  async function index(req, res) {
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    if (q.length < 2) return res.render('admin/cautare/index', { q, rezultate: null });

    const r = await cautareAdmin.cauta(q);
    const enc = encodeURIComponent(q);
    res.render('admin/cautare/index', {
      q,
      rezultate: {
        utilizatori: { ...r.utilizatori, toate: `/admin/utilizatori?q=${enc}` },
        proprietati: { ...r.proprietati, toate: `/admin/proprietati?q=${enc}` },
        anunturi: { ...r.anunturi, toate: `/admin/anunturi?q=${enc}` },
      },
    });
  }

  return { index };
};
