// Parolele NU se salveaza niciodata in clar. Salvam doar o "amprenta" (hash) facuta cu scrypt,
// un algoritm inclus in Node.js, facut special pentru parole: e lent intentionat, ca sa fie greu de spart.
// Fiecare parola primeste o "sare" (salt) aleatoare, deci doua parole identice au amprente diferite.
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// Setarile scrypt (cu cat N e mai mare, cu atat e mai greu de spart, dar si mai lent).
const SETARI = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LUNGIME_CHEIE = 64;
const LUNGIME_MINIMA = 8;

// Parola -> text de salvat in baza de date, ex. "scrypt$32768$8$1$<sare>$<amprenta>"
async function hashParola(parola) {
  const sare = crypto.randomBytes(16);
  const amprenta = await scrypt(parola, sare, LUNGIME_CHEIE, SETARI);
  return ['scrypt', SETARI.N, SETARI.r, SETARI.p, sare.toString('base64'), amprenta.toString('base64')].join('$');
}

// Verifica o parola fata de amprenta salvata. Intoarce true / false.
async function verificaParola(parola, salvat) {
  const parti = String(salvat || '').split('$');
  if (parti.length !== 6 || parti[0] !== 'scrypt') return false; // ex. parolele vechi de test "hash_de_test"
  const [, N, r, p, sare, amprenta] = parti;
  const asteptat = Buffer.from(amprenta, 'base64');
  if (asteptat.length === 0) return false;
  const calculat = await scrypt(parola, Buffer.from(sare, 'base64'), asteptat.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SETARI.maxmem,
  });
  // Comparatie in timp constant: nu lasa sa se ghiceasca parola dupa cat dureaza verificarea.
  return crypto.timingSafeEqual(asteptat, calculat);
}

// Regulile pentru o parola noua. Intoarce mesajul de eroare sau null daca e buna.
function verificaReguliParola(parola) {
  if (!parola || parola.length < LUNGIME_MINIMA) return `Parola trebuie să aibă cel puțin ${LUNGIME_MINIMA} caractere.`;
  return null;
}

// Parola temporara pentru resetarea facuta de admin: 12 caractere alese aleator (criptografic),
// fara caractere usor de confundat (0/O, 1/l/I), ca sa poata fi dictata sau copiata fara greseli.
const ALFABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genereazaParolaTemporara(lungime = 12) {
  return Array.from({ length: lungime }, () => ALFABET[crypto.randomInt(ALFABET.length)]).join('');
}

module.exports = { hashParola, verificaParola, verificaReguliParola, genereazaParolaTemporara };