// Limitele din planul de abonament al unui utilizator (ex. cate proprietati poate avea un proprietar).
// Pe adminul le folosim doar ca sa-l AVERTIZAM; pe proprietar (si mai tarziu pe chirias) le folosim ca sa BLOCAM depasirea.

// Transforma randurile din limita_plan intr-un obiect { max_proprietati: 3, sesizari: 1, ... }.
// O limita care lipseste inseamna "nelimitat" (sau, la beneficii, "neinclus").
function dinRanduri(randuri = []) {
  return Object.fromEntries(randuri.map((r) => [r.cheie, r.valoare]));
}

// Limita unei chei; null = nelimitat. Fara abonament curent nu are voie la nimic (0).
function limita(abonamentCurent, cheie) {
  if (!abonamentCurent) return 0;
  const limite = dinRanduri(abonamentCurent.plan_abonament?.limita_plan);
  return limite[cheie] ?? null;
}

// Cum sta un utilizator fata de o limita: { folosit, maxim, depaseste, text }
function situatie(folosit, maxim) {
  if (maxim === null) return { folosit, maxim, depaseste: false, text: `${folosit} / nelimitat` };
  return { folosit, maxim, depaseste: folosit > maxim, text: `${folosit} / ${maxim}` };
}

// Mai are voie sa adauge inca unul? (null = nelimitat). Ex. 0 din 1 -> da; 1 din 1 -> nu.
const maiPoate = (folosit, maxim) => maxim === null || folosit < maxim;

// Textul afisat cand planul nu mai permite inca unul. s = rezultatul lui situatie() + numele planului.
// c = cuvintele potrivite: { unul: 'proprietate activă', multe: 'proprietăți active', inca: 'una' }.
// Peste limita (ex. dupa trecerea la un plan mai mic) spunem exact cate trebuie dezactivate.
function textBlocare(s, c) {
  if (!s.plan) return `Nu ai un abonament în curs, așa că nu poți avea ${c.multe}.`;
  const cate = (n) => (n === 1 ? `1 ${c.unul}` : `${n} ${c.multe}`);
  const deDezactivat = s.folosit - s.maxim + 1;
  return `Planul tău „${s.plan}” permite ${cate(s.maxim)}, iar tu ai ${s.folosit}. `
    + `Ca să adaugi încă ${c.inca}, dezactivează ${deDezactivat === 1 ? c.inca : deDezactivat} sau treci la un plan mai mare.`;
}

const CUVINTE_PROPRIETATI = { unul: 'proprietate activă', multe: 'proprietăți active', inca: 'una' };
const CUVINTE_ANUNTURI = { unul: 'anunț activ', multe: 'anunțuri active', inca: 'unul' };

module.exports = { dinRanduri, limita, situatie, maiPoate, textBlocare, CUVINTE_PROPRIETATI, CUVINTE_ANUNTURI };
