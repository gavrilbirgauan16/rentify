// Panoul de administrare (pagina /admin): cifrele importante si lista "De rezolvat".
// Mutat aici din PanouController (laboratorul 10): controllerul doar afiseaza ce calculeaza serviciul.
// Dependintele (accesorii, jurnalul) vin prin constructor, de la containerul DI.
const AbonamentViewModel = require('../models/AbonamentViewModel');
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const D = require('./date');

class PanouAdmin {
  constructor({ panouAccessor, abonamentAccessor, utilizatorAccessor, anuntAccessor, jurnal }) {
    this.panou = panouAccessor;
    this.abonamente = abonamentAccessor;
    this.utilizatori = utilizatorAccessor;
    this.anunturi = anuntAccessor;
    this.jurnal = jurnal;
  }

  // Tot ce arata panoul: cifrele, abonamentele de urmarit, ultimele actiuni si lista "De rezolvat".
  async situatie() {
    const astazi = D.azi();
    const [n, oameni, neterminate, incasari, ultimele, clienti] = await Promise.all([
      this.panou.numaratori(),
      this.utilizatori.statistici(),
      this.abonamente.getNeterminate(astazi),
      this.abonamente.incasariDin(D.inceputLuna(astazi)),
      this.jurnal.ultimele(8),
      this.utilizatori.cauta({ stare: 'activ' }),
    ]);

    // Situatia fiecarui proprietar / chirias fata de abonamentul lui curent
    const curente = await this.abonamente.getCurente(clienti.map((u) => u.id), astazi);
    const peUtilizator = new Map(curente.map((a) => [a.utilizator_id, a]));
    const vm = clienti.map((u) => new UtilizatorViewModel(u, peUtilizator.get(u.id) ?? null));

    const deschise = neterminate.map(AbonamentViewModel.dinEntitate);
    const inCurs = deschise.filter((a) => a.esteInDesfasurare);
    const neplatite = deschise.filter((a) => a.stareCod() === 'neplatit');
    const expiraCurand = inCurs.filter((a) => a.expiraCurand);

    // "De rezolvat": doar ce are cel putin un caz, fiecare cu link catre lista filtrata
    const deRezolvat = [
      { numar: n.anunturiInAsteptare, text: 'anunțuri de aprobat', link: '/admin/anunturi?stare=in_asteptare&sort=vechi', culoare: 'warning' },
      { numar: neplatite.length, text: 'abonamente neplătite', link: '/admin/abonamente?stare=neplatit', culoare: 'danger' },
      { numar: expiraCurand.length, text: 'abonamente expiră în 7 zile', link: '/admin/abonamente?expira=7', culoare: 'warning' },
      { numar: vm.filter((u) => u.situatieProprietati?.depaseste).length, text: 'proprietari peste limita planului', link: '/admin/utilizatori?situatie=peste_limita', culoare: 'danger' },
      { numar: vm.filter((u) => u.areAbonamente && !u.abonament).length, text: 'utilizatori fără abonament în curs', link: '/admin/utilizatori?situatie=fara_abonament', culoare: 'secondary' },
      { numar: n.anunturiPeInactive, text: 'anunțuri pe proprietăți inactive', link: '/admin/anunturi?problema=proprietate_inactiva', culoare: 'danger' },
      { numar: vm.filter((u) => u.areParolaTemporara).length, text: 'parole temporare nefolosite', link: '/admin/utilizatori?situatie=parola_temporara', culoare: 'secondary' },
    ].filter((r) => r.numar > 0);

    return {
      n,
      oameni,
      abonamenteInCurs: inCurs.length,
      neplatite: neplatite.slice(0, 5),
      expiraCurand: expiraCurand.slice(0, 5),
      deRezolvat,
      incasari: AbonamentViewModel.lei(incasari),
      ultimele,
    };
  }

  // Cate anunturi asteapta aprobarea (numarul de langa "Anunturi" din meniul adminului).
  deAprobat() {
    return this.anunturi.numaraInAsteptare();
  }
}

module.exports = PanouAdmin;
