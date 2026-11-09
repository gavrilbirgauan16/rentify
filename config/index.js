// Toate setarile aplicatiei, citite O SINGURA DATA din fisierul .env si verificate la pornire.
// Daca lipseste ceva important, aplicatia se opreste imediat cu un mesaj clar (mai bine decat sa mearga "pe jumatate").
require('dotenv/config');

function obligatoriu(nume) {
  const valoare = process.env[nume];
  if (!valoare) {
    console.error(`Lipseste setarea ${nume} din fisierul .env (vezi .env.example).`);
    process.exit(1);
  }
  return valoare;
}

const sessionSecret = obligatoriu('SESSION_SECRET');
if (sessionSecret.length < 32) {
  console.error('SESSION_SECRET e prea scurt (minim 32 de caractere). Genereaza unul nou, vezi README.md.');
  process.exit(1);
}
// Cheia pentru API (Post / Put). Optionala: daca lipseste, API-ul merge doar pentru citire.
const apiKey = process.env.API_KEY || null;
if (apiKey && apiKey.length < 32) {
  console.error('API_KEY e prea scurt (minim 32 de caractere). Genereaza unul ca la SESSION_SECRET, vezi .env.example.');
  process.exit(1);
}
module.exports = {
  port: Number(process.env.PORT) || 3000,
  esteProductie: process.env.NODE_ENV === 'production',
  databaseUrl: obligatoriu('DATABASE_URL'),
  sessionSecret,
  durataSesiuneOre: 8,
  apiKey,
};