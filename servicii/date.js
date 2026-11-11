// Lucrul cu datele calendaristice (fara ora). Toate datele sunt tinute ca text 'AAAA-LL-ZZ',
// iar "azi" se socoteste dupa ora Romaniei, nu dupa ora serverului.

const ZI_MS = 24 * 60 * 60 * 1000;
const FORMAT_RO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' });

// Data de azi in Romania, ex. '2026-11-09'.
const azi = (acum = new Date()) => FORMAT_RO.format(acum);

// true daca textul e o data reala de forma AAAA-LL-ZZ (ex. 2026-02-30 nu e).
function eDataValida(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(text))) return false;
  return catreDate(text).toISOString().slice(0, 10) === text;
}

// Text -> Date la miezul noptii UTC (asa le asteapta Prisma pentru coloanele @db.Date) si invers.
const catreDate = (text) => new Date(`${text}T00:00:00Z`);
const dinDate = (data) => (data ? new Date(data).toISOString().slice(0, 10) : '');

// Aduna zile la o data.
const adunaZile = (text, zile) => dinDate(new Date(catreDate(text).getTime() + zile * ZI_MS));

// Aduna luni; daca luna urmatoare e mai scurta, ramane pe ultima ei zi (31 ian + 1 luna = 28/29 feb).
function adunaLuni(text, luni) {
  const [an, luna, zi] = text.split('-').map(Number);
  const tinta = new Date(Date.UTC(an, luna - 1 + luni, 1));
  const ultimaZi = new Date(Date.UTC(tinta.getUTCFullYear(), tinta.getUTCMonth() + 1, 0)).getUTCDate();
  tinta.setUTCDate(Math.min(zi, ultimaZi));
  return dinDate(tinta);
}

// Ultima zi a unui abonament: inceput + 1 luna (sau 1 an) - 1 zi. Ex. 1 nov -> 30 nov; 9 nov 2026 anual -> 8 nov 2027.
const sfarsitPerioada = (inceput, perioada) => adunaZile(adunaLuni(inceput, perioada === 'anual' ? 12 : 1), -1);

// Cate zile sunt de la "de" pana la "pana" (negativ daca "pana" e in trecut).
const zileIntre = (de, pana) => Math.round((catreDate(pana) - catreDate(de)) / ZI_MS);

// '2026-11-09' -> '9 noiembrie 2026'
const afiseaza = (text) => (text ? catreDate(text).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '–');

// Prima zi a lunii curente (pentru "incasari luna aceasta").
const inceputLuna = (text = azi()) => `${text.slice(0, 7)}-01`;

// Momentul exact (UTC) in care incepe o zi in Romania, ex. '2026-11-10' -> 2026-11-09T22:00:00Z (iarna, UTC+2)
// sau '2026-07-10' -> 2026-07-09T21:00:00Z (vara, UTC+3). Folosit la filtrele pe zile ale orelor salvate in UTC.
const PARTI_RO = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function inceputZiRomania(text) {
  const utc = catreDate(text);
  const p = Object.fromEntries(PARTI_RO.formatToParts(utc).map((x) => [x.type, Number(x.value)]));
  const decalaj = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - utc.getTime();
  return new Date(utc.getTime() - decalaj);
}

module.exports = { inceputZiRomania, azi, eDataValida, catreDate, dinDate, adunaZile, adunaLuni, sfarsitPerioada, zileIntre, afiseaza, inceputLuna };
