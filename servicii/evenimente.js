// Magistrala de evenimente: comunicare DECUPLATA intre nivelul de servicii si cei care reactioneaza la ce se intampla.
// Un serviciu PUBLICA un eveniment ("anunt.aprobat") fara sa stie cine il asculta; CONSUMATORII (abonati la pornire,
// in infrastructura/consumatori.js) reactioneaza fiecare independent: unul trimite emailul, altul scrie in jurnal.
// Adaugarea unui consumator nou NU schimba serviciul care publica.
//
// Construita pe EventEmitter din Node.js (fara biblioteca noua). EventEmitter tine lista de abonati; publicarea o facem
// noi, pentru ca emit() simplu are doua probleme pentru consumatori asincroni:
//   1. nu asteapta functiile async (n-am sti cand s-au terminat - nici in teste);
//   2. o eroare intr-un abonat le opreste pe celelalte si ajunge la cel care a publicat.
// Aici fiecare consumator ruleaza separat: daca unul esueaza (ex. serverul de email), ceilalti ruleaza oricum,
// iar operatia de business (ex. aprobarea) ramane valabila - eroarea doar se noteaza in consola.
//
// In container e SINGLETON: abonarile se fac o singura data, la pornire, si trebuie sa existe pentru toate cererile.
const { EventEmitter } = require('node:events');

class Evenimente {
  #emitter = new EventEmitter();

  // Aboneaza un consumator la un eveniment. nume = cine e (apare in consola daca esueaza).
  //   evenimente.aboneaza('anunt.aprobat', 'email-proprietar', async (date) => { ... });
  aboneaza(eveniment, nume, consumator) {
    const abonat = (date) => consumator(date);
    abonat.numeConsumator = nume;
    this.#emitter.on(eveniment, abonat);
  }

  // Numele consumatorilor abonati la un eveniment (pentru verificare si documentatie).
  consumatori(eveniment) {
    return this.#emitter.listeners(eveniment).map((f) => f.numeConsumator);
  }

  // Publica evenimentul catre toti consumatorii, fiecare izolat de ceilalti. Asteapta sa se termine toti si
  // intoarce ce s-a intamplat cu fiecare: [{ consumator, ok, eroare? }]. NU arunca niciodata erori.
  // date = obiect simplu (id-uri, texte), nu entitati din baza de date: consumatorul isi ia singur ce-i mai trebuie.
  async publica(eveniment, date) {
    const abonati = this.#emitter.listeners(eveniment);
    const rezultate = await Promise.allSettled(abonati.map((f) => Promise.resolve().then(() => f(date))));
    return rezultate.map((r, i) => {
      const consumator = abonati[i].numeConsumator;
      if (r.status === 'fulfilled') return { consumator, ok: true };
      console.error(`Evenimentul "${eveniment}": consumatorul "${consumator}" a esuat:`, r.reason?.message ?? r.reason);
      return { consumator, ok: false, eroare: r.reason };
    });
  }
}

// Numele evenimentelor, intr-un singur loc (ca sa nu le scriem gresit in doua locuri diferite).
Evenimente.ANUNT_APROBAT = 'anunt.aprobat';
Evenimente.ANUNT_RESPINS = 'anunt.respins';
Evenimente.PAROLA_SCHIMBATA = 'cont.parola_schimbata'; // { utilizator: { email, prenume }, cum: 'schimbare' | 'resetare', cand }

module.exports = Evenimente;
