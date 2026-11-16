// Moderarea anunturilor (functii PURE, testate in test/moderare.test.js).
// Un anunt publicat de proprietar ajunge pe site doar dupa aprobarea adminului.
// Regula anti "bait and switch": orice schimbare de CONTINUT a unui anunt aprobat ii sterge aprobarea
// (altfel cineva ar putea face aprobat un anunt cinstit si apoi sa-l schimbe in ceva fals).

// Starile care "ocupa" un loc din limita planului: cele publicate si cele trimise spre publicare.
const STARI_PUBLICATE = ['activ', 'in_asteptare'];

// Campurile de continut: daca se schimba oricare, anuntul trebuie aprobat din nou.
// (Starea si promovarea nu sunt continut.)
const CAMPURI_CONTINUT = [
  'proprietate_id', 'tip', 'titlu', 'descriere', 'pret', 'pret_o_persoana', 'moneda', 'garantie', 'disponibil_de_la', 'locuri_libere',
];

// Aduce o valoare la o forma comparabila: din baza vin Decimal / Date, din formular vin numere / text.
function normalizeaza(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const text = String(v).trim();
  if (text !== '' && Number.isFinite(Number(text))) return String(Number(text)); // "1000.00" == 1000
  return text;
}

// true daca s-a schimbat continutul: vechi = anuntul din baza, nou = datele de salvat (catreEntitate()).
function continutSchimbat(vechi, nou, imaginiSchimbate = false) {
  if (imaginiSchimbate) return true;
  return CAMPURI_CONTINUT.some((camp) => normalizeaza(vechi[camp]) !== normalizeaza(nou[camp]));
}

// Ce stare primeste de fapt un anunt salvat de PROPRIETAR, fata de starea ceruta de el.
//   ceruta: 'ciorna' | 'activ' (= "Publica") | 'inactiv'
//   aprobat: anuntul are o aprobare valabila (aprobat_la) inainte de salvare
//   schimbat: s-a schimbat continutul la aceasta salvare
// Intoarce { stare, pastreazaAprobarea }.
function stareLaSalvare({ ceruta, aprobat, schimbat }) {
  const pastreazaAprobarea = Boolean(aprobat) && !schimbat;
  if (ceruta !== 'activ') return { stare: ceruta, pastreazaAprobarea };
  return { stare: pastreazaAprobarea ? 'activ' : 'in_asteptare', pastreazaAprobarea };
}

// Butonul "Activeaza" al proprietarului: direct activ daca aprobarea e inca valabila, altfel spre aprobare.
const stareLaActivare = (aprobat) => (aprobat ? 'activ' : 'in_asteptare');

// Ocupa un loc din limita planului?
const ocupaLoc = (stare) => STARI_PUBLICATE.includes(stare);

// Trebuie verificata limita? Doar cand anuntul TRECE dintr-o stare care nu ocupa loc intr-una care ocupa.
const verificaLimita = (stareNoua, stareVeche = null) => ocupaLoc(stareNoua) && !ocupaLoc(stareVeche);

// Motivul respingerii: obligatoriu, intre 5 si 300 de caractere. Intoarce { motiv, eroare }.
function valideazaMotiv(text) {
  const motiv = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (motiv.length < 5) return { motiv, eroare: 'Scrie motivul respingerii (cel puțin 5 caractere), ca proprietarul să știe ce să corecteze.' };
  if (motiv.length > 300) return { motiv, eroare: 'Motivul poate avea cel mult 300 de caractere.' };
  return { motiv, eroare: null };
}

module.exports = {
  STARI_PUBLICATE, CAMPURI_CONTINUT, continutSchimbat, stareLaSalvare, stareLaActivare, ocupaLoc, verificaLimita, valideazaMotiv,
};
