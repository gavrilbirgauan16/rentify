// Cautarea PUBLICA a anunturilor (ce vede un chirias sau un vizitator). Functii pure, testate in test/cautareAnunturi.test.js.
// Foloseste acelasi mecanism de filtre ca listele din admin (servicii/filtre.js): valorile gresite din adresa
// se ignora, nu dau eroare. Regula de baza: se vad DOAR anunturile active, pe proprietati care nu sunt inactive.
const F = require('./filtre');

const TIPURI = ['inchiriere', 'vanzare'];
const PE_PAGINA = 12;
const PE_PAGINA_MAXIM = 48;

const FILTRE = {
  q: { tip: 'text' },                  // cuvinte din titlu, descriere, oras, zona
  oras: { tip: 'text' },
  tip: { tip: 'enum', valori: TIPURI },
  pret_min: { tip: 'numar' },
  pret_max: { tip: 'numar' },
  camere_min: { tip: 'intreg', min: 1 },
  persoane: { tip: 'intreg', min: 1 }, // cate persoane vor sa stea (proprietatea trebuie sa le incapa)
  sort: { tip: 'enum', valori: ['noi', 'pret_asc', 'pret_desc'], implicit: 'noi' },
  pe_pagina: { tip: 'intreg', min: 1 },
};

// Ordinea rezultatelor. "Noi": intai cele promovate (functia platita), apoi cele aprobate cel mai recent.
// id-ul la final: ordine stabila (doua anunturi cu acelasi pret nu-si schimba locul intre pagini).
const SORTARI = {
  noi: [{ promovat: 'desc' }, { aprobat_la: 'desc' }, { id: 'desc' }],
  pret_asc: [{ pret: 'asc' }, { id: 'desc' }],
  pret_desc: [{ pret: 'desc' }, { id: 'desc' }],
};

// Filtrele din adresa (?oras=Suceava&pret_max=1500) -> filtre curatate.
// Daca pretul minim e mai mare decat cel maxim (greseala de tastare), le inversam in loc sa nu gasim nimic.
function citesteCautarea(query) {
  const f = F.citesteFiltre(query, FILTRE);
  if (f.pret_min !== '' && f.pret_max !== '' && f.pret_min > f.pret_max) [f.pret_min, f.pret_max] = [f.pret_max, f.pret_min];
  f.pe_pagina = f.pe_pagina === '' ? PE_PAGINA : Math.min(f.pe_pagina, PE_PAGINA_MAXIM);
  return f;
}

// Filtrele -> conditia pentru baza de date (Prisma "where"). Starea "activ" e pusa MEREU, oricare ar fi filtrele.
function conditie(f) {
  const proprietate = { NOT: { stare: 'inactiv' } };
  const where = { stare: 'activ', proprietate };
  if (f.q) where.OR = F.contineText(['titlu', 'descriere', 'proprietate.oras', 'proprietate.zona'], f.q);
  if (f.oras) proprietate.oras = { equals: f.oras, mode: 'insensitive' };
  if (f.tip) where.tip = f.tip;
  if (f.pret_min !== '' || f.pret_max !== '') {
    where.pret = {};
    if (f.pret_min !== '') where.pret.gte = f.pret_min;
    if (f.pret_max !== '') where.pret.lte = f.pret_max;
  }
  if (f.camere_min) proprietate.nr_camere = { gte: f.camere_min };
  if (f.persoane) proprietate.max_locatari = { gte: f.persoane };
  return where;
}

module.exports = { FILTRE, SORTARI, PE_PAGINA, PE_PAGINA_MAXIM, citesteCautarea, conditie };
