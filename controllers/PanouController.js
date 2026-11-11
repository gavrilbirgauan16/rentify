// Panoul de administrare (pagina /admin): cifrele importante si lista "De rezolvat",
// fiecare cu link direct catre lista deja filtrata.
const PanouAccessor = require('../src/NivelAccesDate/PanouAccessor');
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const { ACTIUNI, ENTITATI, ADRESE } = require('../servicii/jurnal');
const D = require('../servicii/date');

const panou = new PanouAccessor();
const abonamente = new AbonamentAccessor();
const utilizatori = new UtilizatorAccessor();
const jurnal = new JurnalAccessor();

// GET /admin
async function index(req, res) {
  const astazi = D.azi();
  const [n, oameni, neterminate, incasari, ultimele, clienti] = await Promise.all([
    panou.numaratori(),
    utilizatori.statistici(),
    abonamente.getNeterminate(astazi),
    abonamente.incasariDin(D.inceputLuna(astazi)),
    jurnal.ultimele(8),
    utilizatori.cauta({ stare: 'activ' }),
  ]);

  // Situatia fiecarui proprietar / chirias fata de abonamentul lui curent
  const curente = await abonamente.getCurente(clienti.map((u) => u.id), astazi);
  const peUtilizator = new Map(curente.map((a) => [a.utilizator_id, a]));
  const vm = clienti.map((u) => new UtilizatorViewModel(u, peUtilizator.get(u.id) ?? null));

  const deschise = neterminate.map(AbonamentViewModel.dinEntitate);
  const inCurs = deschise.filter((a) => a.esteInDesfasurare);
  const neplatite = deschise.filter((a) => a.stareCod() === 'neplatit');
  const expiraCurand = inCurs.filter((a) => a.expiraCurand);

  // "De rezolvat": doar ce are cel putin un caz, fiecare cu link catre lista filtrata
  const deRezolvat = [
    { numar: neplatite.length, text: 'abonamente neplătite', link: '/admin/abonamente?stare=neplatit', culoare: 'danger' },
    { numar: expiraCurand.length, text: 'abonamente expiră în 7 zile', link: '/admin/abonamente?expira=7', culoare: 'warning' },
    { numar: vm.filter((u) => u.situatieProprietati?.depaseste).length, text: 'proprietari peste limita planului', link: '/admin/utilizatori?situatie=peste_limita', culoare: 'danger' },
    { numar: vm.filter((u) => u.areAbonamente && !u.abonament).length, text: 'utilizatori fără abonament în curs', link: '/admin/utilizatori?situatie=fara_abonament', culoare: 'secondary' },
    { numar: n.anunturiCiorna, text: 'anunțuri în ciornă', link: '/admin/anunturi?stare=ciorna', culoare: 'info' },
    { numar: n.anunturiPeInactive, text: 'anunțuri pe proprietăți inactive', link: '/admin/anunturi?problema=proprietate_inactiva', culoare: 'danger' },
    { numar: vm.filter((u) => u.areParolaTemporara).length, text: 'parole temporare nefolosite', link: '/admin/utilizatori?situatie=parola_temporara', culoare: 'secondary' },
  ].filter((r) => r.numar > 0);

  res.render('admin/panou/index', {
    n,
    oameni,
    abonamenteInCurs: inCurs.length,
    neplatite: neplatite.slice(0, 5),
    expiraCurand: expiraCurand.slice(0, 5),
    deRezolvat,
    incasari: AbonamentViewModel.lei(incasari),
    lunaCurenta: new Date().toLocaleDateString('ro-RO', { month: 'long', timeZone: 'Europe/Bucharest' }),
    ultimele,
    ACTIUNI,
    ENTITATI,
    ADRESE,
  });
}

module.exports = { index };
