// Controller-ul pentru jurnalul de administrare: cine ce a facut si cand, cu filtre si paginare.
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');
const { ACTIUNI, ENTITATI, ENTITATI_PLURAL, ADRESE } = require('../servicii/jurnal');
const F = require('../servicii/filtre');
const D = require('../servicii/date');

const jurnal = new JurnalAccessor();
const PE_PAGINA = 50;

const FILTRE = {
  q: { tip: 'text' },
  entitate: { tip: 'enum', valori: Object.keys(ENTITATI) },
  actiune: { tip: 'enum', valori: Object.keys(ACTIUNI) },
  admin: { tip: 'id' },
  de_la: { tip: 'data' },
  pana_la: { tip: 'data' },
};


function conditie(f) {
  const where = {};
  if (f.q) where.detalii = { contains: f.q, mode: 'insensitive' };
  if (f.entitate) where.entitate = f.entitate;
  if (f.actiune) where.actiune = f.actiune;
  if (f.admin) where.admin_id = f.admin;
  if (f.de_la || f.pana_la) {
    where.creat_la = {};
    // zilele sunt in ora Romaniei; "pana la 10 nov" = pana la sfarsitul zilei de 10 nov
    if (f.de_la) where.creat_la.gte = D.inceputZiRomania(f.de_la);
    if (f.pana_la) where.creat_la.lt = D.inceputZiRomania(D.adunaZile(f.pana_la, 1));
  }
  return where;
}

// GET /admin/jurnal
async function index(req, res) {
  const f = F.citesteFiltre(req.query, FILTRE);
  const where = conditie(f);
  const pag = F.paginare(await jurnal.numara(where), f.pagina, PE_PAGINA);
  const [randuri, admini] = await Promise.all([jurnal.cauta(where, pag), jurnal.getAdmini()]);
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

module.exports = { index };
