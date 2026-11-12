// Tokenurile din linkurile trimise pe email: aleatoare (32 de octeti), folosibile o singura data si cu termen.
// In baza de date pastram doar amprenta SHA-256; tokenul propriu-zis exista doar in email.
const crypto = require('crypto');
const TokenAccessor = require('../src/NivelAccesDate/TokenAccessor');

const tokenuri = new TokenAccessor();

const VALABILITATE_MINUTE = {
  confirmare_email: 24 * 60,
  resetare_parola: 60,
  schimbare_email: 24 * 60,
};

const amprenta = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Un token arata ca o insiruire de litere, cifre, "-" si "_" (43 de caractere).
const formaValida = (token) => /^[A-Za-z0-9_-]{43}$/.test(String(token));

// Creeaza un token si intoarce textul lui (de pus in link).
async function creeaza(utilizatorId, tip, emailNou = null) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiraLa = new Date(Date.now() + VALABILITATE_MINUTE[tip] * 60 * 1000);
  await tokenuri.creeaza({ utilizatorId, tip, hash: amprenta(token), expiraLa, emailNou });
  return token;
}

// Gaseste tokenul valid (fara sa-l consume) - pentru afisarea formularului de resetare.
async function verifica(token, tip) {
  if (!formaValida(token)) return null;
  return tokenuri.getValid(amprenta(token), tip);
}

// Gaseste si CONSUMA tokenul (merge o singura data). Intoarce inregistrarea sau null.
async function foloseste(token, tip) {
  const t = await verifica(token, tip);
  if (!t) return null;
  return (await tokenuri.marcheazaFolosit(t.id)) ? t : null;
}

module.exports = { creeaza, verifica, foloseste, amprenta, formaValida, VALABILITATE_MINUTE };
