// Utilizatorii in zona adminului: lista cu filtre si "situatii de verificat", detalii, blocare / deblocare,
// resetarea parolei (parola temporara sau link pe email) si retrimiterea linkului de confirmare.
// Mutat aici din UtilizatoriController (laboratorul 10). Dependintele vin prin constructor, de la containerul DI.
// Regula de securitate, la fiecare actiune: adminul nu poate bloca / reseta un cont de administrator (nici pe al lui).
// Fiecare metoda intoarce un rezultat; controllerul decide cum il arata:
//   { negasit: true } | { interzis: true } | ... | rezultatul reusit.
const UtilizatorViewModel = require('../models/UtilizatorViewModel');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const { hashParola, genereazaParolaTemporara } = require('./parole');
const F = require('./filtre');
const { azi } = require('./date');

// Situatiile "de verificat" (filtrul din lista) si cum se recunoaste fiecare,
// din abonamentul curent si proprietati.
const SITUATII = {
  peste_limita: 'Proprietari peste limita planului',
  fara_abonament: 'Fără abonament în curs',
  neplatit: 'Abonament neplătit',
  parola_temporara: 'Parolă temporară nefolosită',
  email_neconfirmat: 'Email neconfirmat',
};
const SE_POTRIVESTE = {
  peste_limita: (u) => Boolean(u.situatieProprietati?.depaseste),
  fara_abonament: (u) => u.areAbonamente && !u.abonament,
  neplatit: (u) => u.abonament?.stareCod() === 'neplatit',
  parola_temporara: (u) => u.areParolaTemporara,
  email_neconfirmat: (u) => !u.emailConfirmat,
};
const SORTARI = {
  nume: [{ nume: 'asc' }, { prenume: 'asc' }],
  noi: [{ creat_la: 'desc' }, { id: 'desc' }],
  conectare: [{ ultima_autentificare: { sort: 'desc', nulls: 'last' } }, { nume: 'asc' }],
};

class UtilizatoriAdmin {
  constructor({ utilizatorAccessor, abonamentAccessor, jurnal, conturi }) {
    this.utilizatori = utilizatorAccessor;
    this.abonamente = abonamentAccessor;
    this.jurnal = jurnal;
    this.conturi = conturi;
  }

  // O pagina din lista filtrata. Situatiile depind de abonamentul curent, deci se filtreaza dupa ce aducem datele.
  async lista(f, pePagina) {
    const entitati = await this.utilizatori.cauta({ rol: f.rol, stare: f.stare, cautare: f.q }, SORTARI[f.sort]);
    // Abonamentele curente le aducem pe toate dintr-o singura interogare (nu cate una pentru fiecare utilizator).
    const curente = await this.abonamente.getCurente(entitati.map((u) => u.id), azi());
    const peUtilizator = new Map(curente.map((a) => [a.utilizator_id, a]));
    let lista = entitati.map((u) => new UtilizatorViewModel(u, peUtilizator.get(u.id) ?? null));
    if (f.situatie) lista = lista.filter(SE_POTRIVESTE[f.situatie]);
    const pag = F.paginareLista(lista, f.pagina, pePagina);
    return { randuri: pag.randuri, pag };
  }

  // Pagina unui utilizator: datele, abonamentele lui si istoricul din jurnal. null daca nu exista.
  async detalii(id) {
    const entitate = await this.utilizatori.getDetalii(id);
    if (!entitate) return null;
    const [toate, curente, istoric] = await Promise.all([
      this.abonamente.getByUtilizator(id),
      this.abonamente.getCurente([id], azi()),
      this.jurnal.pentru('utilizator', id, 10),
    ]);
    return {
      u: new UtilizatorViewModel(entitate, curente[0] ?? null),
      abonamente: toate.map(AbonamentViewModel.dinEntitate),
      istoric,
    };
  }

  // Utilizatorul pe care adminul are voie sa-l administreze: { negasit } | { interzis } | { u }.
  async #administrabil(id, admin) {
    const entitate = await this.utilizatori.getDetalii(id);
    if (!entitate) return { negasit: true };
    const u = new UtilizatorViewModel(entitate);
    if (!u.poateFiAdministratDe(admin.id)) return { interzis: true };
    return { u };
  }

  // stare = 'blocat' sau 'activ'. Un cont blocat e deconectat imediat (sesiunea se verifica la fiecare cerere).
  // Intoarce { negasit } | { interzis } | { u, schimbat }.
  async schimbaStare(id, stare, admin) {
    const r = await this.#administrabil(id, admin);
    if (!r.u) return r;
    if (r.u.stare === stare) return { u: r.u, schimbat: false };
    await this.utilizatori.schimbaStare(r.u.id, stare);
    await this.jurnal.noteaza(admin, stare === 'blocat' ? 'blocare' : 'deblocare', 'utilizator', r.u.id, r.u.numeComplet);
    return { u: r.u, schimbat: true };
  }

  // Parola temporara: utilizatorul e obligat s-o schimbe la prima conectare; toate sesiunile lui se inchid.
  // Parola o intoarcem DOAR ca s-o arate controllerul o singura data: NU se scrie in jurnal, flash sau sesiune.
  // Intoarce { negasit } | { interzis } | { u, parola }.
  async reseteazaParola(id, admin) {
    const r = await this.#administrabil(id, admin);
    if (!r.u) return r;
    const parola = genereazaParolaTemporara();
    await this.utilizatori.seteazaParola(r.u.id, await hashParola(parola), { temporara: true });
    await this.utilizatori.inchideSesiunile(r.u.id);
    await this.jurnal.noteaza(admin, 'resetare_parola', 'utilizator', r.u.id, r.u.numeComplet);
    return { u: r.u, parola };
  }

  // Varianta recomandata: link de resetare pe email (adminul nu afla nicio parola).
  // Intoarce { negasit } | { interzis } | { blocat, u } | { neplecat, u } | { u }.
  async trimiteLinkParola(id, admin) {
    const r = await this.#administrabil(id, admin);
    if (!r.u) return r;
    if (r.u.esteBlocat) return { blocat: true, u: r.u };
    if (!(await this.conturi.trimiteLinkResetare(r.u))) return { neplecat: true, u: r.u };
    await this.jurnal.noteaza(admin, 'link_resetare', 'utilizator', r.u.id, r.u.numeComplet);
    return { u: r.u };
  }

  // Pentru cine nu a gasit emailul de confirmare. Intoarce { negasit } | { interzis } | { dejaConfirmat, u } | { u }.
  async retrimiteConfirmare(id, admin) {
    const r = await this.#administrabil(id, admin);
    if (!r.u) return r;
    if (r.u.emailConfirmat) return { dejaConfirmat: true, u: r.u };
    await this.conturi.trimiteConfirmarea(r.u);
    await this.jurnal.noteaza(admin, 'link_confirmare', 'utilizator', r.u.id, r.u.numeComplet);
    return { u: r.u };
  }
}

module.exports = UtilizatoriAdmin;
module.exports.SITUATII = SITUATII;
module.exports.SORTARI = SORTARI;
