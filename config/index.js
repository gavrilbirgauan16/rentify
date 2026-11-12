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

// Trimiterea emailurilor (SMTP, ex. Gmail). Optionala: fara ea, emailurile se afiseaza doar in consola
// (bun pentru dezvoltare). Daca se completeaza, trebuie completate toate.
const smtp = process.env.SMTP_HOST
  ? {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    user: obligatoriu('SMTP_USER'),
    pass: obligatoriu('SMTP_PASS'),
    de: process.env.EMAIL_FROM || `Rentify <${process.env.SMTP_USER}>`,
  }
  : null;

// Adresa publica a aplicatiei, folosita in linkurile din emailuri (fara "/" la final).
const appUrl = (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3000}`).replace(/\/+$/, '');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  esteProductie: process.env.NODE_ENV === 'production',
  databaseUrl: obligatoriu('DATABASE_URL'),
  sessionSecret,
  durataSesiuneOre: 8,
  apiKey,
  smtp,
  appUrl,
};