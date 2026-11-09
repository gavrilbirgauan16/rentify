// Modelele pentru API (DTO = Data Transfer Object): ce PRIMESTE si ce TRIMITE API-ul pentru anunturi.
// Sunt diferite de tabelul "anunt" din baza de date:
//  - la iesire adunam date din 3 tabele (anunt + proprietate + proprietar) si ascundem ce e intern (telefonul, id-ul proprietarului);
//  - la intrare transformam JSON-ul primit in forma pe care o asteapta validarea din AnuntViewModel (aceeasi ca la formular).
// Conversia o face automat biblioteca "morphism": scriem O SINGURA DATA "schema" (ce camp vine de unde),
// iar ea o aplica pe un obiect sau pe o lista intreaga - echivalentul AutoMapper din .NET.
const { morphism } = require('morphism');
const { ETICHETE_TIP } = require('../AnuntViewModel');

const numarSauNull = (v) => (v === null || v === undefined ? null : Number(v));
const bani = (v) => Math.round(v * 100) / 100;

// Cat plateste fiecare persoana, de la 1 pana la numarul maxim de locatari (doar la inchiriere).
// O singura persoana plateste pretul redus, daca exista; de la 2 persoane in sus, chiria se imparte egal.
function preturiPePersoane({ tip, pret, pret_o_persoana, proprietate }) {
  if (tip !== 'inchiriere') return [];
  const intreg = Number(pret);
  const maxim = Math.max(1, Number(proprietate?.max_locatari) || 1);
  return Array.from({ length: maxim }, (_, i) => {
    const persoane = i + 1;
    const pePersoana = persoane === 1 && pret_o_persoana !== null && pret_o_persoana !== undefined ? Number(pret_o_persoana) : intreg / persoane;
    return { persoane, pe_persoana: bani(pePersoana), total: bani(pePersoana * persoane) };
  });
}

// ---- IESIRE: entitatea din baza de date (cu proprietatea si imaginile) -> ce vede clientul API ----
const schemaIesire = {
  id: 'id',
  titlu: 'titlu',
  descriere: ({ descriere }) => descriere ?? null,
  tip: 'tip',
  tip_afisat: ({ tip }) => ETICHETE_TIP[tip] ?? tip,
  stare: 'stare',
  pret: ({ pret }) => Number(pret),
  pret_o_persoana: ({ pret_o_persoana }) => numarSauNull(pret_o_persoana),
  moneda: 'moneda',
  garantie: ({ garantie }) => numarSauNull(garantie),
  preturi_pe_persoane: preturiPePersoane,
  disponibil_de_la: ({ disponibil_de_la }) => (disponibil_de_la ? disponibil_de_la.toISOString().slice(0, 10) : null),
  locuri_libere: ({ locuri_libere }) => locuri_libere ?? null,
  promovat: 'promovat',
  proprietate: {
    id: 'proprietate.id',
    denumire: 'proprietate.denumire',
    oras: 'proprietate.oras',
    max_locatari: 'proprietate.max_locatari',
  },
  proprietar: ({ proprietate }) => (proprietate?.utilizator ? `${proprietate.utilizator.prenume} ${proprietate.utilizator.nume}` : null),
  imagini: ({ imagini }) => (imagini ?? []).map((f) => f.cale),
  creat_la: ({ creat_la }) => (creat_la ? creat_la.toISOString() : null),
};

// ---- INTRARE: JSON-ul din Body (Post / Put) -> campurile pe care le valideaza AnuntViewModel ----
// In JSON numerele vin ca numere si "promovat" ca true/false; validarea lucreaza cu text (ca la formular).
const text = (v) => (v === undefined || v === null ? '' : String(v));
const CAMPURI_INTRARE = ['proprietate_id', 'tip', 'titlu', 'descriere', 'pret', 'pret_o_persoana', 'moneda', 'garantie', 'disponibil_de_la', 'locuri_libere', 'stare'];
const schemaIntrare = {
  ...Object.fromEntries(CAMPURI_INTRARE.map((camp) => [camp, (sursa) => text(sursa[camp])])),
  promovat: ({ promovat }) => (promovat === true ? 'on' : ''),
};

// Un anunt (entitate + imaginile lui) -> DTO
const catreDto = (entitate, imagini = []) => morphism(schemaIesire, { ...entitate, imagini });

// Mai multe anunturi -> lista de DTO (imaginile se cauta dupa id-ul anuntului)
function catreListaDto(entitati, imagini = []) {
  const surse = entitati.map((a) => ({ ...a, imagini: imagini.filter((f) => f.entitate_id === a.id) }));
  return morphism(schemaIesire, surse);
}

// Body JSON -> obiect "ca de la formular"
const dinBody = (body) => morphism(schemaIntrare, body);

module.exports = { catreDto, catreListaDto, dinBody, CAMPURI_INTRARE };