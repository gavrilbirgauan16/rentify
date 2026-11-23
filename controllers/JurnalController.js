// Controller-ul pentru jurnalul de administrare: cine ce a facut si cand, cu filtre si paginare.
// Datele vin din serviciul "jurnal" (primit prin injectie, laboratorul 10); aici doar filtrele din adresa si pagina.
const { ACTIUNI, ENTITATI, ENTITATI_PLURAL, ADRESE } = require('../servicii/jurnal');
const F = require('../servicii/filtre');

const PE_PAGINA = 50;

// Filtrele din adresa paginii (?entitate=anunt&de_la=2026-11-01).
const FILTRE = {
  q: { tip: 'text' },
  entitate: { tip: 'enum', valori: Object.keys(ENTITATI) },
  actiune: { tip: 'enum', valori: Object.keys(ACTIUNI) },
  admin: { tip: 'id' },
  de_la: { tip: 'data' },
  pana_la: { tip: 'data' },
};

module.exports = function JurnalController({ jurnal }) {
  // GET /admin/jurnal
  async function index(req, res) {
    const f = F.citesteFiltre(req.query, FILTRE);
    const { randuri, admini, pag } = await jurnal.lista(f, PE_PAGINA);
    res.render('admin/jurnal/index', {
      randuri,
      admini,
      ...F.pentruPagina('/admin/jurnal', f, FILTRE, pag),
      ACTIUNI,
      ENTITATI,
      ENTITATI_PLURAL,
      ADRESE,
    });
  }

  return { index };
};
