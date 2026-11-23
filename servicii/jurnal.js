// Jurnalul de administrare: tine minte CINE (ce admin) a facut CE, pe CARE inregistrare si CAND.
// E "best effort": daca scrierea in jurnal esueaza, actiunea adminului NU se anuleaza, doar notam eroarea in consola.
// Accesorul vine prin constructor, de la containerul DI (laboratorul 10).
const D = require('./date');
const F = require('./filtre');

// Cum se citeste fiecare actiune in pagini: "Ana a dezactivat anunțul #12".
const ACTIUNI = {
  creare: 'a adăugat',
  modificare: 'a modificat',
  activare: 'a activat',
  dezactivare: 'a dezactivat',
  anulare: 'a anulat',
  plata: 'a înregistrat o plată la',
  blocare: 'a blocat',
  deblocare: 'a deblocat',
  resetare_parola: 'a resetat parola pentru',
  link_resetare: 'a trimis un link de resetare a parolei către',
  link_confirmare: 'a retrimis linkul de confirmare către',
  aprobare: 'a aprobat',
  respingere: 'a respins',
  restaurare: 'a restaurat', // un anunt sters logic, readus (ca ciorna)
};
const ENTITATI = {
  proprietate: 'proprietatea', anunt: 'anunțul', plan: 'planul', abonament: 'abonamentul', utilizator: 'utilizatorul',
};
// Numele la plural, pentru filtrul din pagina jurnalului
const ENTITATI_PLURAL = { proprietate: 'Proprietăți', anunt: 'Anunțuri', plan: 'Planuri', abonament: 'Abonamente', utilizator: 'Utilizatori' };
// Adresa paginii fiecarei inregistrari (linkurile din jurnal)
const ADRESE = {
  proprietate: (id) => `/admin/proprietati/${id}`,
  anunt: (id) => `/admin/anunturi/${id}`,
  plan: (id) => `/admin/planuri/${id}/edit`,
  abonament: (id) => `/admin/abonamente/${id}`,
  utilizator: (id) => `/admin/utilizatori/${id}`,
};

// Filtrele alese in pagina jurnalului -> conditia pentru baza de date.
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

class Jurnal {
  constructor({ jurnalAccessor }) {
    this.jurnal = jurnalAccessor;
  }

  // Noteaza o actiune a adminului. admin = utilizatorul conectat ({ id, ... }); fara admin nu se noteaza nimic.
  //   jurnal.noteaza(admin, 'modificare', 'anunt', 12, 'Garsonieră centru')
  // Serviciul nu stie nimic de HTTP (cereri, raspunsuri): primeste direct adminul.
  async noteaza(admin, actiune, entitate, entitateId, detalii = null) {
    if (!admin) return;
    try {
      await this.jurnal.adauga({
        admin_id: admin.id,
        actiune,
        entitate,
        entitate_id: entitateId ?? null,
        detalii: detalii ? String(detalii).slice(0, 500) : null,
      });
    } catch (eroare) {
      console.error('Nu am putut scrie in jurnalul de administrare:', eroare.message);
    }
  }

  // O pagina din jurnal, dupa filtrele alese (f = filtrele citite din adresa). Intoarce { randuri, admini, pag }.
  async lista(f, pePagina) {
    const where = conditie(f);
    const pag = F.paginare(await this.jurnal.numara(where), f.pagina, pePagina);
    const [randuri, admini] = await Promise.all([this.jurnal.cauta(where, pag), this.jurnal.getAdmini()]);
    return { randuri, admini, pag };
  }

  // Ultimele actiuni (panoul de administrare).
  ultimele(cate) {
    return this.jurnal.ultimele(cate);
  }

  // Istoricul unei inregistrari (ex. pagina unei proprietati sau a unui utilizator).
  pentru(entitate, entitateId, cate) {
    return this.jurnal.getPentru(entitate, entitateId, cate);
  }
}

module.exports = Jurnal;
// Textele si adresele pentru afisare (nu tin de baza de date): disponibile direct.
module.exports.ACTIUNI = ACTIUNI;
module.exports.ENTITATI = ENTITATI;
module.exports.ENTITATI_PLURAL = ENTITATI_PLURAL;
module.exports.ADRESE = ADRESE;
