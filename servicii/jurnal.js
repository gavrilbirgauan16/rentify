// Jurnalul de administrare: tine minte CINE (ce admin) a facut CE, pe CARE inregistrare si CAND.
// E "best effort": daca scrierea in jurnal esueaza, actiunea adminului NU se anuleaza, doar notam eroarea in consola.
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');

const jurnal = new JurnalAccessor();

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

// noteaza(res, 'modificare', 'anunt', 12, 'Garsonieră centru')
async function noteaza(res, actiune, entitate, entitateId, detalii = null) {
  const admin = res.locals.utilizator;
  if (!admin) return;
  try {
    await jurnal.adauga({
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

module.exports = { noteaza, ACTIUNI, ENTITATI, ENTITATI_PLURAL, ADRESE };
