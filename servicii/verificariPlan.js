// Verificari "are voie planul lui?" care au nevoie de baza de date.
// Adminul NU e blocat (el poate corecta orice), doar avertizat. Proprietarul e blocat cand atinge limita.
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const AnuntAccessor = require('../src/NivelAccesDate/AnuntAccessor');
const limite = require('./limite');
const { azi } = require('./date');

const abonamente = new AbonamentAccessor();
const proprietati = new ProprietateAccessor();
const anunturi = new AnuntAccessor();

// Cum sta un utilizator fata de o limita din plan (cheie), stiind cate a folosit (numara).
// Intoarce { plan, folosit, maxim, depaseste, text, poateAdauga }; plan = null daca nu are abonament in curs.
async function situatie(utilizatorId, cheie, numara) {
  const [curente, folosit] = await Promise.all([abonamente.getCurente([utilizatorId], azi()), numara(utilizatorId)]);
  const abonament = curente[0] ?? null;
  const maxim = limite.limita(abonament, cheie);
  return {
    plan: abonament ? abonament.plan_abonament.nume : null,
    ...limite.situatie(folosit, maxim),
    poateAdauga: limite.maiPoate(folosit, maxim),
  };
}

// Proprietatile active (neinactive) ale unui proprietar fata de max_proprietati.
const situatieProprietati = (proprietarId) => situatie(proprietarId, 'max_proprietati', (id) => proprietati.countByProprietar(id));

// Anunturile publicate (active + in asteptare) ale unui proprietar fata de max_anunturi_active.
const situatieAnunturi = (proprietarId) => situatie(proprietarId, 'max_anunturi_active', (id) => anunturi.numaraPublicateAleProprietarului(id));

// Intoarce un text de avertizare daca proprietarul a depasit numarul de proprietati din plan, altfel null.
async function avertizareProprietati(proprietarId) {
  const s = await situatieProprietati(proprietarId);
  if (!s.plan) return 'Atenție: proprietarul nu are un abonament în curs.';
  return s.depaseste ? `Atenție: proprietarul are acum ${s.folosit} proprietăți active, dar planul „${s.plan}” permite ${s.maxim}.` : null;
}

module.exports = { situatieProprietati, situatieAnunturi, avertizareProprietati };
