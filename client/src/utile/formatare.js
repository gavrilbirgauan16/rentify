// Cum afisam valorile (o singura data, pentru toate paginile).

// 1500 RON -> "1.500 lei"; 300 EUR -> "300 EUR"
export function pretAfisat(suma, moneda = 'RON') {
  return `${Number(suma).toLocaleString('ro-RO')} ${moneda === 'RON' ? 'lei' : moneda}`;
}

// Bani in lei, cu cel mult 2 zecimale: 250 -> "250 lei"; 80.5 -> "80,5 lei"; 1500 -> "1.500 lei"
export function lei(suma) {
  return `${Number(suma).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} lei`;
}

// "2026-11-24" (data fara ora, cum o trimite serverul) -> "24 noiembrie 2026".
// O construim din bucati (an, luna, zi), nu cu new Date("2026-11-24"): acela ar fi miezul noptii in UTC,
// adica 23 noiembrie seara in unele fusuri orare.
export function dataAfisata(text) {
  if (!text) return '';
  const [an, luna, zi] = String(text).slice(0, 10).split('-').map(Number);
  return new Date(an, luna - 1, zi).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Abonamentul: perioadele si starile (aceleasi coduri ca pe server, in models/AbonamentViewModel.js).
export const PERIOADE = { lunar: 'lunar', anual: 'anual' };
export const STARI_ABONAMENT = {
  platit: { text: 'Activ, plătit', clasa: 'insigna-activ' },
  neplatit: { text: 'Neplătit', clasa: 'insigna-respins' },
  programat: { text: 'Începe curând', clasa: 'insigna-asteptare' },
  expirat: { text: 'Expirat', clasa: 'insigna-inactiv' },
  anulat: { text: 'Anulat', clasa: 'insigna-inactiv' },
  inlocuit: { text: 'Înlocuit (upgrade)', clasa: 'insigna-ciorna' },
};

// Starile unui anunt: textul afisat si clasa insignei (culoarea).
export const STARI_ANUNT = {
  ciorna: { text: 'Ciornă', clasa: 'insigna-ciorna' },
  in_asteptare: { text: 'În așteptare', clasa: 'insigna-asteptare' },
  activ: { text: 'Activ pe site', clasa: 'insigna-activ' },
  inactiv: { text: 'Inactiv', clasa: 'insigna-inactiv' },
  respins: { text: 'Respins', clasa: 'insigna-respins' },
};

export const TIPURI_ANUNT = { inchiriere: 'Închiriere', vanzare: 'Vânzare' };

// Filtrele cautarii publice (aceleasi nume ca in API: GET /api/anunturi?q=...&oras=...).
export const FILTRE_CAUTARE = ['q', 'oras', 'tip', 'pret_min', 'pret_max', 'camere_min', 'persoane'];

// Proprietatile: tipurile si starile (aceleasi valori ca pe server, in models/ProprietateViewModel.js).
export const TIPURI_PROPRIETATE = { apartament: 'Apartament', garsoniera: 'Garsonieră', casa: 'Casă', camera: 'Cameră' };
export const STARI_PROPRIETATE = {
  liber: { text: 'Liberă', clasa: 'insigna-activ' },
  ocupat: { text: 'Ocupată', clasa: 'insigna-asteptare' },
  inactiv: { text: 'Inactivă', clasa: 'insigna-inactiv' },
};

// Judetele Romaniei (sugestii la completare; campul ramane text liber).
export const JUDETE = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brăila', 'Brașov', 'București', 'Buzău',
  'Călărași', 'Caraș-Severin', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu', 'Gorj',
  'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova',
  'Sălaj', 'Satu Mare', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vâlcea', 'Vaslui', 'Vrancea',
];
