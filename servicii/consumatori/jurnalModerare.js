// Consumatorul 2 al evenimentelor de moderare: scrie decizia adminului in jurnalul de administrare.
// Nu stie nimic de email si nici de serviciul care a publicat evenimentul (decuplare).
// Jurnalul foloseste un accesor (Scoped), deci il ia din "scope"-ul primit pentru acest eveniment
// (fiecare eveniment are propriul scope, ca o cerere separata - vezi infrastructura/consumatori.js).
const Evenimente = require('../evenimente');

module.exports = {
  nume: 'jurnal-admin',
  la: {
    [Evenimente.ANUNT_APROBAT]: ({ anunt, admin }, scop) => scop.resolve('jurnal').noteaza(admin, 'aprobare', 'anunt', anunt.id, anunt.titlu),
    [Evenimente.ANUNT_RESPINS]: ({ anunt, admin, motiv }, scop) => scop.resolve('jurnal').noteaza(admin, 'respingere', 'anunt', anunt.id, `${anunt.titlu} – motiv: ${motiv}`),
  },
};
