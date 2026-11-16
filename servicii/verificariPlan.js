// Verificari "are voie planul lui?" care au nevoie de baza de date.
// Adminul NU e blocat (el poate corecta orice), doar avertizat. Proprietarul e blocat cand atinge limita.
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const limite = require('./limite');
const { azi } = require('./date');

const abonamente = new AbonamentAccessor();
const proprietati = new ProprietateAccessor();

// Cum sta un proprietar fata de numarul de proprietati din plan.
// Intoarce { plan, folosit, maxim, depaseste, text, poateAdauga }; plan = null daca nu are abonament in curs.
async function situatieProprietati(proprietarId) {
  const [curente, folosit] = await Promise.all([abonamente.getCurente([proprietarId], azi()), proprietati.countByProprietar(proprietarId)]);
  const abonament = curente[0] ?? null;
  const maxim = limite.limita(abonament, 'max_proprietati');
  return {
    plan: abonament ? abonament.plan_abonament.nume : null,
    ...limite.situatie(folosit, maxim),
    poateAdauga: limite.maiPoate(folosit, maxim),
  };
}

// Intoarce un text de avertizare daca proprietarul a depasit numarul de proprietati din plan, altfel null.
async function avertizareProprietati(proprietarId) {
  const s = await situatieProprietati(proprietarId);
  if (!s.plan) return 'Atenție: proprietarul nu are un abonament în curs.';
  return s.depaseste ? `Atenție: proprietarul are acum ${s.folosit} proprietăți active, dar planul „${s.plan}” permite ${s.maxim}.` : null;
}

module.exports = { situatieProprietati, avertizareProprietati };
