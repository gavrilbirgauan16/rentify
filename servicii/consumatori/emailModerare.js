// Consumatorul 1 al evenimentelor de moderare: ii trimite proprietarului emailul cu decizia adminului.
// Nu stie nimic de jurnal si nici de serviciul care a publicat evenimentul (decuplare).
// Un email care nu pleaca nu anuleaza aprobarea / respingerea: servicii/email.js noteaza problema in consola.
const Evenimente = require('../evenimente');
const emailuri = require('../emailuri');
const posta = require('../email'); // posta.trimite (nu destructurat: testele il pot inlocui cu unul fals)

// Trimite emailul doar daca stim adresa proprietarului. construieste = functia care face mesajul
// (chemata abia dupa verificare: fara proprietar nu avem nici numele pentru "Buna, ...!").
async function anunta(proprietar, construieste) {
  if (!proprietar?.email) return;
  const email = construieste(proprietar);
  await posta.trimite({ catre: proprietar.email, subiect: email.subiect, text: email.text, html: email.html });
}

module.exports = {
  nume: 'email-proprietar',
  la: {
    [Evenimente.ANUNT_APROBAT]: ({ anunt, proprietar }) => anunta(proprietar, (p) => emailuri.anuntAprobat(p, anunt.titlu)),
    [Evenimente.ANUNT_RESPINS]: ({ anunt, proprietar, motiv }) => anunta(proprietar, (p) => emailuri.anuntRespins(p, anunt.titlu, motiv)),
  },
};
