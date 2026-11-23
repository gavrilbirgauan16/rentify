// Cum afisam valorile (o singura data, pentru toate paginile).

// 1500 RON -> "1.500 lei"; 300 EUR -> "300 EUR"
export function pretAfisat(suma, moneda = 'RON') {
  return `${Number(suma).toLocaleString('ro-RO')} ${moneda === 'RON' ? 'lei' : moneda}`;
}

// Starile unui anunt: textul afisat si clasa insignei (culoarea).
export const STARI_ANUNT = {
  ciorna: { text: 'Ciornă', clasa: 'insigna-ciorna' },
  in_asteptare: { text: 'În așteptare', clasa: 'insigna-asteptare' },
  activ: { text: 'Activ pe site', clasa: 'insigna-activ' },
  inactiv: { text: 'Inactiv', clasa: 'insigna-inactiv' },
  respins: { text: 'Respins', clasa: 'insigna-respins' },
};

export const TIPURI_ANUNT = { inchiriere: 'Închiriere', vanzare: 'Vânzare' };

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
