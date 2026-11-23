// Abonarea consumatorilor la evenimente - facuta O SINGURA DATA, la pornirea aplicatiei (din container.js).
// Aici, si doar aici, se vede "cine pe cine asculta". Un consumator nou se adauga in lista de mai jos,
// fara sa se schimbe serviciul care publica evenimentul.
//
// Durate de viata: magistrala de evenimente e Singleton, dar consumatorii pot avea nevoie de obiecte Scoped
// (ex. jurnalul, cu accesorul lui). De aceea fiecare consumator primeste, la fiecare eveniment, propriul scope
// nou - ca un "handler" de mesaje din .NET, care primeste propriul scope.
const CONSUMATORI = [
  require('../servicii/consumatori/emailModerare'),
  require('../servicii/consumatori/jurnalModerare'),
];

function aboneazaConsumatorii(container) {
  const evenimente = container.resolve('evenimente');
  for (const { nume, la } of CONSUMATORI) {
    for (const [eveniment, consumator] of Object.entries(la)) {
      evenimente.aboneaza(eveniment, nume, (date) => consumator(date, container.createScope()));
    }
  }
}

module.exports = { aboneazaConsumatorii, CONSUMATORI };
