// Cautarea rapida din antetul adminului: un singur camp care cauta deodata in utilizatori, proprietati si anunturi.
// Mutata aici din CautareController (laboratorul 10). Dependintele (accesorii) vin prin constructor.
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const ProprietateViewModel = require('../models/ProprietateViewModel');
const AnuntViewModel = require('../models/AnuntViewModel');
const F = require('./filtre');

const PRIMELE = { skip: 0, take: 5 };

class CautareAdmin {
  constructor({ utilizatorAccessor, proprietateAccessor, anuntAccessor }) {
    this.utilizatori = utilizatorAccessor;
    this.proprietati = proprietateAccessor;
    this.anunturi = anuntAccessor;
  }

  // Primele 5 rezultate din fiecare categorie + cate sunt in total. q = textul cautat (cel putin 2 caractere).
  async cauta(q) {
    // Daca e un numar, cautam si dupa id (ex. "#12" sau "12" din jurnal).
    const id = Number(q.replace(/^#/, ''));
    const dupaId = Number.isInteger(id) && id > 0 ? [{ id }] : [];

    const whereProprietati = { OR: [...dupaId, ...F.contineText(['denumire', 'oras', 'zona', 'adresa'], q)] };
    const whereAnunturi = { OR: [...dupaId, ...F.contineText(['titlu', 'descriere', 'proprietate.denumire'], q)] };
    const [oameni, listaProprietati, nrProprietati, listaAnunturi, nrAnunturi] = await Promise.all([
      this.utilizatori.cauta({ cautare: q }),
      this.proprietati.getPagina(whereProprietati, [{ denumire: 'asc' }], PRIMELE),
      this.proprietati.numara(whereProprietati),
      this.anunturi.getPagina(whereAnunturi, [{ creat_la: 'desc' }], PRIMELE),
      this.anunturi.numara(whereAnunturi),
    ]);
    return {
      utilizatori: { lista: oameni.slice(0, 5).map((u) => new UtilizatorViewModel(u)), total: oameni.length },
      proprietati: { lista: listaProprietati.map(ProprietateViewModel.dinEntitate), total: nrProprietati },
      anunturi: { lista: listaAnunturi.map((a) => AnuntViewModel.dinEntitate(a)), total: nrAnunturi },
    };
  }
}

module.exports = CautareAdmin;
