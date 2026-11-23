// Cache in memorie: tine minte, pentru o perioada, rezultatul unei citiri care se schimba rar (ex. planurile),
// ca sa nu intrebam baza de date la fiecare cerere.
//
// De ce e SINGLETON in container (laboratorul 10): un cache care ar trai doar cat o cerere (Scoped) s-ar goli la
// fiecare cerere si n-ar folosi la nimic. Tocmai pentru ca traieste cat aplicatia, NU are voie sa depinda de
// obiecte Scoped (accesori, servicii) - containerul (strict: true) ar refuza. De aceea primeste functia de incarcare
// la fiecare apel, de la serviciul care il foloseste, in loc sa tina el un accesor.
//
// Reguli:
//   - fiecare valoare are o durata (implicit 10 minute), dupa care se citeste din nou;
//   - cine modifica datele goleste cheile lor (sterge('planuri:')), ca nimeni sa nu vada date vechi;
//   - doua cereri simultane pentru aceeasi cheie lipsa fac O SINGURA citire (impart aceeasi promisiune);
//   - o citire esuata nu ramane in cache.
// Limita (de stiut): cache-ul e in memoria procesului. Cu mai multe procese (ex. mai multe instante pe server),
// fiecare are cache-ul lui; golirea se face doar in procesul care a modificat datele, iar celelalte vad datele
// noi dupa cel mult durata cheii. Pentru planuri (schimbate rar, de admin) e acceptabil.
const DURATA_IMPLICITA = 10 * 60; // secunde

class Cache {
  #intrari = new Map(); // cheie -> { valoare: Promise, expiraLa: ms }
  #statistici = { gasite: 0, citite: 0 };

  // Valoarea din cache sau, daca lipseste / a expirat, rezultatul lui incarca() (care se pastreaza).
  //   const planuri = await cache.obtine('planuri:proprietar', () => planAccessor.getOferta('proprietar'));
  async obtine(cheie, incarca, { secunde = DURATA_IMPLICITA } = {}) {
    const acum = Date.now();
    const intrare = this.#intrari.get(cheie);
    if (intrare && intrare.expiraLa > acum) {
      this.#statistici.gasite++;
      return intrare.valoare;
    }
    this.#statistici.citite++;
    const valoare = Promise.resolve().then(incarca);
    this.#intrari.set(cheie, { valoare, expiraLa: acum + secunde * 1000 });
    try {
      return await valoare;
    } catch (eroare) {
      if (this.#intrari.get(cheie)?.valoare === valoare) this.#intrari.delete(cheie);
      throw eroare;
    }
  }

  // Goleste toate cheile care incep cu prefixul dat (ex. 'planuri:'). Intoarce cate a sters.
  sterge(prefix) {
    let sterse = 0;
    for (const cheie of this.#intrari.keys()) {
      if (cheie.startsWith(prefix)) {
        this.#intrari.delete(cheie);
        sterse++;
      }
    }
    return sterse;
  }

  // Cate citiri au fost servite din cache si cate au mers la baza de date (pentru verificare / demonstratie).
  statistici() {
    return { ...this.#statistici, chei: [...this.#intrari.keys()] };
  }
}

module.exports = Cache;
module.exports.DURATA_IMPLICITA = DURATA_IMPLICITA;
