// Verificari "are voie planul lui?" care au nevoie de baza de date.
// Adminul NU e blocat (el poate corecta orice), doar avertizat. Cand vor exista paginile proprietarului,
// aceeasi verificare va opri adaugarea.
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const limite = require('./limite');
const { azi } = require('./date');

const abonamente = new AbonamentAccessor();
const proprietati = new ProprietateAccessor();

// Intoarce un text de avertizare daca proprietarul a depasit numarul de proprietati din plan, altfel null.
async function avertizareProprietati(proprietarId) {
  const [curente, folosit] = await Promise.all([abonamente.getCurente([proprietarId], azi()), proprietati.countByProprietar(proprietarId)]);
  const abonament = curente[0] ?? null;
  if (!abonament) return 'Atenție: proprietarul nu are un abonament în curs.';
  const s = limite.situatie(folosit, limite.limita(abonament, 'max_proprietati'));
  return s.depaseste ? `Atenție: proprietarul are acum ${s.folosit} proprietăți active, dar planul „${abonament.plan_abonament.nume}” permite ${s.maxim}.` : null;
}

module.exports = { avertizareProprietati };
