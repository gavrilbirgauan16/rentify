// Limitele din planul de abonament al unui utilizator (ex. cate proprietati poate avea un proprietar).
// Momentan le folosim ca sa AVERTIZAM adminul; cand vor exista paginile proprietarului si chiriasului,
// aceleasi functii vor BLOCA depasirea.

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

module.exports = { dinRanduri, limita, situatie };
