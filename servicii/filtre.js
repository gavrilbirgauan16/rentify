// Filtre si paginare comune pentru toate listele din admin.
// Fiecare pagina descrie ce filtre are; aici se citesc din adresa (?q=...&stare=...), se curata
// (orice valoare necunoscuta sau gresita e ignorata, nu da eroare) si se construiesc linkurile.
// Filtrele stau in adresa, deci o lista filtrata se poate salva ca semn de carte sau trimite cuiva.

const LUNGIME_MAXIMA_TEXT = 100;

// Citeste o valoare dupa tipul ei. Intoarce '' daca lipseste sau nu e valida.
function citesteValoare(brut, def) {
  const text = String(brut ?? '').trim();
  if (text === '') return '';
  switch (def.tip) {
    case 'text':
      return text.slice(0, LUNGIME_MAXIMA_TEXT);
    case 'enum':
      return def.valori.includes(text) ? text : '';
    case 'id': {
      const n = Number(text);
      return Number.isInteger(n) && n > 0 ? n : '';
    }
    case 'intreg': {
      const n = Number(text);
      return Number.isInteger(n) && n >= (def.min ?? 0) ? n : '';
    }
    case 'numar': {
      const n = Number(text.replace(',', '.'));
      return Number.isFinite(n) && n >= 0 ? n : '';
    }
    case 'data':
      return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) ? text : '';
    default:
      return '';
  }
}

// definitie = { q: { tip: 'text' }, stare: { tip: 'enum', valori: [...] }, sort: { tip: 'enum', valori: [...], implicit: 'noi' } }
// Intoarce obiectul cu filtrele curatate (+ pagina).
function citesteFiltre(query, definitie) {
  const filtre = {};
  for (const [nume, def] of Object.entries(definitie)) {
    const valoare = citesteValoare(query[nume], def);
    filtre[nume] = valoare === '' && def.implicit !== undefined ? def.implicit : valoare;
  }
  const pagina = Number(query.pagina);
  filtre.pagina = Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
  return filtre;
}

// true daca utilizatorul a ales cel putin un filtru (sortarea si pagina nu se pun la socoteala).
function areFiltre(filtre, definitie) {
  return Object.entries(definitie).some(([nume, def]) => nume !== 'sort' && filtre[nume] !== '' && filtre[nume] !== def.implicit);
}

// Calculul paginilor: ce bucata din lista se afiseaza.
function paginare(total, paginaCeruta, pePagina) {
  const totalPagini = Math.max(1, Math.ceil(total / pePagina));
  const pagina = Math.min(Math.max(1, paginaCeruta), totalPagini);
  const skip = (pagina - 1) * pePagina;
  return { total, pagina, totalPagini, pePagina, skip, take: pePagina, de: total ? skip + 1 : 0, pana: Math.min(skip + pePagina, total) };
}

// Paginarea unei liste deja aduse in memorie (cand filtrul e calculat, ex. "neplatit").
function paginareLista(lista, paginaCeruta, pePagina) {
  const p = paginare(lista.length, paginaCeruta, pePagina);
  return { ...p, randuri: lista.slice(p.skip, p.skip + p.take) };
}

// Adresa listei cu filtrele curente, schimband doar ce e in "modificari".
// Valorile goale si cele implicite nu apar in adresa (adrese scurte si curate). Orice schimbare de filtru
// te duce la pagina 1, doar linkurile de paginare pastreaza pagina.
function adresa(baza, filtre, definitie, modificari = {}) {
  const valori = { ...filtre, pagina: 1, ...modificari };
  const parametri = new URLSearchParams();
  for (const [nume, def] of Object.entries(definitie)) {
    const v = valori[nume];
    if (v !== '' && v !== undefined && v !== null && v !== def.implicit) parametri.set(nume, v);
  }
  if (valori.pagina > 1) parametri.set('pagina', valori.pagina);
  const text = parametri.toString();
  return text ? `${baza}?${text}` : baza;
}

// Tot ce le trebuie paginilor: filtrele, paginarea si o functie pentru linkuri.
function pentruPagina(baza, filtre, definitie, pag) {
  return {
    filtre,
    pag,
    areFiltre: areFiltre(filtre, definitie),
    link: (modificari) => adresa(baza, filtre, definitie, modificari),
    bazaLista: baza,
  };
}

// Cauta un text in mai multe campuri, fara sa conteze literele mari/mici (pentru Prisma).
const contineText = (campuri, text) => campuri.map((camp) => {
  // camp poate fi 'nume' sau o cale 'proprietate.oras' -> { proprietate: { oras: {...} } }
  const parti = camp.split('.');
  return parti.reduceRight((interior, parte) => ({ [parte]: interior }), { contains: text, mode: 'insensitive' });
});

module.exports = { citesteFiltre, areFiltre, paginare, paginareLista, adresa, pentruPagina, contineText };
