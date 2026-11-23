// Panoul de administrare (pagina /admin): cifrele importante si lista "De rezolvat",
// fiecare cu link direct catre lista deja filtrata. Calculul e in serviciul panouAdmin (primit prin injectie).
const { ACTIUNI, ENTITATI, ADRESE } = require('../servicii/jurnal');

module.exports = function PanouController({ panouAdmin }) {
  // GET /admin
  async function index(req, res) {
    res.render('admin/panou/index', {
      ...(await panouAdmin.situatie()),
      lunaCurenta: new Date().toLocaleDateString('ro-RO', { month: 'long', timeZone: 'Europe/Bucharest' }),
      ACTIUNI,
      ENTITATI,
      ADRESE,
    });
  }

  return { index };
};
