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
