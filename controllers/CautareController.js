// Cautarea rapida din antet (doar admin): un singur camp care cauta deodata in utilizatori,
// proprietati si anunturi. Arata primele rezultate din fiecare, cu link catre lista completa filtrata.
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const AnuntAccessor = require('../src/NivelAccesDate/AnuntAccessor');
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const ProprietateViewModel = require('../models/ProprietateViewModel');
const AnuntViewModel = require('../models/AnuntViewModel');
const F = require('../servicii/filtre');

const utilizatori = new UtilizatorAccessor();
const proprietati = new ProprietateAccessor();
const anunturi = new AnuntAccessor();

const PRIMELE = { skip: 0, take: 5 };

// GET /admin/cautare?q=...
async function index(req, res) {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  if (q.length < 2) return res.render('admin/cautare/index', { q, rezultate: null });

  // Daca e un numar, cautam si dupa id (ex. "#12" sau "12" din jurnal).
  const id = Number(q.replace(/^#/, ''));
  const dupaId = Number.isInteger(id) && id > 0 ? [{ id }] : [];

  const whereProprietati = { OR: [...dupaId, ...F.contineText(['denumire', 'oras', 'zona', 'adresa'], q)] };
  const whereAnunturi = { OR: [...dupaId, ...F.contineText(['titlu', 'descriere', 'proprietate.denumire'], q)] };
  const [oameni, listaProprietati, nrProprietati, listaAnunturi, nrAnunturi] = await Promise.all([
    utilizatori.cauta({ cautare: q }),
    proprietati.getPagina(whereProprietati, [{ denumire: 'asc' }], PRIMELE),
    proprietati.numara(whereProprietati),
    anunturi.getPagina(whereAnunturi, [{ creat_la: 'desc' }], PRIMELE),
    anunturi.numara(whereAnunturi),
  ]);

  const enc = encodeURIComponent(q);
  res.render('admin/cautare/index', {
    q,
    rezultate: {
      utilizatori: { lista: oameni.slice(0, 5).map((u) => new UtilizatorViewModel(u)), total: oameni.length, toate: `/admin/utilizatori?q=${enc}` },
      proprietati: { lista: listaProprietati.map(ProprietateViewModel.dinEntitate), total: nrProprietati, toate: `/admin/proprietati?q=${enc}` },
      anunturi: { lista: listaAnunturi.map((a) => AnuntViewModel.dinEntitate(a)), total: nrAnunturi, toate: `/admin/anunturi?q=${enc}` },
    },
  });
}

module.exports = { index };
